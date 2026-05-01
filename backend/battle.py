try:
    from base_battle import BaseBattle
    from player import Player
    from SB_info import SB_info
    from abilities import get_default_abilities
    from constants import MAX_HP, STOCK_LIVES, ABILITY_CHANGE_COUNT_INIT
    from schemas import BattleResponse, BattleState, CharacterState, BattleEvent
except ImportError:
    from backend.base_battle import BaseBattle
    from backend.player import Player
    from backend.SB_info import SB_info
    from backend.abilities import get_default_abilities
    from backend.constants import MAX_HP, STOCK_LIVES, ABILITY_CHANGE_COUNT_INIT
    from backend.schemas import BattleResponse, BattleState, CharacterState, BattleEvent

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
        self.is_cpu = is_cpu
        self.abilities = get_default_abilities()
        self.init_character()
        
        # プロファイルから特性を反映
        if p1_profile and p1_profile.get("ability") in self.abilities:
            self.player1.ability = p1_profile["ability"]
        if p2_profile and p2_profile.get("ability") in self.abilities:
            self.player2.ability = p2_profile["ability"]

    def get_player_label(self, player) -> str:
        """SingleBattleでも生のIDを返す (BattleManagerのidToUiMapと同期するため)"""
        return player.id

    def get_current_actor(self) -> Player:
        return self.player1 if self.player1_turn else self.player2

    @property
    def is_cpu_turn(self) -> bool:
        return self.is_cpu and not self.player1_turn

    @property
    def is_finished(self) -> bool:
        return self.winner_team is not None

    def init_character(self):
        self.character = random.choice(self.START_CHARACTERS)

    def _check_win_condition(self) -> bool:
        if self.player1_lives <= 0 or (self.player1.hp <= 0 and self.player1_lives == 0):
            self.winner_team = 1 # プレイヤー2勝利
        elif self.player2_lives <= 0 or (self.player2.hp <= 0 and self.player2_lives == 0):
            self.winner_team = 0 # プレイヤー1勝利
        return self.is_finished


    def make_init_response(self, player_id: str) -> dict:
        res = self._make_response()
        res["type"] = "made_room"
        res["all_abilities"] = self._get_serializable_abilities()
        return self.get_personalized_response(res, player_id)

    def _is_used(self, word: str) -> bool:
        return word in self.used

    def _handle_knockout(self, defeated_player: Player):
        if defeated_player.id == self.player1.id:
            self.player1_lives -= 1
            lives_left = self.player1_lives
            if lives_left <= 0: self.winner_team = 1
            else: defeated_player.hp = MAX_HP
        else:
            self.player2_lives -= 1
            lives_left = self.player2_lives
            if lives_left <= 0: self.winner_team = 0
            else: defeated_player.hp = MAX_HP
            
        if self.winner_team is None:
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
                "target": self.get_player_label(defeated_player)
            })

    def try_attack(self, player_id: str, word: str):
        self.word = word
        if self.is_finished: return self._make_response()
        
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
        self._check_win_condition()
        
        if not self.is_finished:
            self.player1_turn = not self.player1_turn
            
        ret = self._make_response()
        self.word, self.events = "", []
        return ret

    def _make_response(self) -> dict:
        chars = {
            self.player1.id: CharacterState(
                name=self.player1.name, hp=self.player1.hp, max_hp=MAX_HP,
                attack_rank=self.player1.attack_rank, defense_rank=self.player1.defense_rank,
                types=self.player1.types, is_poison=self.player1.poison_turns > 0,
                ability=self.player1.ability, ability_change_count=self.player1.ability_change_count,
                lives=self.player1_lives, owner_id=self.player1.id
            ),
            self.player2.id: CharacterState(
                name=self.player2.name, hp=self.player2.hp, max_hp=MAX_HP,
                attack_rank=self.player2.attack_rank, defense_rank=self.player2.defense_rank,
                types=self.player2.types, is_poison=self.player2.poison_turns > 0,
                ability=self.player2.ability, ability_change_count=self.player2.ability_change_count,
                lives=self.player2_lives, owner_id=self.player2.id
            )
        }
        
        state = BattleState(
            room_id=self.room_id,
            character=self.character,
            is_my_turn=False, # get_personalized_response で設定
            turn=self.turn,
            last_actor_id=self.last_actor_id,
            word=self.word,
            characters=chars,
            winner_team=self.winner_team,
            ally_win=None, # get_personalized_response で設定
            ally_max_lives=self.p1_max_lives,
            foe_max_lives=self.p2_max_lives,
            current_actor_id=self.player1.id if self.player1_turn else self.player2.id,
            current_owner_id=self.player1.id if self.player1_turn else self.player2.id
        )
        
        events = [BattleEvent(**e) for e in self.events if isinstance(e, dict)]
        return BattleResponse(state=state, events=events).model_dump(by_alias=True)

    def get_personalized_response(self, base_res: dict, player_id: str) -> dict:
        new_res = base_res.copy()
        state = new_res["state"]
        
        is_p1 = (player_id == self.player1.id)
        state["is_my_turn"] = self.player1_turn if is_p1 else not self.player1_turn
        state["ally_max_lives"] = self.p1_max_lives if is_p1 else self.p2_max_lives
        state["foe_max_lives"] = self.p2_max_lives if is_p1 else self.p1_max_lives
        
        if self.winner_team is not None:
            state["ally_win"] = (is_p1 and self.winner_team == 0) or (not is_p1 and self.winner_team == 1)
        
        # 敵の特性をマスク
        foe_id = self.player2.id if is_p1 else self.player1.id
        if foe_id in state["characters"]:
            state["characters"][foe_id]["ability"] = "secret"
            state["characters"][foe_id]["ability_change_count"] = ABILITY_CHANGE_COUNT_INIT

        return new_res


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
            "target": self.get_player_label(player),
            "new_ability": new_ability_id,
            "new_ability_change_count": player.ability_change_count
        })
        return self._make_response()

    def execute_cpu_turn(self):
        cpu_word = self.get_cpu_word()
        if cpu_word: return self.try_attack(self.player2.id, cpu_word)
        self.player2.hp = 0
        self._check_win_condition()
        return self._make_response()

    def get_cpu_word(self):
        candidates = self.sb_info.get_typed_word_candidates(self.character)
        for word in candidates:
            if not self._is_used(word): return word
        return ""

