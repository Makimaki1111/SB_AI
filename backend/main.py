import uvicorn
import json
import asyncio
from typing import List, Dict
from collections import defaultdict
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
try:
    from battle import Battle_info, battle_rooms, SB_info, GOOGLE_AI
except ImportError:
    from backend.battle import Battle_info, battle_rooms, SB_info, GOOGLE_AI

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Connection Manager: WebSocket接続を管理するクラス ---
class ConnectionManager:
    def __init__(self):
        # アクティブな全接続リスト
        self.active_connections: List[WebSocket] = []
        # room_id ごとの接続リスト
        self.room_connections: Dict[str, List[WebSocket]] = defaultdict(list)

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
        return left_rooms

    def join_room(self, websocket: WebSocket, room_id: str):
        if websocket not in self.room_connections[room_id]:
            self.room_connections[room_id].append(websocket)

    async def broadcast(self, message: str, room_id: str):
        for connection in self.room_connections[room_id]:
            await connection.send_text(message)

# --- DI: アプリケーション全体で共有するインスタンスを生成 ---
sb_info_instance = SB_info()
google_ai_instance = GOOGLE_AI()

# --- 既存のREST API（必要なら残してもOK） ---
class make_new_battle_info(BaseModel):
    player1_id: str
    player2_id: str

def make_new_battle(info: make_new_battle_info):
    bi = Battle_info(
        info.player1_id, 
        info.player2_id,
        sb_info=sb_info_instance,
        google_ai=google_ai_instance
    )
    battle_rooms[bi.room_id] = bi
    return {
        "type": "made_room",
        "message": "バトルルーム作成",
        "room_id": bi.room_id,
        "state" : {
            "is_my_turn" : bi.player1_turn,
            "character" : bi.character
        },
        "ally" : {
            "max_hp" : bi.MAX_HP,
            "name" : bi.player1.name
        },
        "foe" : {
            "max_hp" : bi.MAX_HP,
            "name" : bi.player2.name
        }
    }

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
    room_id: str
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

# --- タイマー管理 ---
TIME_LIMIT = 20 # 秒
timer_tasks: Dict[str, asyncio.Task] = {}

async def timeout_handler(room_id: str):
    try:
        # 制限時間待機
        await asyncio.sleep(TIME_LIMIT)
        
        if room_id in battle_rooms:
            battle = battle_rooms[room_id]
            # タイムアウト処理実行
            res = battle.timeout()
            await manager.broadcast(json.dumps(res), room_id)
            
            # ゲーム終了判定
            if battle.player1_win is not None:
                stop_turn_timer(room_id)
            else:
                # CPU戦でプレイヤーがタイムアウトした場合、CPUのターンを即座に処理
                if battle.is_cpu and not battle.player1_turn:
                    await asyncio.sleep(1)
                    cpu_res = battle.execute_cpu_turn()
                    if cpu_res:
                        await manager.broadcast(json.dumps(cpu_res), room_id)
                
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

# --- WebSocket対応部分 ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                req = json.loads(data)
            except Exception:
                await manager.broadcast(json.dumps({"type": "error", "message": "Invalid JSON"}), "") # エラーは送信元だけに返すべきだが簡略化
                continue
            
            # typeで分岐し、既存の関数を利用
            if req.get("type") == "make_new_battle":
                info = req.get("info", {})
                model = make_new_battle_info(**info)
                res = make_new_battle(model)
                # 部屋作成時は送信元を部屋に登録
                manager.join_room(websocket, res["room_id"])
                await websocket.send_text(json.dumps(res)) # 作成者には直接応答
                # タイマー開始
                await start_turn_timer(res["room_id"])

            elif req.get("type") == "include_check":
                info = req.get("info", {})
                model = include_check_info(**info)
                res = include_check(model)
                await websocket.send_text(json.dumps(res)) # チェック結果は本人だけでOK

            elif req.get("type") == "submit_word":
                info = req.get("info", {})
                model = turn_info(**info)
                res = turn_process(model)
                
                # エラーの場合はタイマーをリセットせず、送信元にのみ返す
                if res.get("type") == "error":
                    await websocket.send_text(json.dumps(res))
                else:
                    # 正常な手番の場合はタイマー停止
                    stop_turn_timer(model.room_id)
                    # 結果を部屋全員に送信
                    await manager.broadcast(json.dumps(res), model.room_id)

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
                                if cpu_res: await manager.broadcast(json.dumps(cpu_res), room_id)
                            
                            # まだ勝敗が決まっていなければ次のターンのタイマー開始
                            if battle.player1_win is None:
                                await start_turn_timer(room_id)

            elif req.get("type") == "run_away":
                info = req.get("info", {})
                model = run_away_info(**info)
                if model.room_id in battle_rooms:
                    stop_turn_timer(model.room_id)
                    del battle_rooms[model.room_id]
                    print(f"Battle room {model.room_id} was removed because a player ran away.")

            else:
                await websocket.send_text(json.dumps({"type": "error", "message": "Unknown type"}))
    
    except WebSocketDisconnect:
        left_rooms = manager.disconnect(websocket)
        for room_id in left_rooms:
            stop_turn_timer(room_id)
        print("WebSocket切断・登録解除")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)