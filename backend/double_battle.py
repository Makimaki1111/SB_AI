try:
    from base_battle import BaseBattle
    from player import Player, DoubleBattlePlayer
    from SB_info import SB_info
    from abilities import get_default_abilities
    from constants import MAX_HP, ABILITY_CHANGE_COUNT_INIT
    from schemas import BattleResponse, BattleState, CharacterState, BattleEvent
except ImportError:
    from backend.base_battle import BaseBattle
    from backend.player import Player, DoubleBattlePlayer
    from backend.SB_info import SB_info
    from backend.abilities import get_default_abilities
    from backend.constants import MAX_HP, ABILITY_CHANGE_COUNT_INIT
    from backend.schemas import BattleResponse, BattleState, CharacterState, BattleEvent

from collections import defaultdict
from pydantic import BaseModel
import random
import uuid

class DoubleBattle(BaseBattle):
    """
    ダブルバトルの状態を管理するクラス。
    """
    def __init__(self, mode: str, team1_players: list, team2_players: list, sb_info: SB_info, room_id: str | None = None, profiles: dict = None, is_cpu: bool = False):
        super().__init__(sb_info, room_id)
        self.mode = mode
        self.is_cpu_battle = is_cpu
        self.abilities = get_default_abilities()
        self.ability_ids = list(self.abilities.keys())
        
        profiles = profiles or {}

        # キャラクター生成
        self.p1a = self._create_character(team1_players[0], 'p1a', "チーム1A", profiles)
        self.p1b = self._create_character(team1_players[1] if len(team1_players) > 1 else team1_players[0], 'p1b', "チーム1B", profiles)
        
        if self.is_cpu:
            self.p2a = self._create_character(team2_players[0], 'p2a', "CPU_A", profiles)
            self.p2b = self._create_character(team2_players[1] if len(team2_players) > 1 else team2_players[0], 'p2b', "CPU_B", profiles)
        else:
            self.p2a = self._create_character(team2_players[0], 'p2a', "チーム2A", profiles)
            self.p2b = self._create_character(team2_players[1] if len(team2_players) > 1 else team2_players[0], 'p2b', "チーム2B", profiles)

        self.team1 = [self.p1a, self.p1b]
        self.team2 = [self.p2a, self.p2b]
        self.players = self.team1 + self.team2 # BaseBattle 用

        # 行動順
        self.turn_order = [self.p1a, self.p2a, self.p1b, self.p2b]
        if random.random() < 0.5:
            self.turn_order = [self.p2a, self.p1a, self.p2b, self.p1b]
        self.current_turn_index = 0

        self.init_character()
        self.last_actor_id = None
        
        self.events = [{"type": "message", "message": "マッチングした！"}]



    @property
    def is_cpu_turn(self) -> bool:
        return self.is_cpu and self.get_current_actor().owner_id.startswith("cpu_")

    def init_character(self):
        self.character = random.choice(self.START_CHARACTERS)


    def _create_character(self, owner_id: str, char_id: str, default_name: str, profiles: dict) -> DoubleBattlePlayer:
        prof = profiles.get(owner_id, {})
        name = prof.get("name", default_name)
        if len(name) > 6: name = name[:6]
        suffix = char_id[-1].upper()
        if not (name.endswith(f"({suffix})") or name.endswith(suffix)):
            name = f"{name}({suffix})"

        char = DoubleBattlePlayer(owner_id, char_id, name)
        
        # 特性の割り当て
        ability_id = prof.get("ability")
        # 1v1ダブルモードの2体目の場合は ability_2 を優先
        if self.mode == "1v1_double" and (char_id == 'p1b' or char_id == 'p2b') and prof.get("ability_2"):
            ability_id = prof.get("ability_2")
            
        if ability_id in self.abilities and ability_id != "random":
            char.ability = ability_id
        else:
            # ランダムまたは無効なIDの場合
            valid_ids = [k for k in self.abilities.keys() if k != "random"]
            char.ability = random.choice(valid_ids) if valid_ids else "ikaku"
            
        return char


    @property
    def is_double(self) -> bool:
        return True

    @property
    def time_limit(self) -> int:
        return 30


    def _check_win_condition(self):
        t1_dead = all(p.is_defeated for p in self.team1)
        t2_dead = all(p.is_defeated for p in self.team2)
        if t1_dead and self.winner_team is None: 
            self.finish_battle(1)
        elif t2_dead and self.winner_team is None: 
            self.finish_battle(0)
        return self.is_finished


    def try_attack(self, player_id: str, word: str, target_id: str = None):
        if self.is_finished: return self._make_response()
        
        # 基本バリデーションをBaseBattleに委譲
        err = self._validate_word(player_id, word)
        if err: return err

        current_actor = self.get_current_actor()
        enemies = self.get_enemies(current_actor)
        target_actor = None
        if target_id:
            for e in enemies:
                if e.id == target_id and not e.is_defeated:
                    target_actor = e
                    break
        if not target_actor:
            alive_enemies = [e for e in enemies if not e.is_defeated]
            if not alive_enemies: return {"type": "error", "message": "ターゲットがいません"}
            target_actor = random.choice(alive_enemies)

        self.word = word
        types = [t for t in self.sb_info.get_types(word) if t]
        current_actor.types = types[:]
        ability_obj = self.abilities.get(current_actor.ability)

        # BaseBattleの共通フローに委譲
        self.execute_attack_flow(current_actor, target_actor, word, types, ability_obj)

        self._process_end_of_turn_effects(current_actor, target_actor)
        self._check_win_condition()
        self.record_used_word(word, current_actor.id)
        self.last_actor_id = current_actor.id
        self.advance_turn()
        
        ret = self._make_response()
        self.word, self.events = "", []
        return ret

    def get_enemies(self, player: DoubleBattlePlayer) -> list[DoubleBattlePlayer]:
        return self.team2 if player in self.team1 else self.team1

    def get_team_index(self, player_id: str) -> int:
        if any(p.owner_id == player_id or p.id == player_id for p in self.team1): return 0
        if any(p.owner_id == player_id or p.id == player_id for p in self.team2): return 1
        return -1

    def format_predictions(self, enemies: list[DoubleBattlePlayer], at1: str, at2: str) -> dict:
        predictions = {}
        for enemy in enemies:
            if not enemy.is_defeated:
                dt1 = enemy.types[0] if len(enemy.types) >= 1 else ""
                dt2 = enemy.types[1] if len(enemy.types) >= 2 else ""
                effect = self.sb_info.type_effect(at1, at2, dt1, dt2)
                predictions[enemy.id] = self._get_effect_message(effect)
        return {"predictions": predictions}

    def timeout(self):
        """タイムアウト処理 (DoubleBattle用にターン進行を追加)"""
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
        
        team_idx = self.get_team_index(current_actor)
        if team_idx != -1:
            self.finish_battle(1 - team_idx)
            
        # ターンを進行
        self.advance_turn()
            
        ret = self._make_response()
        self.events = []
        return ret

    def _select_cpu_target(self, actor: Player) -> str | None:
        """CPUの攻撃対象IDを返す (敵チームからランダム)"""
        enemies = self.get_enemies(actor)
        alive_enemies = [e for e in enemies if not e.is_defeated]
        if not alive_enemies: return None
        return random.choice(alive_enemies).id

    def _is_used(self, word: str) -> bool:
        return word in self.used




    def _make_response(self) -> dict:
        # 決着時のメッセージをイベントの最後に追加 (本家再現)
        if self.winner_team is not None:
            self.finish_battle(self.winner_team)

        # 共通メソッドを呼び出し (DoubleBattle特有のフィールドは現状なし)
        res = self._create_base_response(self.players)
        self.events = [] # 送信後にイベントをクリア
        return res

    def _handle_cpu_failure(self, actor: Player) -> dict:
        """CPUが単語を思いつかなかった時の処理"""
        self.events.append({
            "type": "message",
            "message": f"{actor.name}は単語が思いつかない！"
        })
        actor.hp = 0
        self._handle_knockout(actor)
        self.last_actor_id = actor.id
        self.advance_turn()
        return self._make_response()

    def get_personalized_response(self, base_res: dict, request_player_id: str, time_limit: int = None) -> dict:
        import copy
        new_res = copy.deepcopy(base_res)
        state = new_res["state"]
        
        # 自分のターンかどうかを判定
        current_actor = self.get_current_actor()
        state["is_my_turn"] = (current_actor.owner_id == request_player_id)
        
        is_t1 = any(p.owner_id == request_player_id for p in self.team1)
        # 勝敗ラベルの付与
        if self.winner_team is not None:
            ally_win = self.is_player_winner(request_player_id)
            state["ally_win"] = ally_win
            self._personalize_events(new_res.get("events", []), ally_win)
        
        # 敵の特性をマスク
        for k, char_info in state["characters"].items():
            if char_info["owner_id"] != request_player_id:
                char_info["owner_id"] = "opponent"
                if (is_t1 and k in ["p2a", "p2b"]) or (not is_t1 and k in ["p1a", "p1b"]):
                    char_info["ability"] = "secret"
                    char_info["ability_change_count"] = ABILITY_CHANGE_COUNT_INIT
        
        # イベントのマスク
        masked_events = []
        for e in new_res["events"]:
            if e.get("type") == "ability_changed":
                cid = e.get("target") # schemas.py では target を使う方針
                if (is_t1 and cid in ["p2a", "p2b"]) or (not is_t1 and cid in ["p1a", "p1b"]): continue
            masked_events.append(e)
        new_res["events"] = masked_events
        # フロントエンド演出用のマッピング情報
        team1_ids = [p.id for p in self.team1]
        team2_ids = [p.id for p in self.team2]
        
        id_to_ui_map = {}
        if is_t1:
            id_to_ui_map = {"p1a": "p1a", "p1b": "p1b", "p2a": "p2a", "p2b": "p2b"}
            player_ids = team1_ids
        else:
            # 自分がチーム2の場合、画面上の p1a/p1b 位置に p2a/p2b を表示させる
            id_to_ui_map = {"p2a": "p1a", "p2b": "p1b", "p1a": "p2a", "p1b": "p2b"}
            player_ids = team2_ids

        new_res["info"] = {
            "player_ids": player_ids,
            "id_to_ui_map": id_to_ui_map,
            "time_limit": time_limit,
            "total_time": time_limit
        }
        
        return new_res

