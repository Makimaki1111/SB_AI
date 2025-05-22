from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
try:
    from battle import Battle_info,battle_rooms,SB
except ImportError:
    from backend.battle import Battle_info,battle_rooms,SB

app = FastAPI()

# ポート番号を合わせるおまじない?
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ここは必要に応じて ["http://localhost"] などに制限できます
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class make_new_battle_info(BaseModel):
    player1_id: str
    player2_id: str

@app.post("/make_new_battle")
def make_new_battle(info: make_new_battle_info):
    bi = Battle_info(info.player1_id, info.player2_id)
    return {"message": "バトルルーム作成",
            "room_id": bi.room_id}

class include_check_info(BaseModel):
    room_id : str
    word : str

@app.post("/include_check")
def include_check(info:include_check_info):
    room_id = info.room_id
    word = info.word
    if(room_id not in battle_rooms):return None
    return battle_rooms[room_id].include_check(word)

class turn_info(BaseModel):
    room_id : str
    player_id : str
    word : str

@app.post("/submit_word")
def turn_process(info:turn_info):
    room_id = info.room_id
    player_id = info.player_id
    word = info.word
    return battle_rooms[room_id].try_attack(player_id,word)