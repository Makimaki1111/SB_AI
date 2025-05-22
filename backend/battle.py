try:
    from SB_info import SB_info
    from GOOGLE_API import GOOGLE_AI
except ImportError:
    from backend.SB_info import SB_info
    from backend.GOOGLE_API import GOOGLE_AI

from collections import defaultdict
from pydantic import BaseModel
import random
import uuid
battle_rooms = {}
MAX_HP = 60

class TextInput(BaseModel):
    text:str

AI = GOOGLE_AI()
SB = SB_info()
class Battle_info:
    """
    ブラウザ対戦時のマッチ情報を保持するクラス
    """

    def __init__(self, player1_id, player2_id):
        self.room_id = str(uuid.uuid4())
        self.used = defaultdict(list)
        self.player1_id = player1_id
        self.player2_id = player2_id
        self.room_info = {
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
        battle_rooms[self.room_id] = self

    def try_attack(self,player_id,word):
        self.room_info["turn_info"] = {
                "include" : True,
                "used" : False,
                "correct_player" : True
            }

        if(self.room_info["state"]["Turn"] != player_id):
            self.room_info["turn_info"]["correct_player"] = False
            return self.room_info

        if(player_id == self.player1_id):
            state_dict = self._type_check(word)
            if(not state_dict["include"]):
                self.room_info["turn_info"]["include"] = False
                return self.room_info
            elif(state_dict["used"]):
                self.room_info["turn_info"]["used"] = True
                return self.room_info

            at1 = state_dict["type1"]
            at2 = state_dict["type2"]
            dt1 = self.room_info["state"]["type1"][self.player2_id]
            dt2 = self.room_info["state"]["type2"][self.player2_id]
            damage = int(10 * SB.type_effect(at1,at2,dt1,dt2) * random.uniform(0.85,0.99))
            next_HP = max(0,self.room_info["state"]["HP"][self.player2_id] - damage)
            self.room_info["state"]["HP"][self.player2_id] = next_HP
            
            self.room_info["state"]["word"][self.player1_id] = word
            self.room_info["state"]["type1"][self.player1_id] = at1
            self.room_info["state"]["type2"][self.player1_id] = at2
            self.room_info["state"]["Turn"] = self.player2_id

            return self.room_info
        else:
            state_dict = self._type_check(word)
            if(not state_dict["include"]):
                self.room_info["turn_info"]["include"] = False
                return self.room_info
            elif(state_dict["used"]):
                self.room_info["turn_info"]["used"] = True
                return self.room_info

            at1 = state_dict["type1"]
            at2 = state_dict["type2"]
            dt1 = self.room_info["state"]["type1"][self.player1_id]
            dt2 = self.room_info["state"]["type2"][self.player1_id]
            damage = int(10 * SB.type_effect(at1,at2,dt1,dt2) * random.uniform(0.85,0.99))

            self.room_info["state"]["HP"][self.player1_id] = next_HP
            
            self.room_info["state"]["word"][self.player2_id] = word
            self.room_info["state"]["type1"][self.player2_id] = at1
            self.room_info["state"]["type2"][self.player2_id] = at2
            self.room_info["state"]["Turn"] = self.player1_id
            
            return self.room_info

    def include_check(self,_input:str):
        ret = {
            "name" : _input,
            "include" : False, 
            "used" : False,
            "type1" : "",
            "type2" : "",
        }

        if(_input in self.used):
            ret["include"] = True
            ret["used"] = True
            ret["type1"] = self.used[_input][0]
            ret["type2"] = self.used[_input][1]
            ret["image1"] = SB.image_name(_input)
            ret["image2"] = SB.image_name(_input)
        else:
            ret["include"] = SB.include_in_all_words(_input)
            ret["image"] = "unaware" if SB.include_in_all_words(_input) else ""

        return ret

    def _type_check(self,_input:str):
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
