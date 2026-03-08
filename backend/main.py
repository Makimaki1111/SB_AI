import uvicorn
import json
import secrets
import uuid
import asyncio
import time
import logging
import traceback
from urllib.parse import urlparse
import os
from typing import List, Dict
from collections import defaultdict
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
try:
    from battle import Battle_info, battle_rooms, SB_info, get_all_abilities_info
    from double_battle import DoubleBattle_info
except ImportError:
    from backend.battle import Battle_info, battle_rooms, SB_info, get_all_abilities_info
    from backend.double_battle import DoubleBattle_info

app = FastAPI()

# --- ログ設定 ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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
    # img または resource フォルダへのアクセスの場合
    if path.startswith("/img/") or path.startswith("/resource/"):
        referer = request.headers.get("referer")
        
        # Refererヘッダーがない場合（URL直打ちなど）はアクセスを拒否
        if not referer:
            return Response(status_code=403, content="Access Denied")
            
        # Refererのホスト名が、リクエスト先のホスト名と一致しない場合は拒否（ホットリンク対策）
        request_host = request.headers.get("host")
        if request_host:
            referer_netloc = urlparse(referer).netloc
            if referer_netloc != request_host:
                return Response(status_code=403, content="Access Denied")

    response = await call_next(request)
    return response

# --- Connection Manager: WebSocket接続を管理するクラス ---
class ConnectionManager:
    def __init__(self):
        # アクティブな全接続リスト
        self.active_connections: List[WebSocket] = []
        # room_id ごとの接続リスト
        self.room_connections: Dict[str, List[WebSocket]] = defaultdict(list)
        # WebSocket -> player_id のマッピング
        self.socket_to_player_id: Dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        left_rooms = []
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        # 各部屋からも削除
        for room_id in list(self.room_connections.keys()):
            if websocket in self.room_connections[room_id]:
                self.room_connections[room_id].remove(websocket)
                left_rooms.append(room_id)
        if websocket in self.socket_to_player_id:
            del self.socket_to_player_id[websocket]
        return left_rooms

    def register_player(self, websocket: WebSocket, player_id: str):
        self.socket_to_player_id[websocket] = player_id

    def join_room(self, websocket: WebSocket, room_id: str):
        if websocket not in self.room_connections[room_id]:
            self.room_connections[room_id].append(websocket)

    async def safe_send_text(self, websocket: WebSocket, message: str) -> bool:
        try:
            await websocket.send_text(message)
            return True
        except Exception:
            # Connection already closed or disconnected.
            self.disconnect(websocket)
            return False

    async def broadcast(self, message: str, room_id: str):
        for connection in list(self.room_connections.get(room_id, [])):
            await self.safe_send_text(connection, message)

    async def broadcast_battle_state(self, room_id: str, p1_response: dict, is_double: bool = False):
        """
        ルーム内の全員に戦況を送信する。
        Player2には視点を反転させたデータを送る。
        """
        if is_double:
            if room_id not in double_battle_rooms:
                return

            battle = double_battle_rooms[room_id]
            for connection in list(self.room_connections.get(room_id, [])):
                try:
                    pid = self.socket_to_player_id.get(connection) or getattr(connection, "player_id", None)
                    p_res = battle.get_personalized_response(p1_response, pid) if pid else p1_response
                    attach_double_timer_info(room_id, p_res)
                    await self.safe_send_text(connection, json.dumps(p_res))
                except Exception as e:
                    logger.error(f"Error broadcasting double state to {pid}: {e}")
            return

        if room_id not in battle_rooms:
            return

        battle = battle_rooms[room_id]
        p2_response = battle.flip_turn_response(p1_response)

        # 相手の特性情報をマスクする (CPU戦含む)
        p1_response = battle.mask_response_for_pvp(p1_response)
        p2_response = battle.mask_response_for_pvp(p2_response)

        for connection in list(self.room_connections.get(room_id, [])):
            try:
                pid = self.socket_to_player_id.get(connection)
                if pid == battle.player2.id:
                    await self.safe_send_text(connection, json.dumps(p2_response))
                else:
                    await self.safe_send_text(connection, json.dumps(p1_response))
            except Exception as e:
                logger.error(f"Error broadcasting to {pid}: {e}")

# --- DI: アプリケーション全体で共有するインスタンスを生成 ---
sb_info_instance = SB_info()

# ユーザー情報を保存する辞書 (player_id -> {"name": str, "ability": str})
user_profiles: Dict[str, dict] = {}

# --- 既存のREST API（必要なら残してもOK） ---
class make_new_battle_info(BaseModel):
    player1_id: str
    player2_id: str

def make_new_battle(info: make_new_battle_info, p1_profile: dict = None, p2_profile: dict = None):
    bi = Battle_info(
        info.player1_id, 
        info.player2_id,
        sb_info=sb_info_instance,
        p1_profile=p1_profile,
        p2_profile=p2_profile
    )
    battle_rooms[bi.room_id] = bi
    return bi.make_init_response(info.player1_id)

@app.get("/abilities")
def get_abilities_endpoint():
    return get_all_abilities_info()

class include_check_info(BaseModel):
    room_id: str
    word: str

def include_check(info: include_check_info):
    room_id = info.room_id
    word = info.word
    if room_id not in battle_rooms:
        return {
            "type": "error",
            "message": "戦闘は終了しました"
        }
    return battle_rooms[room_id].include_check(word)

class run_away_info(BaseModel):
    room_id: str | None
    player_id: str

class turn_info(BaseModel):
    room_id: str
    player_id: str
    word: str

def turn_process(info: turn_info):
    room_id = info.room_id
    player_id = info.player_id
    word = info.word
    if room_id not in battle_rooms:
        return {
            "type": "error",
            "message": "戦闘は終了しました"
        }
    return battle_rooms[room_id].try_attack(player_id, word)

manager = ConnectionManager()

waiting_player = None # {"socket": WebSocket, "player_id": str}
private_rooms: Dict[str, Dict] = {} # {room_id: {"socket": WebSocket, "player_id": str}}

# Double Battle Global Stores
double_battle_rooms: Dict[str, DoubleBattle_info] = {}
# For double battle, room requires 2 players (1v1 double) or 4 players (2v2 double)
double_private_rooms: Dict[str, Dict] = {} # {room_id: {"mode": str, "players": [{"socket": WS, "player_id": str}]}}

# --- タイマー管理 ---
TIME_LIMIT = 20 # 秒
MAX_ROOMS = 10000 # ルーム数の上限
timer_tasks: Dict[str, asyncio.Task] = {}
double_turn_deadlines: Dict[str, float] = {}

def attach_double_timer_info(room_id: str, payload: dict) -> dict:
    if not isinstance(payload, dict):
        return payload
    deadline = double_turn_deadlines.get(room_id)
    if deadline is not None:
        payload["turn_deadline_ms"] = int(deadline * 1000)
    else:
        payload.pop("turn_deadline_ms", None)
    return payload

async def timeout_handler(room_id: str):
    try:
        # 制限時間待機
        await asyncio.sleep(TIME_LIMIT)
        
        if room_id in battle_rooms:
            battle = battle_rooms[room_id]
            # タイムアウト処理実行
            res = battle.timeout()
            await manager.broadcast_battle_state(room_id, res)
            
            # ゲーム終了判定
            if battle.player1_win is not None:
                stop_turn_timer(room_id)
                if room_id in battle_rooms:
                    del battle_rooms[room_id]
            else:
                # CPU戦でプレイヤーがタイムアウトした場合、CPUのターンを即座に処理
                if battle.is_cpu and not battle.player1_turn:
                    await asyncio.sleep(1)
                    cpu_res = battle.execute_cpu_turn()
                    if cpu_res:
                        await manager.broadcast_battle_state(room_id, cpu_res)
                        # CPUのターンで決着がついた場合
                        if battle.player1_win is not None:
                            if room_id in battle_rooms:
                                del battle_rooms[room_id]
                
                # 次のターンのタイマー開始（ゲームが続いていれば）
                if battle.player1_win is None:
                    await start_turn_timer(room_id)
                    
    except asyncio.CancelledError:
        pass

async def start_turn_timer(room_id: str):
    # CPU戦の場合はタイマーを起動しない
    if room_id in battle_rooms and battle_rooms[room_id].is_cpu:
        return

    stop_turn_timer(room_id)
    timer_tasks[room_id] = asyncio.create_task(timeout_handler(room_id))

def stop_turn_timer(room_id: str):
    if room_id in timer_tasks:
        timer_tasks[room_id].cancel()
        del timer_tasks[room_id]

async def double_timeout_handler(room_id: str):
    try:
        await asyncio.sleep(TIME_LIMIT)
        if room_id in double_battle_rooms:
            battle = double_battle_rooms[room_id]
            res = battle.timeout()
            await manager.broadcast_battle_state(room_id, res, is_double=True)

            if battle.team1_win is not None:
                stop_double_turn_timer(room_id)
                if room_id in double_battle_rooms:
                    del double_battle_rooms[room_id]
            else:
                if battle.is_cpu and battle.current_turn_team != "team1":
                    await asyncio.sleep(1)
                    cpu_res = battle.execute_cpu_turn()
                    if cpu_res:
                        await manager.broadcast_battle_state(room_id, cpu_res, is_double=True)
                
                if battle.team1_win is not None:
                    if room_id in double_battle_rooms:
                        del double_battle_rooms[room_id]
                
                if battle.team1_win is None:
                    await start_double_turn_timer(room_id)
    except asyncio.CancelledError:
        pass

async def start_double_turn_timer(room_id: str):
    if room_id in double_battle_rooms and double_battle_rooms[room_id].is_cpu:
        double_turn_deadlines.pop(room_id, None)
        return
    stop_double_turn_timer(room_id)
    double_turn_deadlines[room_id] = time.time() + TIME_LIMIT
    timer_tasks[room_id] = asyncio.create_task(double_timeout_handler(room_id))

def stop_double_turn_timer(room_id: str):
    if room_id in timer_tasks:
        timer_tasks[room_id].cancel()
        del timer_tasks[room_id]
    double_turn_deadlines.pop(room_id, None)


# --- WebSocket対応部分 ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    global waiting_player
    try:
        while True:
            try:
                data = await websocket.receive_text()
            except WebSocketDisconnect:
                raise
            except RuntimeError as e:
                logger.info(f"WebSocket receive ended: {e}")
                raise WebSocketDisconnect(code=1006)

            try:
                req = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "message": "Invalid JSON"}))
                continue
            
            # player_id の長さチェック (DoS対策)
            if "info" in req and "player_id" in req["info"]:
                if len(str(req["info"]["player_id"])) > 64:
                    await websocket.send_text(json.dumps({"type": "error", "message": "Invalid player_id"}))
                    continue
            
            # --- ユーザー情報更新 ---
            try:
                if req.get("type") == "update_user_info":
                    info = req.get("info", {})
                    player_id = info.get("player_id")
                    name = info.get("name")
                    ability = info.get("ability")
                    if player_id:
                        # 名前が文字列でない場合はデフォルト値にする（エラー回避）
                        if not isinstance(name, str):
                            name = "じぶん"

                        # 名前を8文字以内に制限
                        if len(name) > 8:
                            name = name[:8]

                        user_profiles[player_id] = {"name": name, "ability": ability}
                        await websocket.send_text(json.dumps({"type": "user_info_updated", "message": "ユーザー情報を更新しました"}))

            # --- マッチメイキング処理 ---
                elif req.get("type") == "find_match":
                    # 本番環境（Render等）ではランダムマッチを無効化
                    if os.getenv("RENDER") or os.getenv("DISABLE_RANDOM_MATCH"):
                        await websocket.send_text(json.dumps({"type": "error", "message": "ランダムマッチは現在無効です"}))
                        continue

                    info = req.get("info", {})
                    player_id = info.get("player_id")
                    manager.register_player(websocket, player_id)

                    if waiting_player is not None:
                        if waiting_player["player_id"] == player_id:
                            continue
                        
                        # ルーム数制限
                        if len(battle_rooms) >= MAX_ROOMS:
                            await websocket.send_text(json.dumps({"type": "error", "message": "サーバーが混雑しています"}))
                            continue

                        # 競合対策: 待機プレイヤーを即座に取り出す
                        p1_data = waiting_player
                        waiting_player = None
                        
                        p2_data = {"socket": websocket, "player_id": player_id}
                        
                        p1_profile = user_profiles.get(p1_data["player_id"])
                        p2_profile = user_profiles.get(p2_data["player_id"])

                        bi = Battle_info(p1_data["player_id"], p2_data["player_id"], sb_info=sb_info_instance, p1_profile=p1_profile, p2_profile=p2_profile)
                        battle_rooms[bi.room_id] = bi

                        manager.join_room(p1_data["socket"], bi.room_id)
                        manager.join_room(p2_data["socket"], bi.room_id)

                        await p1_data["socket"].send_text(json.dumps(bi.make_init_response(p1_data["player_id"])))
                        await p2_data["socket"].send_text(json.dumps(bi.make_init_response(p2_data["player_id"])))
                        
                        await start_turn_timer(bi.room_id)

                    else:
                        waiting_player = {"socket": websocket, "player_id": player_id}
                        await websocket.send_text(json.dumps({"type": "waiting", "message": "対戦相手を探しています..."}))

                elif req.get("type") == "join_private_room":
                    info = req.get("info", {})
                    player_id = info.get("player_id")
                    room_id = info.get("room_id")
                    manager.register_player(websocket, player_id)

                    if room_id: # Join existing room
                        if room_id in private_rooms:
                            # ルーム数制限
                            if len(battle_rooms) >= MAX_ROOMS:
                                await websocket.send_text(json.dumps({"type": "error", "message": "サーバーが混雑しています"}))
                                continue

                            # 競合対策: ルームを即座に取り出す
                            p1_data = private_rooms.pop(room_id)
                            
                            if p1_data["player_id"] == player_id:
                                continue

                            p2_data = {"socket": websocket, "player_id": player_id}
                            
                            p1_profile = user_profiles.get(p1_data["player_id"])
                            p2_profile = user_profiles.get(p2_data["player_id"])

                            bi = Battle_info(p1_data["player_id"], p2_data["player_id"], sb_info=sb_info_instance, room_id=room_id, p1_profile=p1_profile, p2_profile=p2_profile)
                            battle_rooms[bi.room_id] = bi

                            manager.join_room(p1_data["socket"], bi.room_id)
                            manager.join_room(p2_data["socket"], bi.room_id)

                            await p1_data["socket"].send_text(json.dumps(bi.make_init_response(p1_data["player_id"])))
                            await p2_data["socket"].send_text(json.dumps(bi.make_init_response(p2_data["player_id"])))
                            
                            await start_turn_timer(bi.room_id)
                        else:
                            await websocket.send_text(json.dumps({"type": "error", "message": "ルームが見つかりません"}))
                    else: # Create new room
                        # ルーム数制限 (DoS対策)
                        if len(private_rooms) >= MAX_ROOMS:
                            await websocket.send_text(json.dumps({"type": "error", "message": "サーバーが混雑しています"}))
                            continue

                        while True:
                            new_room_id = f"{secrets.randbelow(1000000):06d}"
                            if new_room_id not in private_rooms: break
                        private_rooms[new_room_id] = {"socket": websocket, "player_id": player_id}
                        await websocket.send_text(json.dumps({"type": "private_room_created", "room_id": new_room_id}))

            # typeで分岐し、既存の関数を利用
                elif req.get("type") == "make_new_battle":
                    # ルーム数制限
                    if len(battle_rooms) >= MAX_ROOMS:
                        await websocket.send_text(json.dumps({"type": "error", "message": "サーバーが混雑しています"}))
                        continue

                    info = req.get("info", {})
                    model = make_new_battle_info(**info)
                    manager.register_player(websocket, model.player1_id)
                    p1_profile = user_profiles.get(model.player1_id)
                    p2_profile = user_profiles.get(model.player2_id)
                    res = make_new_battle(model, p1_profile, p2_profile)
                    # 部屋作成時は送信元を部屋に登録
                    manager.join_room(websocket, res["room_id"])
                    await websocket.send_text(json.dumps(res)) # 作成者には直接応答
                    
                    # CPU戦でCPU先行の場合、初手を実行する
                    room_id = res["room_id"]
                    if room_id in battle_rooms:
                        battle = battle_rooms[room_id]
                        if battle.is_cpu and not battle.player1_turn:
                            await asyncio.sleep(1.5) # クライアントの準備待ち
                            cpu_res = battle.execute_cpu_turn()
                            if cpu_res:
                                await manager.broadcast_battle_state(room_id, cpu_res)

                    # タイマー開始
                    await start_turn_timer(res["room_id"])

                elif req.get("type") == "include_check":
                    info = req.get("info", {})
                    model = include_check_info(**info)
                    res = include_check(model)
                    
                    # 単語長チェック
                    if len(model.word) > 200:
                        res = {"type": "pre_check", "include": False, "used": False}

                    await websocket.send_text(json.dumps(res)) # チェック結果は本人だけでOK

                elif req.get("type") == "submit_word":
                    info = req.get("info", {})
                    model = turn_info(**info)
                    
                    # セキュリティチェック: 送信元ソケットとplayer_idの一致確認
                    if manager.socket_to_player_id.get(websocket) != model.player_id:
                        continue

                    # 単語長チェック
                    if len(model.word) > 200:
                        await websocket.send_text(json.dumps({"type": "error", "message": "単語が長すぎます"}))
                        continue

                    res = turn_process(model)
                    
                    # エラーの場合はタイマーをリセットせず、送信元にのみ返す
                    if res.get("type") == "error":
                        await websocket.send_text(json.dumps(res))
                    else:
                        # 正常な手番の場合はタイマー停止
                        stop_turn_timer(model.room_id)
                        # 結果を部屋全員に送信
                        await manager.broadcast_battle_state(model.room_id, res)
                        
                        # 勝敗が決まったらルームを削除
                        if battle_rooms[model.room_id].player1_win is not None:
                            del battle_rooms[model.room_id]

                        # --- CPU自動攻撃処理 ---
                        # バトルルーム取得
                        room_id = getattr(model, 'room_id', None)
                        if room_id and room_id in battle_rooms:
                            battle = battle_rooms[room_id] # type: Battle_info
                            
                            # 勝敗が決まっていなければ次の処理へ
                            if battle.player1_win is None:
                                # CPU戦で、プレイヤーの攻撃後にCPUのターンになる場合
                                if battle.is_cpu and not battle.player1_turn:
                                    cpu_res = battle.execute_cpu_turn()
                                    if cpu_res: await manager.broadcast_battle_state(room_id, cpu_res)
                                    
                                    # CPUのターンで決着がついた場合
                                    if battle.player1_win is not None:
                                        del battle_rooms[room_id]
                                
                                # まだ勝敗が決まっていなければ次のターンのタイマー開始
                                if battle.player1_win is None:
                                    await start_turn_timer(room_id)

                elif req.get("type") == "run_away":
                    info = req.get("info", {})
                    model = run_away_info(**info)
                    
                    # セキュリティチェック
                    if manager.socket_to_player_id.get(websocket) != model.player_id:
                        continue

                    if model.room_id in battle_rooms:
                        stop_turn_timer(model.room_id)
                        
                        battle = battle_rooms[model.room_id]
                        # 逃亡を降参として処理し、相手に通知を送る
                        res = battle.handle_disconnection(model.player_id, message="あいてが逃げ出しました。")
                        if res:
                            await manager.broadcast_battle_state(model.room_id, res)

                        del battle_rooms[model.room_id]
                        logger.info(f"Battle room {model.room_id} was removed because a player ran away.")

                elif req.get("type") == "change_ability":
                    info = req.get("info", {})
                    room_id = info.get("room_id")
                    player_id = info.get("player_id")
                    new_ability_id = info.get("ability_id")

                    # セキュリティチェック
                    if manager.socket_to_player_id.get(websocket) != player_id:
                        continue

                    if not new_ability_id:
                        await websocket.send_text(json.dumps({"type": "error", "message": "変更先の特性が指定されていません"}))
                        continue

                    if room_id in battle_rooms:
                        battle = battle_rooms[room_id]
                        res = battle.change_ability(player_id, new_ability_id)

                        if res.get("type") == "error":
                            await websocket.send_text(json.dumps(res))
                        else:
                            # ターンは消費しないのでタイマーは操作しない
                            await manager.broadcast_battle_state(room_id, res)
                    else:
                        await websocket.send_text(json.dumps({"type": "error", "message": "ルームが見つかりません"}))

                else:
                    await websocket.send_text(json.dumps({"type": "error", "message": "Unknown type"}))
            
            except Exception as e:
                logger.error(f"Unexpected error in WebSocket loop: {e}")
                logger.error(traceback.format_exc())
                await websocket.send_text(json.dumps({"type": "error", "message": "サーバー内部エラーが発生しました"}))
    
    except WebSocketDisconnect:
        # 待機中のプレイヤーが切断した場合
        if waiting_player and waiting_player["socket"] == websocket:
            waiting_player = None
        
        # プライベートルームにいたら削除
        player_id_to_remove = manager.socket_to_player_id.get(websocket)
        room_to_remove = None
        for room_id, data in private_rooms.items():
            if data.get("player_id") == player_id_to_remove:
                room_to_remove = room_id
                break
        if room_to_remove:
            del private_rooms[room_to_remove]
            logger.info(f"Private room {room_to_remove} was removed due to disconnection.")

        disconnected_player_id = manager.socket_to_player_id.get(websocket)
        
        # メモリリーク防止: 切断したユーザーのプロフィールを削除
        if disconnected_player_id and disconnected_player_id in user_profiles:
            del user_profiles[disconnected_player_id]

        left_rooms = manager.disconnect(websocket) # disconnect()内でsocket_to_player_idから削除される

        for room_id in left_rooms:
            stop_turn_timer(room_id)
            if room_id in battle_rooms:
                battle = battle_rooms[room_id]

                # 切断による勝敗決定
                res = battle.handle_disconnection(disconnected_player_id)
                if res:
                    # 残っているプレイヤーに結果を送信
                    await manager.broadcast_battle_state(room_id, res)

                # バトルルームを削除
                del battle_rooms[room_id]
                logger.info(f"Battle room {room_id} was removed due to disconnection.")

        logger.info("WebSocket切断・登録解除")



# --- ダブルバトル用 WebSocket対応部分 ---
@app.websocket("/ws/double")
async def websocket_double_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            try:
                data = await websocket.receive_text()
            except WebSocketDisconnect:
                raise
            except RuntimeError as e:
                logger.info(f"Double websocket receive ended: {e}")
                raise WebSocketDisconnect(code=1006)

            try:
                req = json.loads(data)
            except json.JSONDecodeError:
                await manager.safe_send_text(websocket, json.dumps({"type": "error", "message": "Invalid JSON"}))
                continue
            
            # player_id の長さチェック
            if "info" in req and "player_id" in req["info"]:
                if len(str(req["info"]["player_id"])) > 64:
                    await manager.safe_send_text(websocket, json.dumps({"type": "error", "message": "Invalid player_id"}))
                    continue

            try:
                # ユーザー情報の更新
                if req.get("type") == "update_user_info":
                    info = req.get("info", {})
                    player_id = info.get("player_id")
                    name = info.get("name")
                    ability = info.get("ability")
                    ability_2 = info.get("ability_2")
                    if player_id:
                        if not isinstance(name, str): name = "じぶん"
                        if len(name) > 8: name = name[:8]
                        user_profiles[player_id] = {"name": name, "ability": ability, "ability_2": ability_2}
                        await manager.safe_send_text(websocket, json.dumps({"type": "user_info_updated", "message": "ユーザー情報を更新しました"}))

                # ルーム作成
                elif req.get("type") == "create_double_room":
                    logger.info("hit create_double_room")
                    info = req.get("info", {})
                    player_id = info.get("player_id")
                    mode = info.get("mode", "1v1_double")  # 1v1_double or 2v2_double

                    if mode not in ["1v1_double", "2v2_double"]:
                        await manager.safe_send_text(websocket, json.dumps({"type": "error", "message": "Invalid mode"}))
                        continue

                    logger.info(f"registering player_id: {player_id}")
                    manager.register_player(websocket, player_id)

                    # ルーム数制限
                    if len(double_private_rooms) >= MAX_ROOMS:
                        await manager.safe_send_text(websocket, json.dumps({"type": "error", "message": "サーバーが混雑しています"}))
                        continue

                    while True:
                        new_room_id = f"{secrets.randbelow(1000000):06d}"
                        if new_room_id not in double_private_rooms: break
                    
                    logger.info(f"created room id: {new_room_id}")
                    double_private_rooms[new_room_id] = {
                        "mode": mode,
                        "players": [{"socket": websocket, "player_id": player_id}]
                    }
                    logger.info("sending double_room_created text")
                    await manager.safe_send_text(websocket, json.dumps({"type": "double_room_created", "room_id": new_room_id, "mode": mode}))
                    logger.info("success create_double_room")

                # CPU戦ルーム作成＆参加 (デバッグ用)
                elif req.get("type") == "join_double_cpu_room":
                    # ルーム数制限
                    if len(double_battle_rooms) >= MAX_ROOMS:
                        await manager.safe_send_text(websocket, json.dumps({"type": "error", "message": "サーバーが混雑しています"}))
                        continue

                    info = req.get("info", {})
                    player_id = info.get("player_id")
                    manager.register_player(websocket, player_id)

                    room_id = f"cpu_double_{uuid.uuid4().hex[:6]}"
                    mode = "1v1_double"
                    
                    team1_ids = [player_id]
                    team2_ids = ["cpu_p2a", "cpu_p2b"]

                    bi = DoubleBattle_info(mode, team1_ids, team2_ids, sb_info=sb_info_instance, room_id=room_id, profiles=user_profiles, is_cpu=True)
                    double_battle_rooms[bi.room_id] = bi

                    manager.join_room(websocket, bi.room_id)
                    setattr(websocket, "player_id", player_id)
                    init_res = bi._make_response()
                    p_init_res = bi.get_personalized_response(init_res, player_id)
                    p_init_res["type"] = "init_double_battle"
                    await manager.safe_send_text(websocket, json.dumps(p_init_res))

                    # ダブルバトル: CPU先行時の処理
                    # CPUチーム(team2)のターンであれば実行
                    current_actor = bi.get_current_actor()
                    if current_actor in bi.team2:
                        # 連続行動の可能性も考慮してループ
                        while bi.is_cpu and bi.get_current_actor().owner_id.startswith("cpu_") and bi.team1_win is None:
                            await asyncio.sleep(1.5)
                            cpu_res = bi.execute_cpu_turn()
                            if cpu_res:
                                await manager.broadcast_battle_state(bi.room_id, cpu_res, is_double=True)
                                if bi.team1_win is not None:
                                    stop_double_turn_timer(bi.room_id)
                                    del double_battle_rooms[bi.room_id]
                                    break

                # ルーム参加
                elif req.get("type") == "join_double_room":
                    info = req.get("info", {})
                    player_id = info.get("player_id")
                    room_id = info.get("room_id")
                    manager.register_player(websocket, player_id)

                    if room_id and room_id in double_private_rooms:
                        room_data = double_private_rooms[room_id]
                        mode = room_data["mode"]
                        players = room_data["players"]
                        target_player_count = 2 if mode == "1v1_double" else 4

                        # 競合対策: 定員チェック
                        if len(players) >= target_player_count:
                            await manager.safe_send_text(websocket, json.dumps({"type": "error", "message": "ルームは満員です"}))
                            continue

                        # 既に参加済みの場合は無視
                        if any(p["player_id"] == player_id for p in players):
                            continue

                        players.append({"socket": websocket, "player_id": player_id})

                        # メンバーが揃った場合、バトル開始
                        if len(players) == target_player_count:
                            # ルーム数制限
                            if len(double_battle_rooms) >= MAX_ROOMS:
                                await manager.safe_send_text(websocket, json.dumps({"type": "error", "message": "サーバーが混雑しています"}))
                                continue

                            # 競合対策: 即座にルームリストから削除
                            del double_private_rooms[room_id]

                            if mode == "1v1_double":
                                team1_ids = [players[0]["player_id"]]
                                team2_ids = [players[1]["player_id"]]
                            else: # 2v2_double
                                team1_ids = [players[0]["player_id"], players[1]["player_id"]]
                                team2_ids = [players[2]["player_id"], players[3]["player_id"]]

                            bi = DoubleBattle_info(mode, team1_ids, team2_ids, sb_info=sb_info_instance, room_id=room_id, profiles=user_profiles)
                            double_battle_rooms[bi.room_id] = bi

                            await start_double_turn_timer(bi.room_id)
                            for p in players:
                                manager.join_room(p["socket"], bi.room_id)
                                setattr(p["socket"], "player_id", p["player_id"])
                                init_res = bi._make_response()
                                p_init_res = bi.get_personalized_response(init_res, p["player_id"])
                                p_init_res["type"] = "init_double_battle"
                                attach_double_timer_info(bi.room_id, p_init_res)
                                await manager.safe_send_text(p["socket"], json.dumps(p_init_res))
                        else:
                            # 待機状態を全メンバーに通知
                            for p in players:
                                await manager.safe_send_text(p["socket"], json.dumps({
                                    "type": "waiting_for_players", 
                                    "current": len(players), 
                                    "required": target_player_count
                                }))
                    else:
                        await manager.safe_send_text(websocket, json.dumps({"type": "error", "message": "ルームが見つかりません"}))

                # 単語送信（攻撃）
                elif req.get("type") == "submit_word_double":
                    info = req.get("info", {})
                    room_id = info.get("room_id")
                    player_id = info.get("player_id")
                    word = info.get("word")
                    target_char_id = info.get("target_char_id")

                    # セキュリティチェック
                    if manager.socket_to_player_id.get(websocket) != player_id:
                        continue

                    # 単語長チェック
                    if len(word) > 200:
                        await manager.safe_send_text(websocket, json.dumps({"type": "error", "message": "単語が長すぎます"}))
                        continue

                    if room_id in double_battle_rooms:
                        battle = double_battle_rooms[room_id]
                        res = battle.try_attack(player_id, word, target_char_id)
                        
                        if res.get("type") == "error":
                            await manager.safe_send_text(websocket, json.dumps(res))
                        else:
                            if battle.team1_win is None:
                                await start_double_turn_timer(room_id)

                            for p in list(manager.room_connections.get(room_id, [])):
                                p_id = getattr(p, "player_id", None)
                                p_res = battle.get_personalized_response(res, p_id) if p_id else res
                                attach_double_timer_info(room_id, p_res)
                                await manager.safe_send_text(p, json.dumps(p_res))
                            
                            # 勝負がついた場合はタイマー停止と部屋削除
                            if battle.team1_win is not None:
                                stop_double_turn_timer(room_id)
                                del double_battle_rooms[room_id]
                                logger.info(f"Double battle room {room_id} was removed because a team won.")
                                
                            # CPUの連続ターンの可能性も考慮してループ (p1bも死んでいて敵2連続行動の場合など)
                            while battle.is_cpu and battle.get_current_actor().owner_id.startswith("cpu_") and not battle.team1_win is not None:
                                await asyncio.sleep(1.0) # CPUの思考時間の演出
                                cpu_res = battle.execute_cpu_turn()
                                if cpu_res:
                                    for p in list(manager.room_connections.get(room_id, [])):
                                        p_id = getattr(p, "player_id", None)
                                        p_res = battle.get_personalized_response(cpu_res, p_id) if p_id else cpu_res
                                        attach_double_timer_info(room_id, p_res)
                                        await manager.safe_send_text(p, json.dumps(p_res))
                                    
                                    if battle.team1_win is not None:
                                        stop_double_turn_timer(room_id)
                                        del double_battle_rooms[room_id]
                                        break
                    else:
                        await manager.safe_send_text(websocket, json.dumps({"type": "error", "message": "戦闘は終了しました"}))

                # 逃げる処理
                elif req.get("type") == "run_away_double":
                    info = req.get("info", {})
                    room_id = info.get("room_id")
                    player_id = info.get("player_id")

                    # セキュリティチェック
                    if manager.socket_to_player_id.get(websocket) != player_id:
                        continue

                    if room_id in double_battle_rooms:
                        battle = double_battle_rooms[room_id]
                        res = battle.handle_disconnection(player_id, message="あいてが逃げ出しました。")
                        if res:
                            for p in list(manager.room_connections.get(room_id, [])):
                                p_id = getattr(p, "player_id", None)
                                p_res = battle.get_personalized_response(res, p_id) if p_id else res
                                attach_double_timer_info(room_id, p_res)
                                await manager.safe_send_text(p, json.dumps(p_res))
                            # 勝負がついた場合は部屋を削除
                            if battle.team1_win is not None:
                                del double_battle_rooms[room_id]
                                logger.info(f"Double battle room {room_id} was removed because a team won/fled.")
                        else:
                            # まだ勝負が続いていれば現状をブロードキャスト
                            # (誰かが死んだだけの状態)
                            pass
                    else:
                        await manager.safe_send_text(websocket, json.dumps({"type": "error", "message": "戦闘は終了しました"}))

                # タイプチェック（入力中プレビュー）
                elif req.get("type") == "include_check_double":
                    info = req.get("info", {})
                    room_id = info.get("room_id")
                    word = info.get("word", "")

                    # 単語長チェック
                    if len(word) > 200:
                        await manager.safe_send_text(websocket, json.dumps({"type": "pre_check", "include": False, "used": False}))
                        continue

                    if room_id in double_battle_rooms:
                        battle = double_battle_rooms[room_id]
                        res = battle.include_check(word)
                        await manager.safe_send_text(websocket, json.dumps(res))
                    else:
                        await manager.safe_send_text(websocket, json.dumps({"type": "error", "message": "戦闘は終了しました"}))

                # 特性変更
                elif req.get("type") == "change_ability_double":
                    info = req.get("info", {})
                    room_id = info.get("room_id")
                    player_id = info.get("player_id")
                    char_id = info.get("char_id")
                    ability_id = info.get("ability_id")

                    # セキュリティチェック
                    if manager.socket_to_player_id.get(websocket) != player_id:
                        continue

                    if room_id in double_battle_rooms:
                        battle = double_battle_rooms[room_id]
                        res = battle.change_ability(player_id, char_id, ability_id)
                        if res.get("type") == "error":
                            await manager.safe_send_text(websocket, json.dumps(res))
                        else:
                            for p in list(manager.room_connections.get(room_id, [])):
                                p_id = getattr(p, "player_id", None)
                                p_res = battle.get_personalized_response(res, p_id) if p_id else res
                                attach_double_timer_info(room_id, p_res)
                                await manager.safe_send_text(p, json.dumps(p_res))
                    else:
                        await manager.safe_send_text(websocket, json.dumps({"type": "error", "message": "戦闘は終了しました"}))

                else:
                    await manager.safe_send_text(websocket, json.dumps({"type": "error", "message": "Unknown type for double setup"}))
            except Exception as e:
                logger.error(f"Unexpected error in /ws/double loop: {e}")
                logger.error(traceback.format_exc())
                await manager.safe_send_text(websocket, json.dumps({"type": "error", "message": "サーバー内部エラーが発生しました"}))
        
    except WebSocketDisconnect:
        player_id_to_remove = manager.socket_to_player_id.get(websocket)
        room_to_remove = None
        for room_id, data in double_private_rooms.items():
            for i, p in enumerate(data["players"]):
                if p["player_id"] == player_id_to_remove:
                    data["players"].pop(i)
                    if len(data["players"]) == 0:
                        room_to_remove = room_id
                    break
        if room_to_remove:
            del double_private_rooms[room_to_remove]
            logger.info(f"Double private room {room_to_remove} removed.")

        # 実際の切断プレイヤーIDを取得
        disconnected_player_id = manager.socket_to_player_id.get(websocket)

        # メモリリーク防止: 切断したユーザーのプロフィールを削除
        if disconnected_player_id and disconnected_player_id in user_profiles:
            del user_profiles[disconnected_player_id]

        left_rooms = manager.disconnect(websocket)
        for room_id in left_rooms:
            if room_id in double_battle_rooms:
                battle = double_battle_rooms[room_id]
                
                # 切断によるキャラ死亡/勝敗決定
                if disconnected_player_id:
                    res = battle.handle_disconnection(disconnected_player_id, message="あいてとの通信が切断されました。")
                    if res:
                        # まだ接続しているプレイヤーに結果を送信
                        await manager.broadcast(json.dumps(res), room_id)
                        
                        # 勝敗がついた場合は部屋を削除
                        if battle.team1_win is not None:
                            del double_battle_rooms[room_id]
                            logger.info(f"Double battle room {room_id} was removed due to disconnection/team wipe.")
                else:
                    # プレイヤーIDが取れない例外的な場合は強制終了
                    abort_msg = json.dumps({"type": "error", "message": "対戦相手との通信が切断されました"})
                    await manager.broadcast(abort_msg, room_id)
                    del double_battle_rooms[room_id]
                    logger.info(f"Double battle room {room_id} was destroyed exceptionally.")


# --- 静的ファイルの配信設定 (必ず最後に追加) ---
# backendディレクトリの親ディレクトリにあるfrontendディレクトリを取得
current_dir = os.path.dirname(os.path.abspath(__file__))
frontend_dir = os.path.join(os.path.dirname(current_dir), "frontend")

# ルートURLでフロントエンドを配信 (html=Trueでindex.htmlを自動的に返す)
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
