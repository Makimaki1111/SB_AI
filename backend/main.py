import uvicorn
import re
import json
import secrets
import uuid
import asyncio
import time
import logging
import traceback
from urllib.parse import urlparse
import os
from typing import List, Dict, Optional
from collections import defaultdict
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
        # 開発環境や特定のホストからのアクセスを許可
        if referer:
            referer_netloc = urlparse(referer).netloc
            request_host = request.headers.get("host")
            allowed_hosts = [
                request_host, 
                "localhost:5173", 
                "127.0.0.1:5173", 
                "shiritori-battle.render.com"
            ]
            if referer_netloc not in allowed_hosts:
                return Response(status_code=403, content=f"Access Denied: Origin {referer_netloc} not allowed")
        # Refererがない場合は一旦許可（開発中のデバッグ等を考慮）
        # 本番環境ではより厳格にする必要がある
        pass

    response = await call_next(request)
    if (path.startswith("/img/") or path.startswith("/resource/")) and response.status_code < 400:
        response.headers["Cache-Control"] = "public, max-age=86400"
    return response

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
    # すべてのオリジンからのWebSocket接続を許可
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
                room_manager.start_grace_period(rid, pid, delay=20)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        logger.error(traceback.format_exc())
        pid = connection_manager.get_player_id(websocket)
        left_rooms = connection_manager.disconnect(websocket)
        if pid:
            for rid in left_rooms:
                room_manager.start_grace_period(rid, pid, delay=20)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
