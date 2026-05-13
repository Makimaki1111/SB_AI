import uvicorn
import re
import json
import asyncio
import logging
import traceback
from urllib.parse import urlparse
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# New components
try:
    from SB_info import SB_info
    from connection_manager import ConnectionManager
    from room_manager import RoomManager
    from ws_handler import WebSocketHandler
    from abilities import get_all_abilities_info
except ImportError:
    from backend.SB_info import SB_info
    from backend.connection_manager import ConnectionManager
    from backend.room_manager import RoomManager
    from backend.ws_handler import WebSocketHandler
    from backend.abilities import get_all_abilities_info

app = FastAPI()

# --- ログ設定 ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- アクセスログのフィルタリング ---
class AccessLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        if "GET /favicon.ico" in message and "404" in message:
            return False
        match = re.search(r'HTTP/\d\.\d" (\d{3})', message)
        if match:
            status_code = int(match.group(1))
            if status_code < 400:
                return False
        return True

logging.getLogger("uvicorn.access").addFilter(AccessLogFilter())

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 資産保護ミドルウェア ---
@app.middleware("http")
async def protect_assets_middleware(request: Request, call_next):
    path = request.url.path
    # 画像や音声リソースへの直接アクセスを制限
    if path.startswith("/img/") or path.startswith("/resource/"):
        referer = request.headers.get("referer")
        if referer:
            referer_netloc = urlparse(referer).netloc
            request_host = request.headers.get("host")
            # 開発環境とRender環境を許可
            is_allowed = (
                referer_netloc == request_host or
                "localhost" in referer_netloc or
                "127.0.0.1" in referer_netloc or
                referer_netloc.endswith(".render.com")
            )
            if not is_allowed:
                return Response(status_code=403, content=f"Access Denied: Origin {referer_netloc} not allowed")
    
    response = await call_next(request)
    if (path.startswith("/img/") or path.startswith("/resource/")) and response.status_code < 400:
        response.headers["Cache-Control"] = "public, max-age=86400"
    return response

# --- 静的ファイルの配信設定 ---
# 開発・本番両方で画像や音声を参照できるようにマウント
# Renderデプロイ時はfrontend-v2/publicをコピーして配置することを想定
base_dir = os.path.dirname(os.path.abspath(__file__))
# frontend-v2/public が backend と同じ階層にある場合、あるいは backend 内部にある場合の両方を考慮
public_dir = os.path.join(os.path.dirname(base_dir), "frontend-v2", "public")
if not os.path.exists(public_dir):
    # フォールバック: backendディレクトリ直下のpublicを見る
    public_dir = os.path.join(base_dir, "public")

if os.path.exists(public_dir):
    img_dir = os.path.join(public_dir, "img")
    res_dir = os.path.join(public_dir, "resource")
    if os.path.exists(img_dir):
        app.mount("/img", StaticFiles(directory=img_dir), name="img")
    if os.path.exists(res_dir):
        app.mount("/resource", StaticFiles(directory=res_dir), name="resource")

# --- 初期化 ---
sb_info_instance = SB_info()
connection_manager = ConnectionManager()
room_manager = RoomManager(sb_info_instance, connection_manager)
ws_handler = WebSocketHandler(room_manager, connection_manager)

# --- REST API ---
@app.get("/abilities")
def get_abilities_endpoint():
    return get_all_abilities_info()

# --- WebSocket ---
@app.websocket("/ws")
@app.websocket("/ws/double")
async def websocket_endpoint(websocket: WebSocket):
    await connection_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await ws_handler.handle_message(websocket, data)
    except WebSocketDisconnect:
        pid = connection_manager.get_player_id(websocket)
        left_rooms = connection_manager.disconnect(websocket)
        if pid:
            for rid in left_rooms:
                await room_manager.handle_disconnection(rid, pid)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        logger.error(traceback.format_exc())
        pid = connection_manager.get_player_id(websocket)
        left_rooms = connection_manager.disconnect(websocket)
        if pid:
            for rid in left_rooms:
                await room_manager.handle_disconnection(rid, pid)

if __name__ == "__main__":
    # Renderは環境変数PORTを指定してくるため、それに対応
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False if os.environ.get("PORT") else True)
