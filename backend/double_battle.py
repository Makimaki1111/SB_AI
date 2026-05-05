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
        self.is_cpu = is_cpu
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

    @property
    def is_finished(self) -> bool:
        return self.winner_team is not None

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

    def get_current_actor(self) -> DoubleBattlePlayer:
        loops = 0
        while self.turn_order[self.current_turn_index].is_defeated and loops < 4:
            self._advance_turn_index()
            loops += 1
        return self.turn_order[self.current_turn_index]

    def _advance_turn_index(self):
        self.current_turn_index = (self.current_turn_index + 1) % 4
        if self.current_turn_index == 0:
            self.turn += 1

    def _check_win_condition(self):
        t1_dead = all(p.is_defeated for p in self.team1)
        t2_dead = all(p.is_defeated for p in self.team2)
        if t1_dead: self.winner_team = 1
        elif t2_dead: self.winner_team = 0
        return self.is_finished

    def _patch_ability_events(self, current_actor, target_actor):
        """特性イベントのフォーマットをダブルバトル用に調整"""
        for event in self.events:
            if "target" in event and event["target"] in ("ally", "foe"):
                event["target"] = current_actor.id if event["target"] == "ally" else target_actor.id
            if "new_ranks" in event:
                old = event["new_ranks"]
                if "ally_atk" in old:
                    event["new_ranks"] = {
                        current_actor.id: {"attack_rank": old["ally_atk"], "defense_rank": old["ally_def"]},
                        target_actor.id: {"attack_rank": old["foe_atk"], "defense_rank": old["foe_def"]}
                    }

    def try_attack(self, player_id: str, word: str, target_char_id: str = None):
        if self.is_finished: return self._make_response()
        
        current_actor = self.get_current_actor()
        if player_id != current_actor.owner_id:
            return {"type": "error", "message": "自分のターンではありません"}

        word = self.katakana_to_hiragana(word)
        if not word or word[0] != self.character:
            return {"type": "error", "message": "しりとりのルールを守ってください"}
        if self._is_used(word):
            return {"type": "error", "message": "その単語は既に使用されています"}
        if not self.sb_info.include_in_all_words(word):
            return {"type": "error", "message": "辞書にない単語です"}

        enemies = self.team2 if current_actor in self.team1 else self.team1
        target_actor = None
        if target_char_id:
            for e in enemies:
                if e.id == target_char_id and not e.is_defeated:
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
        self._patch_ability_events(current_actor, target_actor)
        self.record_used_word(word, current_actor.id)
        self.last_actor_id = current_actor.id
        self._advance_turn_index()
        ret = self._make_response()
        self.word, self.events = "", []
        return ret

    def timeout(self):
        """タイムアウト処理 (DoubleBattle用にターン進行を追加)"""
        if self.is_finished: return self._make_response()
        current_actor = self.get_current_actor()
        if not current_actor: return self._make_response()

        current_actor.hp = 0
        self.events.append({
            "type": "damage", 
            "message": f"時間切れ！{current_actor.name}は力尽きた…", 
            "target": self.get_player_label(current_actor), 
            "damage": 0, 
            "hp": 0
        })
        
        team_idx = self._get_team_index(current_actor)
        if team_idx != -1:
            self.winner_team = 1 - team_idx
            
        # ターンを進行
        self._advance_turn_index()
            
        ret = self._make_response()
        self.events = []
        return ret

    def execute_cpu_turn(self):
        actor = self.get_current_actor()
        cpu_word = self.get_cpu_word()
        if cpu_word:
            valid_targets = [p.id for p in self.team1 if not p.is_defeated]
            if not valid_targets:
                self.winner_team = 1
                return self._make_response()
            return self.try_attack(actor.owner_id, cpu_word, target_char_id=random.choice(valid_targets))
        else:
            actor.hp = 0
            self.events.append({"message": f"{actor.name}は ことばを思いつかなかった！", "target": actor.id})
            self._check_win_condition()
            # CPU失敗時もターン進行
            self._advance_turn_index()
            return self._make_response()

    def get_cpu_word(self):
        candidates = self.sb_info.get_typed_word_candidates(self.character)
        for word in candidates:
            if not self._is_used(word): return word
        return ""

    def _is_used(self, word: str) -> bool:
        return word in self.used

    def change_ability(self, player_id: str, char_id: str, new_ability_id: str):
        char = getattr(self, char_id, None)
        if not char or char.owner_id != player_id: return {"type": "error", "message": "不正な操作です"}
        if char.ability_change_count <= 0: return {"type": "error", "message": "特性はもう変更できません"}
        if new_ability_id not in self.abilities: return {"type": "error", "message": "存在しない特性です"}
        
        char.ability_change_count -= 1
        char.ability = new_ability_id
        self.events.append({
            "type": "ability_changed",
            "message": f"{char.name}の特性が「{self.abilities[new_ability_id].name}」に変わった！",
            "target": char.id,
            "new_ability": new_ability_id,
            "new_ability_change_count": char.ability_change_count
        })
        res = self._make_response()
        self.events = []
        return res

    def make_init_response(self, player_id: str, time_limit: int = None) -> dict:
        res = self._make_response()
        res["type"] = "made_room"
        res["all_abilities"] = self._get_serializable_abilities()
        return self.get_personalized_response(res, player_id, time_limit=time_limit)


    def _make_response(self) -> dict:
        chars = {}
        for p in self.players:
            chars[p.id] = CharacterState(
                name=p.name, hp=p.hp, max_hp=MAX_HP,
                attack_rank=p.attack_rank, defense_rank=p.defense_rank,
                types=p.types, is_poison=p.poison_turns > 0,
                ability=p.ability, ability_change_count=p.ability_change_count,
                lives=None, owner_id=p.owner_id
            )
        
        current_actor = self.get_current_actor()
        state = BattleState(
            room_id=self.room_id,
            character=self.character,
            is_my_turn=False, # ここでは仮定。get_personalized_response で上書き
            turn=self.turn,
            last_actor_id=self.last_actor_id,
            word=self.word,
            characters=chars,
            winner_team=self.winner_team,
            ally_win=None, # get_personalized_response で設定
            current_actor_id=current_actor.id,
            current_owner_id=current_actor.owner_id
        )
        
        events = [BattleEvent(**e) for e in self.events if isinstance(e, dict)]
        res = BattleResponse(state=state, events=events).model_dump(by_alias=True)
        res["type"] = "battle_end" if self.is_finished else "update"
        return res

    def _serialize_player(self, p: DoubleBattlePlayer):
        # CharacterState を使用するため不要になるが、互換性のために残すか削除を検討
        pass
        return {
            "id": p.id, "name": p.name, "hp": p.hp, "maxHp": MAX_HP,
            "attack_rank": p.attack_rank, "defense_rank": p.defense_rank,
            "types": p.types, "ability": p.ability, "ability_change_count": p.ability_change_count,
            "is_defeated": p.is_defeated, "is_poison": p.poison_turns > 0, "owner_id": p.owner_id
        }

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
            state["ally_win"] = (is_t1 and self.winner_team == 0) or (not is_t1 and self.winner_team == 1)
        
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

