try:
    from SB_info import SB_info
    from base_battle import BaseBattle
    from constants import *
    from player import Player
    from abilities import get_default_abilities, get_all_abilities_info
except ImportError:
    from backend.SB_info import SB_info
    from backend.base_battle import BaseBattle
    from backend.constants import *
    from backend.player import Player
    from backend.abilities import get_default_abilities, get_all_abilities_info

from collections import defaultdict
from pydantic import BaseModel
import random
import uuid

# 定数は constants.py に集約されています

class TextInput(BaseModel):
    text: str

class SingleBattle(BaseBattle):
    def __init__(self, player1_id: str, player2_id: str, sb_info: SB_info, room_id: str | None = None, p1_profile: dict = None, p2_profile: dict = None, p1_max_lives: int = STOCK_LIVES, p2_max_lives: int = STOCK_LIVES, is_cpu: bool = False):
        super().__init__(sb_info, room_id)
        p1_name = p1_profile.get("name", "じぶん") if p1_profile else "じぶん"
        p2_name = p2_profile.get("name", "プレイヤー2") if p2_profile else "プレイヤー2"
        
        self.player1 = Player(player1_id, p1_name)
        self.player2 = Player(player2_id, p2_name)
        self.players = [self.player1, self.player2]
        
        self.p1_max_lives = p1_max_lives
        self.p2_max_lives = p2_max_lives
        self.player1_lives = p1_max_lives
        self.player2_lives = p2_max_lives
        
        self.player1_turn = (random.random() < 0.5)
        self.player1_win = None
        self.is_cpu = is_cpu
        self.abilities = get_default_abilities()
        self.init_character()
        
        # プロファイルから特性を反映
        if p1_profile and p1_profile.get("ability") in self.abilities:
            self.player1.ability = p1_profile["ability"]
        if p2_profile and p2_profile.get("ability") in self.abilities:
            self.player2.ability = p2_profile["ability"]

    def get_player_label(self, player) -> str:
        """SingleBattleではally/foeを返す"""
        return "ally" if player.id == self.player1.id else "foe"

    @property
    def is_finished(self) -> bool:
        return self.player1_win is not None

    def init_character(self):
        self.character = random.choice(self.START_CHARACTERS)

    def _get_serializable_abilities(self):
        serializable_abilities = {}
        for ability_id, ability_obj in self.abilities.items():
            serializable_abilities[ability_id] = ability_obj.get_display_data()
        serializable_abilities["secret"] = {
            "name": "ひみつ",
            "description": "相手もきみのとくせいを知らないぞ",
            "icon_type": "ノーマル"
        }
        return serializable_abilities

    def make_init_response(self, player_id: str) -> dict:
        is_p1 = (player_id == self.player1.id)
        ally = self.player1 if is_p1 else self.player2
        foe = self.player2 if is_p1 else self.player1

        return {
            "type": "made_room",
            "message": "バトルルーム作成",
            "room_id": self.room_id,
            "all_abilities": self._get_serializable_abilities(),
            "state" : {
                "is_my_turn" : self.player1_turn if is_p1 else not self.player1_turn,
                "character" : self.character,
                "ally_lives" : self.player1_lives if is_p1 else self.player2_lives,
                "foe_lives" : self.player2_lives if is_p1 else self.player1_lives,
                "ally_max_lives" : self.p1_max_lives if is_p1 else self.p2_max_lives,
                "foe_max_lives" : self.p2_max_lives if is_p1 else self.p1_max_lives
            },
            "ally" : {
                "max_hp" : MAX_HP,
                "lives" : self.player1_lives if is_p1 else self.player2_lives,
                "name" : ally.name,
                "ability": ally.ability,
                "ability_change_count": ally.ability_change_count,
                "is_poison": ally.poison_turns > 0
            },
            "foe" : {
                "max_hp" : MAX_HP,
                "lives" : self.player2_lives if is_p1 else self.player1_lives,
                "name" : foe.name,
                "is_poison": foe.poison_turns > 0
            }
        }

    def _is_used(self, word: str) -> bool:
        return word in self.used

    def _handle_knockout(self, defeated_player: Player):
        if defeated_player.id == self.player1.id:
            self.player1_lives -= 1
            lives_left = self.player1_lives
            if lives_left <= 0: self.player1_win = False
            else: defeated_player.hp = MAX_HP
        else:
            self.player2_lives -= 1
            lives_left = self.player2_lives
            if lives_left <= 0: self.player1_win = True
            else: defeated_player.hp = MAX_HP
            
        if self.player1_win is None:
            defeated_player.attack_rank = 0
            defeated_player.defense_rank = 0
            defeated_player.types = [""]
            defeated_player.poison_turns = 0
            defeated_player.poisoner_id = None
            defeated_player.leech_turns = 0
            defeated_player.leech_target_id = None
            self.events.append({
                "type": "revive",
                "message": f"{defeated_player.name}は復帰した！（のこり{lives_left}）",
                "lives": lives_left,
                "hp": MAX_HP,
                "target": defeated_player.id
            })

    def try_attack(self, player_id: str, word: str):
        self.word = word
        if self.player1_win is not None: return self._make_response()
        
        current_player = self.player1 if self.player1_turn else self.player2
        target_player = self.player2 if self.player1_turn else self.player1
        
        if player_id != current_player.id:
            return {"type": "error", "message": "あなたのターンではありません"}

        word = self.katakana_to_hiragana(word)
        if not word or word[0] != self.character:
            return {"type": "error", "message": "開始文字がマッチしていません"}
        
        if self._is_used(word):
            return {"type": "error", "message": "その単語は既に使用されています"}
        
        if not self.sb_info.include_in_all_words(word):
            return {"type": "error", "message": "辞書にない単語です"}

        # 「ん」チェック (devブランチのロジックに合わせる)
        if self.sb_info.get_next_initial(word) == "ん":
            return {"type": "error", "message": "「ん」で終わっています"}

        types = [t for t in self.sb_info.get_types(word) if t]
        current_player.types = types[:]
        ability_obj = self.abilities.get(current_player.ability)
        
        # BaseBattleの共通フローに委譲
        self.execute_attack_flow(current_player, target_player, word, types, ability_obj, is_single=True)

        self._process_end_of_turn_effects(current_player, target_player)
        self.record_used_word(word, player_id)
        self.character = self.sb_info.get_next_initial(word)
        
        ret = self._make_response()
        self.player1_turn = not self.player1_turn
        self.turn += 1
        self.events = []
        self.word = ""
        return ret

    def _make_response(self):
        return {
            "type": "accepted",
            "room_id": self.room_id,
            "state": {
                "ally_HP": self.player1.hp,
                "ally_A": self.player1.attack_rank,
                "ally_B": self.player1.defense_rank,
                "ally_type": self.player1.types,
                "ally_poison": self.player1.poison_turns > 0,
                "ally_lives": self.player1_lives,
                "ally_ability": self.player1.ability,
                "ally_ability_change_count": self.player1.ability_change_count,
                "ally_win": self.player1_win,
                "character": self.character,
                "events": self.events[:],
                "foe_HP": self.player2.hp,
                "foe_A": self.player2.attack_rank,
                "foe_B": self.player2.defense_rank,
                "foe_type": self.player2.types,
                "foe_poison": self.player2.poison_turns > 0,
                "foe_lives": self.player2_lives,
                "foe_ability": self.player2.ability,
                "foe_ability_change_count": self.player2.ability_change_count,
                "is_cpu": self.is_cpu,
                "is_my_turn": self.player1_turn,
                "ally_max_lives": self.p1_max_lives,
                "foe_max_lives": self.p2_max_lives,
                "turn": self.turn,
                "word": self.word
            }
        }

    def get_personalized_response(self, base_res: dict, player_id: str) -> dict:
        is_p1 = (player_id == self.player1.id)
        if not is_p1: return self.flip_turn_response(base_res)
        return base_res

    def flip_turn_response(self, response: dict) -> dict:
        if response.get("type") != "accepted": return response
        s = response["state"]
        new_state = s.copy()
        fields = ["HP", "A", "B", "type", "poison", "lives", "ability", "ability_change_count", "max_lives"]
        for f in fields:
            new_state[f"ally_{f}"], new_state[f"foe_{f}"] = s[f"foe_{f}"], s[f"ally_{f}"]
        new_state["is_my_turn"] = not s["is_my_turn"]
        new_state["ally_win"] = not s["ally_win"] if s["ally_win"] is not None else None
        new_events = []
        for e in s["events"]:
            ne = e.copy()
            if "ally_damage" in e: ne["ally_damage"], ne["foe_damage"] = e["foe_damage"], e["ally_damage"]
            if "ally_cure" in e: ne["ally_cure"], ne["foe_cure"] = e["foe_cure"], e["ally_cure"]
            if "player" in e: ne["player"] = "foe" if e["player"] == "ally" else "ally"
            if "poison_target" in e: ne["poison_target"] = "foe" if e["poison_target"] == "ally" else "ally"
            new_events.append(ne)
        new_state["events"] = new_events
        return {"type": "accepted", "room_id": response.get("room_id"), "state": new_state}

    def change_ability(self, player_id: str, new_ability_id: str):
        player = self.player1 if player_id == self.player1.id else self.player2 if player_id == self.player2.id else None
        if not player: return {"type": "error", "message": "このルームのプレイヤーではありません"}
        if player.ability_change_count <= 0: return {"type": "error", "message": "特性はもう変更できません"}
        if new_ability_id not in self.abilities: return {"type": "error", "message": "存在しない特性です"}
        
        player.ability_change_count -= 1
        player.ability = new_ability_id
        self.events.append({
            "type": "ability_changed",
            "message": f"特性が「{self.abilities[new_ability_id].name}」に変わった！",
            "player": "ally" if player.id == self.player1.id else "foe",
            "new_ability": new_ability_id,
            "new_ability_change_count": player.ability_change_count
        })
        return self._make_response()

    def execute_cpu_turn(self):
        cpu_word = self.get_cpu_word()
        if cpu_word: return self.try_attack(self.player2.id, cpu_word)
        self.player1_win = True
        return self._make_response()

    def get_cpu_word(self):
        candidates = self.sb_info.get_typed_word_candidates(self.character)
        for word in candidates:
            if not self._is_used(word): return word
        return ""

    def handle_disconnection(self, player_id: str, message: str = "あいてが通信を切断しました。"):
        if self.player1_win is not None: return None
        if player_id == self.player1.id:
            self.player1_win = False
            self.player1.hp = 0
        else:
            self.player1_win = True
            self.player2.hp = 0
        return self._make_response()

    def timeout(self):
        if self.player1_turn:
            self.player1.hp = 0
            self.player1_win = False
        else:
            self.player2.hp = 0
            self.player1_win = True
        return self._make_response()
