from GOOGLE_API import GOOGLE_AI
from SB_info import SB_info
from collections import defaultdict
import random
import uuid
battle_rooms = {}
MAX_HP = 60

AI = GOOGLE_AI()
SB = SB_info()
class Battle_info:
    """
    ブラウザ対戦時のマッチ情報を保持するクラス
    """

    def __init__(self, player1_id, player2_id):
        self.room_id = uuid.uuid4()
        self.used = defaultdict(list)
        self.player1_id = player1_id
        self.player2_id = player2_id
        room_info = {
            "turn_info" : {
                "include" : False,
                "used" : False,
                "correct_player" : True
            },
            "state" : {
                "HP" : {player1_id : MAX_HP, player2_id : MAX_HP},
                "word" : {player1_id : "", player2_id : ""},
                "type1" : {player1_id : "", player2_id : ""},
                "type2" : {player1_id : "", player2_id : ""},
                "attack" : {player1_id : 0, player2_id : 0},
                "defence" : {player1_id : 0, player2_id : 0},
                "Turn" : player1_id
            },
        }
        battle_rooms[self.room_id] = room_info

    def try_attack(self,player_id,word):
        room_info = battle_rooms[self.room_id]
        room_info["turn_info"] = {
                "include" : False,
                "used" : False,
                "correct_player" : True
            }

        if(room_info["Turn"] != player_id):
            room_info["turn_info"]["correct_player"] = False
            return room_info

        if(player_id == self.player1_id):
            state_dict = self.type_check(word)
            if(not state_dict["include"]):
                room_info["turn_info"]["include"] = False
                return room_info
            elif(state_dict["used"]):
                room_info["turn_info"]["used"] = True
                return room_info

            at1 = state_dict["type1"]
            at2 = state_dict["type2"]
            dt1 = room_info["type1"][self.player2_id]
            dt2 = room_info["type2"][self.player2_id]
            damage = int(10 * SB.type_effect(at1,at2,dt1,dt2) * random.uniform(0.85,0.99))
            next_HP = max(0,room_info["state"]["HP"][self.player2_id] - damage)
            room_info["state"]["HP"][self.player2_id] = next_HP
            
            room_info["state"]["word"][self.player1_id] = word
            room_info["state"]["type1"][self.player1_id] = at1
            room_info["state"]["type2"][self.player1_id] = at2
            room_info["Turn"] = self.player2_id

            return room_info
        else:
            state_dict = self.type_check(word)
            if(not state_dict["include"]):
                room_info["turn_info"]["include"] = False
                return room_info
            elif(state_dict["used"]):
                room_info["turn_info"]["used"] = True
                return room_info

            at1 = state_dict["type1"]
            at2 = state_dict["type2"]
            dt1 = room_info["type1"][self.player1_id]
            dt2 = room_info["type2"][self.player1_id]
            damage = int(10 * SB.type_effect(at1,at2,dt1,dt2) * random.uniform(0.85,0.99))

            room_info["state"]["HP"][self.player1_id] = next_HP
            
            room_info["state"]["word"][self.player2_id] = word
            room_info["state"]["type1"][self.player2_id] = at1
            room_info["state"]["type2"][self.player2_id] = at2
            room_info["Turn"] = self.player1_id
            
            return room_info

    def type_check(self,_input:str):
        ret = {
            "word" : _input,
            "include" : False, 
            "used" : False,
            "type1" : "",
            "type2" : ""
        }

        # 辞書に登録されていない
        if(not SB.include_in_all_words(_input)):return ret
        ret["include"] = True

        # 使用済み
        if(_input in self.used):
            ret["used"] = True
            ret["type1"] = self.used[_input][0]
            ret["type2"] = self.used[_input][1]
            ret["image1"] = SB.image_name(ret["type1"])
            ret["image2"] = SB.image_name(ret["type2"])
            return ret

        types = AI.get_type(_input)
        ret["type1"] = types[0]
        ret["type2"] = types[1] if len(types) == 2 else ""
        ret["image1"] = SB.image_name(ret["type1"])
        ret["image2"] = SB.image_name(ret["type2"])
        self.used[_input] = (ret["type1"],ret["type2"])
        return ret
