from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from battle import Battle_info,battle_rooms

app = FastAPI()

# ポート番号を合わせるおまじない?
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ここは必要に応じて ["http://localhost"] などに制限できます
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class turn_info:
    room_id : str
    player_id : str
    word : str

@app.post("/make_new_battle")
def make_new_battle(player1_id,player2_id):
    Battle_info(player1_id,player2_id)

@app.post("/submit_word")
def receive_word(info:turn_info):
    room_id = info.room_id
    player_id = info.player_id
    word = info.word
    return battle_rooms[room_id].try_attack(player_id,word)