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
        self.is_cpu_battle = is_cpu
        self.abilities = get_default_abilities()
        self.init_character()
        
        # プロファイルから特性を反映 (randomや存在しないIDの場合はランダムに割り当て)
        def resolve_ability(profile):
            if profile and profile.get("ability") in self.abilities:
                return profile["ability"]
            # ランダムまたは無効な特性IDの場合
            valid_ids = [k for k in self.abilities.keys() if k != "random"]
            return random.choice(valid_ids) if valid_ids else "ikaku"

        self.player1.ability = resolve_ability(p1_profile)
        self.player2.ability = resolve_ability(p2_profile)
        
        self.player1.types = []
        self.player2.types = []
        
        self.events = [{"type": "message", "message": "マッチングした！"}]

    def get_player_label(self, player) -> str:
        """SingleBattleでも生のIDを返す (BattleManagerのidToUiMapと同期するため)"""
        return player.id

    @property
    def is_double(self) -> bool:
        return False

    @property
    def time_limit(self) -> int:
        return 20

    def get_current_actor(self) -> Player:
        return self.player1 if self.player1_turn else self.player2

    @property
    def is_cpu_turn(self) -> bool:
        return self.is_cpu and not self.player1_turn


    def get_team_index(self, player) -> int:
        return 0 if player.id == self.player1.id else 1

    def get_enemies(self, player) -> list[Player]:
        return [self.player2] if player.id == self.player1.id else [self.player1]

    def format_predictions(self, enemies: list[Player], at1: str, at2: str) -> dict:
        enemy = enemies[0]
        dt1 = enemy.types[0] if len(enemy.types) >= 1 else ""
        dt2 = enemy.types[1] if len(enemy.types) >= 2 else ""
        effect = self.sb_info.type_effect(at1, at2, dt1, dt2)
        return {"prediction": self._get_effect_message(effect)}

    def init_character(self):
        self.character = random.choice(self.START_CHARACTERS)

    def _check_win_condition(self) -> bool:
        if self.player1_lives <= 0 or (self.player1.hp <= 0 and self.player1_lives == 0):
            self.winner_team = 1 # プレイヤー2勝利
        elif self.player2_lives <= 0 or (self.player2.hp <= 0 and self.player2_lives == 0):
            self.winner_team = 0 # プレイヤー1勝利
        return self.is_finished


    def make_init_response(self, player_id: str, time_limit: int = None) -> dict:
        res = self._make_response()
        res["type"] = "made_room"
        res["all_abilities"] = self._get_serializable_abilities()
        return self.get_personalized_response(res, player_id, time_limit=time_limit)

    def _is_used(self, word: str) -> bool:
        return word in self.used

    def _handle_knockout(self, defeated_player: Player):
        # まず倒れたメッセージを追加
        self.events.append({
            "type": "knockout", 
            "message": f"{defeated_player.name}はたおれた！", 
            "target": self.get_player_label(defeated_player)
        })

        if defeated_player.id == self.player1.id:
            self.player1_lives -= 1
            lives_left = self.player1_lives
            if lives_left <= 0:
                self.finish_battle(1)
            else:
                defeated_player.hp = MAX_HP
        else:
            self.player2_lives -= 1
            lives_left = self.player2_lives
            if lives_left <= 0:
                self.finish_battle(0)
            else:
                defeated_player.hp = MAX_HP
            
        if self.winner_team is None:
            defeated_player.attack_rank = 0
            defeated_player.defense_rank = 0
            defeated_player.types = []
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

    def try_attack(self, player_id: str, word: str, target_id: str = None):
        self.word = word
        if self.is_finished: return self._make_response()
        
        # 基本バリデーションをBaseBattleに委譲
        err = self._validate_word(player_id, word)
        if err: return err

        current_player = self.get_current_actor()
        target_player = self.player2 if self.player1_turn else self.player1
        
        word = self.katakana_to_hiragana(word)
        types = [t for t in self.sb_info.get_types(word) if t]
        current_player.types = types[:]
        ability_obj = self.abilities.get(current_player.ability)
        
        # BaseBattleの共通フローに委譲
        self.execute_attack_flow(current_player, target_player, word, types, ability_obj)
        
        # 単語を記録し、次の文字を更新
        self.record_used_word(word, player_id)
        
        # ターン終了時の効果（毒など）
        self._process_end_of_turn_effects(current_player, target_player)
        self._check_win_condition()
        
        # ターンを交代
        self.player1_turn = not self.player1_turn
        self.turn += 1
        self.last_actor_id = player_id
        
        ret = self._make_response()
        # イベントをリセット（次のターンのために）
        self.word = ""
        self.events = []
        return ret

    def _make_response(self) -> dict:
        # 決着時のメッセージをイベントの最後に追加 (本家再現)
        if self.winner_team is not None:
            self.finish_battle(self.winner_team)

        # 共通メソッドを呼び出し (SingleBattle特有のフィールドを渡す)
        res = self._create_base_response(
            [self.player1, self.player2],
            ally_max_lives=self.p1_max_lives,
            foe_max_lives=self.p2_max_lives
        )
        self.events = [] # 送信後にイベントをクリア
        return res

    def get_personalized_response(self, base_res: dict, player_id: str, time_limit: int = None) -> dict:
        import copy
        new_res = copy.deepcopy(base_res)
        state = new_res["state"]
        
        # IDを文字列として確実に比較
        pid_str = str(player_id)
        is_p1 = (pid_str == str(self.player1.id))
        is_p2 = (pid_str == str(self.player2.id))
        
        # 自分のターンかどうかを判定
        state["is_my_turn"] = (str(state["current_owner_id"]) == pid_str)
        
        # ライフ情報の視点を調整
        if is_p1:
            state["ally_max_lives"] = self.p1_max_lives
            state["foe_max_lives"] = self.p2_max_lives
        elif is_p2:
            state["ally_max_lives"] = self.p2_max_lives
            state["foe_max_lives"] = self.p1_max_lives
        
        if self.winner_team is not None:
            ally_win = self.is_player_winner(pid_str)
            state["ally_win"] = ally_win
            self._personalize_events(new_res.get("events", []), ally_win)
        
        # 敵の特性をマスク
        foe_id = self.player2.id if is_p1 else self.player1.id
        if foe_id in state["characters"] and (is_p1 or is_p2):
            state["characters"][foe_id]["ability"] = "secret"
            state["characters"][foe_id]["ability_change_count"] = ABILITY_CHANGE_COUNT_INIT

        # フロントエンド演出用のマッピング情報
        id_to_ui_map = {}
        player_ids = []
        if is_p1:
            id_to_ui_map = {str(self.player1.id): "ally", str(self.player2.id): "foe"}
            player_ids = [str(self.player1.id)]
        elif is_p2:
            id_to_ui_map = {str(self.player2.id): "ally", str(self.player1.id): "foe"}
            player_ids = [str(self.player2.id)]
        else:
            # 観戦者などの場合 (デフォルトでP1視点)
            id_to_ui_map = {str(self.player1.id): "ally", str(self.player2.id): "foe"}
            player_ids = [str(self.player1.id)]

        new_res["info"] = {
            "player_ids": player_ids,
            "id_to_ui_map": id_to_ui_map,
            "time_limit": time_limit,
            "total_time": time_limit
        }
        
        return new_res


    def is_player_winner(self, player_id: str) -> bool:
        if self.winner_team is None: return False
        is_p1 = (player_id == self.player1.id)
        return (is_p1 and self.winner_team == 0) or (not is_p1 and self.winner_team == 1)

    def change_ability(self, player_id: str, new_ability_id: str, char_id: str = None):
        res = super().change_ability(player_id, new_ability_id, char_id=char_id)
        # _make_response 内で self.events がクリアされるため、ここでの手動クリアは不要
        return res

    def timeout(self):
        """タイムアウト処理 (SingleBattle 用にターン交代を追加)"""
        if self.is_finished: return self._make_response()
        current_actor = self.get_current_actor()
        if not current_actor: return self._make_response()

        current_actor.hp = 0
        self.events.append({
            "type": "knockout", 
            "message": f"時間切れ！{current_actor.name}は力尽きた…", 
            "target": self.get_player_label(current_actor), 
            "damage": 0, 
            "hp": 0
        })
        
        team_idx = self._get_team_index(current_actor)
        if team_idx != -1:
            self.finish_battle(1 - team_idx)
        
        # ターンを交代
        self.player1_turn = not self.player1_turn
        self.turn += 1
            
        ret = self._make_response()
        self.word = ""
        self.events = []
        return ret

    def execute_cpu_turn(self):
        cpu_word = self.get_cpu_word()
        if cpu_word: return self.try_attack(self.player2.id, cpu_word)
        self.player2.hp = 0
        self.finish_battle(0)
        # CPU失敗時もターン交代(念のため)
        self.player1_turn = not self.player1_turn
        ret = self._make_response()
        self.word = ""
        self.events = []
        return ret

    def get_cpu_word(self):
        candidates = self.sb_info.get_typed_word_candidates(self.character)
        for word in candidates:
            if not self._is_used(word): return word
        return ""

