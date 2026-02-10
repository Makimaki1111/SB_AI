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

class Player:
    """プレイヤーの状態を管理するクラス"""
    def __init__(self, player_id: str, name: str):
        self.id = player_id
        self.name = name
        self.hp = MAX_HP
        self.attack_rank = 0
        self.defense_rank = 0
        self.types = [""]

    def take_damage(self, damage: int):
        self.hp = max(0, self.hp - damage)

    def heal(self, amount: int):
        self.hp = min(MAX_HP, self.hp + amount)

    @property
    def is_defeated(self) -> bool:
        return self.hp <= 0

class Battle_info:
    """
    ブラウザ対戦時のマッチ情報を保持するクラス
    """
    def __init__(self, player1_id, player2_id, sb_info: SB_info, google_ai: GOOGLE_AI, room_id: str | None = None):
        self.room_id = room_id or str(uuid.uuid4())
        self.used = defaultdict(list)
        self.MAX_HP = 60
        self.is_cpu = (player2_id == "cpu")

        self.sb_info = sb_info
        self.google_ai = google_ai

        self.player1 = Player(player1_id, "じぶん")
        self.player2 = Player(player2_id, "あいて")

        self.player1_win = None
        self.player1_turn = True
        self.START_CHARACTER = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわ"
        self.character = random.choice(self.START_CHARACTER)
        self.events = [] # type: list
        self.turn = 0
        self.word = ""

    def try_attack(self, player_id, word: str):
        """player1に返す用のメッセージ

        Args:
            player_id (_type_): _description_
            word (_type_): _description_

        Returns:
            _type_: _description_
        """
        if(self.player1_win != None):
            return {"type" : "error", "message" : "戦闘はすでに終了しています"}
        elif(self.player1_turn ^ (player_id == self.player1.id)):
            return {"type" : "error", "message" : "自分のターンではありません"}
        elif(not self.sb_info.include_in_all_words(word) and not self.sb_info.inclue_in_typed_words(word)):
            return {"type" : "error", "message" : "辞書にない単語です"}
        elif(word in self.used):
            return {"type" : "error", "message" : "使用済みの単語です"}
        elif(word[0] != self.character):
            return {"type" : "error", "message" : "開始文字がマッチしていません"}
        elif(self.sb_info.get_next_initial(word) == "ん"):
            return {"type" : "error", "message" : "「ん」で終わっています"}
        elif(not self.sb_info.include_in_typed_heads( self.sb_info.get_next_initial(word) )):
            return {"type" : "error", "message" : "禁止された単語です"}

        self.word = word
        types = self._type_check(word)
        if(player_id == self.player1.id):
            # タイプ特定
            self.player1.types = types[:]
            at1 = types[0] if len(types) >= 1 else ""
            at2 = types[1] if len(types) >= 2 else ""
            dt1 = self.player2.types[0] if len(self.player2.types) >= 1 else ""
            dt2 = self.player2.types[1] if len(self.player2.types) >= 2 else ""
            
            if("食べ物" in types):
                event = {"type" : "cure", "message" : "体力が回復した", "ally_cure" : 20, "foe_cure" : 0}
                self.events.append(event)
                self.player1.heal(20)
            elif("医療" in types):
                event = {"type" : "cure", "message" : "体力が回復した", "ally_cure" : 40, "foe_cure" : 0}
                self.events.append(event)
                self.player1.heal(40)
            else:
                # ダメージ計算
                effect, damage = self._calc_damage(at1,at2,dt1,dt2)
                event = {
                    "type" : "damage",
                    "message" : "効果はばつぐんだ！" if effect > 1 else "ふつうのダメージだ" if effect == 1 else "効果はいまひとつのようだ…" if effect > 0 else "効果はないようだ…",
                    "ally_damage" : 0,
                    "foe_damage" : damage
                }
                self.events.append(event)

                # 暴力で攻撃ダウン
                if("暴力" in types):
                    self.player1.attack_rank = max(-6, self.player1.attack_rank - 2)
                    event = {
                        "type" : "atk_down",
                        "message" : f"攻撃ががくっと下がった！(現在{self.sb_info.rank_to_power(self.player1.attack_rank)}倍)",
                        "player" : "ally",
                        "new_atk" : self.player1.attack_rank
                    }
                    self.events.append(event)

                self.player2.take_damage(damage)
                if(self.player2.is_defeated): self.player1_win = True

        else:
            # タイプ特定
            self.player2.types = types[:]
            at1 = types[0] if len(types) >= 1 else ""
            at2 = types[1] if len(types) >= 2 else ""
            dt1 = self.player1.types[0] if len(self.player1.types) >= 1 else ""
            dt2 = self.player1.types[1] if len(self.player1.types) >= 2 else ""

            if("食べ物" in types):
                event = {"type" : "cure", "message" : "体力が回復した", "ally_cure" : 0, "foe_cure" : 20}
                self.events.append(event)
                self.player2.heal(20)

            elif("医療" in types):
                event = {"type" : "cure", "message" : "体力が回復した", "ally_cure" : 0, "foe_cure" : 40}
                self.events.append(event)
                self.player2.heal(40)
            else:
                # ダメージ計算
                effect, damage = self._calc_damage(at1,at2,dt1,dt2)
                event = {
                    "type" : "damage",
                    "message" : "効果はばつぐんだ！" if effect > 1 else "ふつうのダメージだ" if effect == 1 else "効果はいまひとつのようだ…" if effect > 0 else "効果はないようだ…",
                    "ally_damage" : damage,
                    "foe_damage" : 0
                }
                self.events.append(event)

                # 暴力で攻撃ダウン
                if("暴力" in types):
                    self.player2.attack_rank = max(-6, self.player2.attack_rank - 2)
                    event = {
                        "type" : "atk_down",
                        "message" : f"攻撃ががくっと下がった！(現在{self.sb_info.rank_to_power(self.player2.attack_rank)}倍)",
                        "player" : "foe",
                        "new_atk" : self.player2.attack_rank
                    }
                    self.events.append(event)

                self.player1.take_damage(damage)
                if(self.player1.is_defeated): self.player1_win = False
        self.character = self.sb_info.get_next_initial(word)
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
            ret["include"] = self.sb_info.include_in_all_words(_input)

        return ret

    def _type_check(self,_input:str) -> list:
        """
            AIにタイプを確認 & used更新
        Args:
            _input (str): 単語

        Returns:
            タイプ (list)
        """
        types = self.google_ai.get_type(_input)
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
        e = self.sb_info.type_effect(at1,at2,dt1,dt2)
        if(at1 == at2 == ""):
            # 攻撃がノータイプ
            damage = 7.0
            if(self.player1_turn):
                damage *= self.sb_info.rank_to_power(self.player1.attack_rank)
                damage /= self.sb_info.rank_to_power(self.player2.defense_rank)
            else:
                damage *= self.sb_info.rank_to_power(self.player2.attack_rank)
                damage /= self.sb_info.rank_to_power(self.player1.defense_rank)
            return e, int(damage)
        elif(dt1 == dt2 == ""):
            # 防御がノータイプ
            damage = 10.0 * e
            if(self.player1_turn):
                damage *= self.sb_info.rank_to_power(self.player1.attack_rank)
                damage /= self.sb_info.rank_to_power(self.player2.defense_rank)
            else:
                damage *= self.sb_info.rank_to_power(self.player2.attack_rank)
                damage /= self.sb_info.rank_to_power(self.player1.defense_rank)
            return e, int(damage)
        else:
            # 攻守タイプあり
            damage = 10.0 * e
            if(self.player1_turn):
                damage *= self.sb_info.rank_to_power(self.player1.attack_rank)
                damage /= self.sb_info.rank_to_power(self.player2.defense_rank)
            else:
                damage *= self.sb_info.rank_to_power(self.player2.attack_rank)
                damage /= self.sb_info.rank_to_power(self.player1.defense_rank)
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
                "ally_HP" : self.player1.hp,
                "ally_A" : self.player1.attack_rank,
                "ally_B" : self.player1.defense_rank,
                "ally_type" : self.player1.types, 
                "ally_win" : self.player1_win,
                "ally_is_attacker" : None,
                "character" : self.character,
                "events" : self.events[:],
                "foe_HP" : self.player2.hp,
                "foe_A" : self.player2.attack_rank,
                "foe_B" : self.player2.defense_rank,
                "foe_type" : self.player2.types,
                "room_id" : self.room_id,
                "is_cpu" : self.is_cpu,
                "is_my_turn" : self.player1_turn,
                "turn" : self.turn,
                "word" : self.word
            }
        }

        self.events = []
        return ret

    def make_init_response(self, player_id: str) -> dict:
        """
        ゲーム開始時のレスポンスを作成する（視点対応）
        """
        is_p1 = (player_id == self.player1.id)
        
        ally = self.player1 if is_p1 else self.player2
        foe = self.player2 if is_p1 else self.player1

        return {
            "type": "made_room",
            "message": "バトルルーム作成",
            "room_id": self.room_id,
            "state" : {
                "is_my_turn" : self.player1_turn if is_p1 else not self.player1_turn,
                "character" : self.character
            },
            "ally" : {
                "max_hp" : self.MAX_HP,
                "name" : ally.name
            },
            "foe" : {
                "max_hp" : self.MAX_HP,
                "name" : foe.name
            }
        }

    @staticmethod
    def flip_turn_response(response: dict) -> dict:
        """
        Player1視点のレスポンスをPlayer2視点に変換する
        """
        if response.get("type") != "accepted":
            return response
        
        s = response["state"]
        new_state = s.copy()

        # ステータスの入れ替え
        new_state["ally_HP"] = s["foe_HP"]
        new_state["ally_A"] = s["foe_A"]
        new_state["ally_B"] = s["foe_B"]
        new_state["ally_type"] = s["foe_type"]
        
        new_state["foe_HP"] = s["ally_HP"]
        new_state["foe_A"] = s["ally_A"]
        new_state["foe_B"] = s["ally_B"]
        new_state["foe_type"] = s["ally_type"]

        # ターンと勝敗の反転
        new_state["is_my_turn"] = not s["is_my_turn"]
        new_state["ally_win"] = not s["ally_win"] if s["ally_win"] is not None else None

        # イベントの視点反転
        new_events = []
        for e in s["events"]:
            ne = e.copy()
            if "ally_damage" in e: ne["ally_damage"] = e["foe_damage"]
            if "foe_damage" in e: ne["foe_damage"] = e["ally_damage"]
            if "ally_cure" in e: ne["ally_cure"] = e["foe_cure"]
            if "foe_cure" in e: ne["foe_cure"] = e["ally_cure"]
            if "player" in e: ne["player"] = "foe" if e["player"] == "ally" else "ally"
            new_events.append(ne)
        new_state["events"] = new_events

        return {"type": "accepted", "state": new_state}

    def get_cpu_word(self):
        for i in self.sb_info.typed_dict:
            if(i[0] == self.character and i not in self.used):
                return i
        
        return ""

    def execute_cpu_turn(self):
        """
        CPUのターンを実行し、行動結果を返します。
        """
        cpu_word = self.get_cpu_word()
        if cpu_word:
            # CPUが選んだ単語で攻撃
            return self.try_attack(self.player2.id, cpu_word)
        else:
            # CPUが単語を見つけられなかった場合（降参）
            self.player1_win = True
            return self._make_response()

    def handle_disconnection(self, disconnected_player_id: str):
        """
        プレイヤーの切断を処理し、勝敗を決定してレスポンスを返します。
        """
        # すでに決着がついている場合は何もしない
        if self.player1_win is not None:
            return None

        message = "あいてが通信を切断しました。"
        
        if disconnected_player_id == self.player1.id:
            self.player1_win = False
            dmg = self.player1.hp
            self.player1.take_damage(dmg)
            self.events.append({
                "type": "damage",
                "message": message,
                "ally_damage": dmg,
                "foe_damage": 0
            })
        elif disconnected_player_id == self.player2.id:
            self.player1_win = True
            dmg = self.player2.hp
            self.player2.take_damage(dmg)
            self.events.append({
                "type": "damage",
                "message": message,
                "ally_damage": 0,
                "foe_damage": dmg
            })
        
        if self.player1_win is not None:
            return self._make_response()
        return None

    def timeout(self):
        """
        タイムアウト処理: 現在のターンプレイヤーが即敗北
        """
        if self.player1_turn:
            dmg = self.player1.hp
            self.player1.take_damage(dmg)
            self.player1_win = False
            self.events.append({
                "type": "damage",
                "message": "時間切れ！敗北しました。",
                "ally_damage": dmg,
                "foe_damage": 0
            })
        else:
            dmg = self.player2.hp
            self.player2.take_damage(dmg)
            self.player1_win = True
            self.events.append({
                "type": "damage",
                "message": "時間切れ！勝利しました。",
                "ally_damage": 0,
                "foe_damage": dmg
            })
        
        return self._make_response()