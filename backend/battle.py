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
        self.player1_name = "じぶん"
        self.player2_name = "あいて"
        self.MAX_HP = 60
        self.is_cpu = (player2_id == "cpu")

        self.player1_HP = self.MAX_HP
        self.player1_A = 0
        self.player1_B = 0
        self.player1_type = []
        self.player1_win = None
        self.player1_turn = True
        self.character = "こ"
        self.damage = 0
        self.events = []

        self.player2_HP = self.MAX_HP
        self.player2_A = 0
        self.player2_B = 0
        self.player2_type = []
        self.types = []
        self.turn = 0
        self.word = ""
        battle_rooms[self.room_id] = self

    def try_attack(self, player_id, word: str):
        """player1に返す用のメッセージ

        Args:
            player_id (_type_): _description_
            word (_type_): _description_

        Returns:
            _type_: _description_
        """
        
        if(self.player1_win != None):
            return {
                "type" : "error",
                "message" : ""
            }
        elif(self.player1_turn ^ (player_id == self.player1_id)):
            return {
                "type" : "error",
                "message" : "自分のターンではありません"
            }
        elif(not SB.include_in_all_words(word) and not SB.inclue_in_typed_words(word)):
            return {
                "type" : "error",
                "message" : "辞書にない単語です"
            }
        elif(word in self.used):
            return {
                "type" : "error",
                "message" : "使用済みの単語です"
            }
        elif(word[0] != self.character):
            return {
                "type" : "error",
                "message" : "開始文字がマッチしていません"
            }
        elif(SB.get_next_initial(word) == "ん"):
            return{
                "type" : "error",
                "message" : "「ん」で終わっています"
            }
        elif(not SB.include_in_typed_heads( SB.get_next_initial(word) )):
            return {
                "type" : "error",
                "message" : "禁止された単語です"
            }

        self.word = word
        if(player_id == self.player1_id):

            # タイプ特定
            self.types = self._type_check(word)
            self.player1_type = self.types[:]
            at1 = self.types[0] if len(self.types) >= 1 else ""
            at2 = self.types[1] if len(self.types) >= 2 else ""
            dt1 = self.player2_type[0] if len(self.player2_type) >= 1 else ""
            dt2 = self.player2_type[1] if len(self.player2_type) >= 2 else ""
            
            if("食べ物" in self.types):
                event = {
                    "type" : "cure",
                    "message" : "体力が回復した",
                    "ally_cure" : 20,
                    "foe_cure" : 0
                }
                self.events.append(event)

                self.player1_HP = min(self.MAX_HP, self.player1_HP + 20)
            elif("医療" in self.types):
                event = {
                    "type" : "cure",
                    "message" : "体力が回復した",
                    "ally_cure" : 40,
                    "foe_cure" : 0
                }
                self.events.append(event)

                self.player1_HP = min(self.MAX_HP, self.player1_HP + 40)
            else:
                # ダメージ計算
                effect, self.damage = self._calc_damage(at1,at2,dt1,dt2)
                event = {
                    "type" : "damage",
                    "message" : "効果はばつぐんだ！" if effect > 1 else "ふつうのダメージだ" if effect == 1 else "効果はいまひとつのようだ…" if effect > 0 else "効果はないようだ…",
                    "ally_damage" : 0,
                    "foe_damage" : self.damage
                }
                self.events.append(event)

                # 暴力で攻撃ダウン
                # TODO: 対戦モードの場合設計変更いるかも
                # TODO: 攻撃ダウンがマジックナンバー
                if("暴力" in self.types):
                    self.player1_A = max(-6, self.player1_A - 2)
                    event = {
                        "type" : "atk_down",
                        "message" : f"攻撃ががくっと下がった！(現在{SB.rank_to_power(self.player1_A)}倍)",
                        "player" : "ally",
                        "new_atk" : self.player1_A
                    }
                    self.events.append(event)

                self.player2_HP = max(0,self.player2_HP - self.damage)
                if(self.player2_HP == 0):self.player1_win = True

        else:
            # タイプ特定
            self.types = self._type_check(word)
            self.player2_type = self.types[:]
            at1 = self.types[0] if len(self.types) >= 1 else ""
            at2 = self.types[1] if len(self.types) >= 2 else ""
            dt1 = self.player1_type[0] if len(self.player1_type) >= 1 else ""
            dt2 = self.player1_type[1] if len(self.player1_type) >= 2 else ""

            if("食べ物" in self.types):
                event = {
                    "type" : "cure",
                    "message" : "体力が回復した",
                    "ally_cure" : 0,
                    "foe_cure" : 20
                }
                self.events.append(event)

                self.player2_HP = min(self.MAX_HP, self.player2_HP + 20)
            elif("医療" in self.types):
                event = {
                    "type" : "cure",
                    "message" : "体力が回復した",
                    "ally_cure" : 0,
                    "foe_cure" : 40
                }
                self.events.append(event)

                self.player2_HP = min(self.MAX_HP, self.player2_HP + 40)
            else:
                # ダメージ計算
                effect, self.damage = self._calc_damage(at1,at2,dt1,dt2)
                event = {
                    "type" : "damage",
                    "message" : "効果はばつぐんだ！" if effect > 1 else "ふつうのダメージだ" if effect == 1 else "効果はいまひとつのようだ…" if effect > 0 else "効果はないようだ…",
                    "ally_damage" : self.damage,
                    "foe_damage" : 0
                }
                self.events.append(event)

                # 暴力で攻撃ダウン
                # TODO: 対戦モードの場合設計変更いるかも
                # TODO: 攻撃ダウンがマジックナンバー
                if("暴力" in self.types):
                    self.player2_A = max(-6, self.player2_A - 2)
                    event = {
                        "type" : "atk_down",
                        "message" : f"攻撃ががくっと下がった！(現在{SB.rank_to_power(self.player2_A)}倍)",
                        "player" : "foe",
                        "new_atk" : self.player2_A
                    }
                    self.events.append(event)

                self.player1_HP = max(0,self.player1_HP - self.damage)
                if(self.player1_HP == 0):self.player1_win = False
            
        self.character = SB.get_next_initial(word)
        ret = self._make_response()

        # ターン交代
        self.player1_turn = not self.player1_turn
        self.turn += 1
        return ret

    def include_check(self,_input:str):
        ret = {
            "type" : "pre_check",
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
            ret["type2"] = self.used[_input][1] if len(self.used[_input]) == 2 else ""
        else:
            ret["include"] = SB.include_in_all_words(_input)

        return ret

    def _type_check(self,_input:str) -> list:
        """
            AIにタイプを確認 & used更新
        Args:
            _input (str): 単語

        Returns:
            タイプ (list)
        """
        types = AI.get_type(_input)
        self.used[_input] = types

        return types

    def _calc_damage(self,at1:str, at2:str, dt1:str, dt2:str) -> tuple:
        """
            ダメージを計算します
        Args:
            at1 (str): 攻撃タイプ1
            at2 (str): 攻撃タイプ2
            dt1 (str): 防御タイプ1
            dt2 (str): 防御タイプ2

        Returns:
            tuple: (相性, ダメージ)
        """
        e = SB.type_effect(at1,at2,dt1,dt2)
        if(at1 == at2 == ""):
            # 攻撃がノータイプ
            damage = 7.0
            if(self.player1_turn):
                damage *= SB.rank_to_power(self.player1_A)
                damage /= SB.rank_to_power(self.player2_B)
            else:
                damage *= SB.rank_to_power(self.player2_A)
                damage /= SB.rank_to_power(self.player1_B)
            return e, int(damage)
        elif(dt1 == dt2 == ""):
            # 防御がノータイプ
            damage = 10.0 * e
            if(self.player1_turn):
                damage *= SB.rank_to_power(self.player1_A)
                damage /= SB.rank_to_power(self.player2_B)
            else:
                damage *= SB.rank_to_power(self.player2_A)
                damage /= SB.rank_to_power(self.player1_B)
            return e, int(damage)
        else:
            # 攻守タイプあり
            damage = 10.0 * e
            if(self.player1_turn):
                damage *= SB.rank_to_power(self.player1_A)
                damage /= SB.rank_to_power(self.player2_B)
            else:
                damage *= SB.rank_to_power(self.player2_A)
                damage /= SB.rank_to_power(self.player1_B)
            damage *= random.uniform(0.85,0.99)
            return e, int(damage)

    def _make_response(self) -> dict:
        """
            frontend側に返す辞書を作成します
        Returns:
            dict: 返す情報
        """
        ret = {
            "type": "accepted",
            "state" : {
                "ally_HP" : self.player1_HP,
                "ally_A" : self.player1_A,
                "ally_B" : self.player1_B,
                "ally_type" : self.player1_type, 
                "ally_win" : self.player1_win,
                "ally_is_attacker" : None,
                "character" : self.character,
                "damage" : self.damage,
                "events" : self.events[:],
                "foe_HP" : self.player2_HP,
                "foe_A" : self.player2_A,
                "foe_B" : self.player2_B,
                "foe_type" : self.player2_type,
                "room_id" : self.room_id,
                "is_cpu" : self.is_cpu,
                "is_my_turn" : self.player1_turn,
                "turn" : self.turn,
                "word" : self.word
            }
        }

        self.events = []
        self.damage = 0
        return ret

    def get_cpu_word(self):
        for i in SB.typed_dict:
            if(i[0] == self.character and i not in self.used):
                return i
        
        return ""