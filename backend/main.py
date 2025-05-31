import uvicorn
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
try:
    from battle import Battle_info, battle_rooms
except ImportError:
    from backend.battle import Battle_info, battle_rooms

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 既存のREST API（必要なら残してもOK） ---
class make_new_battle_info(BaseModel):
    player1_id: str
    player2_id: str

def make_new_battle(info: make_new_battle_info):
    bi = Battle_info(info.player1_id, info.player2_id)
    return {
        "type": "made_room",
        "message": "バトルルーム作成",
        "room_id": bi.room_id,
        "is_cpu": bi.is_cpu,
        "ally" : {
            "max_hp" : bi.MAX_HP,
            "name" : bi.player1_name
        },
        "foe" : {
            "max_hp" : bi.MAX_HP,
            "name" : bi.player2_name
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

# --- WebSocket対応部分 ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            try:
                req = json.loads(data)
            except Exception:
                await websocket.send_text(json.dumps({"type": "error", "message": "Invalid JSON"}))
                continue
            
            # typeで分岐し、既存の関数を利用
            if req.get("type") == "make_new_battle":
                info = req.get("info", {})
                model = make_new_battle_info(**info)
                res = make_new_battle(model)
                await websocket.send_text(json.dumps(res))

            elif req.get("type") == "include_check":
                info = req.get("info", {})
                model = include_check_info(**info)
                res = include_check(model)
                await websocket.send_text(json.dumps(res))

            elif req.get("type") == "submit_word":
                info = req.get("info", {})
                model = turn_info(**info)
                res = turn_process(model)
                await websocket.send_text(json.dumps(res))

            else:
                await websocket.send_text(json.dumps({"type": "error", "message": "Unknown type"}))
    
    except WebSocketDisconnect:
        print("WebSocket切断")

if __name__ == "__main__":
    uvicorn.run("main:app", port=8000, reload=True)