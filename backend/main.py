import uvicorn
import json
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

    async def broadcast(self, message: str, room_id: str):
        for connection in self.room_connections[room_id]:
            await connection.send_text(message)

    async def broadcast_battle_state(self, room_id: str, p1_response: dict):
        """
        ルーム内の全員に戦況を送信する。
        Player2には視点を反転させたデータを送る。
        """
        if room_id not in battle_rooms:
            return

        battle = battle_rooms[room_id]
        # P2用のレスポンスを作成（P1用を反転）
        p2_response = battle.flip_turn_response(p1_response)

        for connection in self.room_connections[room_id]:
            pid = self.socket_to_player_id.get(connection)
            # Player2なら反転データを送る
            if pid == battle.player2.id:
                await connection.send_text(json.dumps(p2_response))
            else:
                await connection.send_text(json.dumps(p1_response))

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

class find_match_info(BaseModel):
    player_id: str

waiting_player = None # {"socket": WebSocket, "player_id": str}
manager = ConnectionManager()

# --- WebSocket対応部分 ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        global waiting_player

        while True:
            data = await websocket.receive_text()
            try:
                req = json.loads(data)
            except Exception:
                await manager.broadcast(json.dumps({"type": "error", "message": "Invalid JSON"}), "") # エラーは送信元だけに返すべきだが簡略化
                continue
            
            # --- マッチメイキング処理 ---
            if req.get("type") == "find_match":
                info = req.get("info", {})
                player_id = info.get("player_id")
                manager.register_player(websocket, player_id)

                # 待機中のプレイヤーがいるか確認
                if waiting_player is not None:
                    # 自分自身とのマッチングを防ぐ（念のため）
                    if waiting_player["player_id"] == player_id:
                        continue

                    # マッチ成立
                    p1_data = waiting_player
                    p2_data = {"socket": websocket, "player_id": player_id}
                    
                    # バトル作成
                    model = make_new_battle_info(player1_id=p1_data["player_id"], player2_id=p2_data["player_id"])
                    # make_new_battleは内部でBattle_infoを作りbattle_roomsに登録する
                    # ここではロジックを再利用したいが、make_new_battleはレスポンスを返すだけなので少し調整
                    bi = Battle_info(model.player1_id, model.player2_id, sb_info=sb_info_instance, google_ai=google_ai_instance)
                    battle_rooms[bi.room_id] = bi

                    # 両者をルームに参加させる
                    manager.join_room(p1_data["socket"], bi.room_id)
                    manager.join_room(p2_data["socket"], bi.room_id)

                    # それぞれに開始メッセージ送信
                    await p1_data["socket"].send_text(json.dumps(bi.make_init_response(p1_data["player_id"])))
                    await p2_data["socket"].send_text(json.dumps(bi.make_init_response(p2_data["player_id"])))

                    waiting_player = None
                else:
                    # 待機列に追加
                    waiting_player = {"socket": websocket, "player_id": player_id}
                    await websocket.send_text(json.dumps({"type": "waiting", "message": "対戦相手を探しています..."}))

            # typeで分岐し、既存の関数を利用
            elif req.get("type") == "make_new_battle":
                info = req.get("info", {})
                model = make_new_battle_info(**info)
                manager.register_player(websocket, model.player1_id)
                res = make_new_battle(model)
                # 部屋作成時は送信元を部屋に登録
                manager.join_room(websocket, res["room_id"])
                await websocket.send_text(json.dumps(res)) # 作成者には直接応答

            elif req.get("type") == "include_check":
                info = req.get("info", {})
                model = include_check_info(**info)
                res = include_check(model)
                await websocket.send_text(json.dumps(res)) # チェック結果は本人だけでOK

            elif req.get("type") == "submit_word":
                info = req.get("info", {})
                model = turn_info(**info)
                res = turn_process(model)
                
                if res.get("type") == "error":
                    # エラーの場合は送信元にのみ返す
                    await websocket.send_text(json.dumps(res))
                else:
                    # 成功時は結果を部屋全員に送信（視点補正あり）
                    await manager.broadcast_battle_state(model.room_id, res)

                    # --- CPU自動攻撃処理 ---
                    # バトルルーム取得
                    room_id = getattr(model, 'room_id', None)
                    if room_id and room_id in battle_rooms:
                        battle = battle_rooms[room_id] # type: Battle_info
                        # CPU戦で、プレイヤーの攻撃後にCPUのターンになる場合
                        if battle.is_cpu and not battle.player1_turn and battle.player1_win is None:
                            cpu_res = battle.execute_cpu_turn()
                            # CPUの行動結果も同様にブロードキャスト
                            if cpu_res: await manager.broadcast_battle_state(room_id, cpu_res)

            elif req.get("type") == "run_away":
                info = req.get("info", {})
                model = run_away_info(**info)
                if model.room_id in battle_rooms:
                    del battle_rooms[model.room_id]
                    print(f"Battle room {model.room_id} was removed because a player ran away.")

            else:
                await websocket.send_text(json.dumps({"type": "error", "message": "Unknown type"}))
    
    except WebSocketDisconnect:
        # 待機中のプレイヤーが切断した場合
        if waiting_player and waiting_player["socket"] == websocket:
            waiting_player = None
        
        left_rooms = manager.disconnect(websocket)
        for room_id in left_rooms:
            # 残っているプレイヤーに切断を通知
            await manager.broadcast(json.dumps({
                "type": "opponent_disconnected",
                "message": "あいてとの勝負に勝った！"
            }), room_id)
            
            if room_id in battle_rooms:
                del battle_rooms[room_id]
        print("WebSocket切断・登録解除")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)