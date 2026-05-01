try:
    from SB_info import SB_info
    from base_battle import BaseBattle
except ImportError:
    from backend.SB_info import SB_info
    from backend.base_battle import BaseBattle

try:
    from player import DoubleBattlePlayer
    from abilities import get_default_abilities, IshokudogenAbility
    from constants import *
except ImportError:
    from backend.player import DoubleBattlePlayer
    from backend.abilities import get_default_abilities, IshokudogenAbility
    from backend.constants import *

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

        self.team1_win = None
        
        # 行動順
        self.turn_order = [self.p1a, self.p2a, self.p1b, self.p2b]
        if random.random() < 0.5:
            self.turn_order = [self.p2a, self.p1a, self.p2b, self.p1b]
        self.current_turn_index = 0

        self.init_character()
        self.last_actor_id = None

    @property
    def is_finished(self) -> bool:
        return self.team1_win is not None

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
        
        ability_id = prof.get("ability")
        if self.mode == "1v1_double" and (char_id == 'p1b' or char_id == 'p2b') and prof.get("ability_2"):
            ability_id = prof.get("ability_2")

        if ability_id in self.abilities:
            char.ability = ability_id
        else:
            char.ability = random.choice(self.ability_ids)
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
        if t1_dead: self.team1_win = False
        elif t2_dead: self.team1_win = True
        return self.team1_win is not None

    def _patch_ability_events(self, current_actor, target_actor):
        """特性イベントのフォーマットをダブルバトル用に調整"""
        for event in self.events:
            if "player" in event and event["player"] in ("ally", "foe"):
                event["target"] = current_actor.id if event["player"] == "ally" else target_actor.id
                del event["player"]
            if "poison_target" in event and event["poison_target"] in ("ally", "foe"):
                event["poison_target"] = current_actor.id if event["poison_target"] == "ally" else target_actor.id
            if "new_ranks" in event:
                old = event["new_ranks"]
                if "ally_atk" in old:
                    event["new_ranks"] = {
                        current_actor.id: {"attack_rank": old["ally_atk"], "defense_rank": old["ally_def"]},
                        target_actor.id: {"attack_rank": old["foe_atk"], "defense_rank": old["foe_def"]}
                    }

    def try_attack(self, player_id: str, word: str, target_char_id: str = None):
        if self.team1_win is not None: return self._make_response()
        
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
        self.execute_attack_flow(current_actor, target_actor, word, types, ability_obj, is_single=False)

        prev_index = self.current_turn_index
        # get_current_actor は内部で生存者が見つかるまで _advance_turn_index を呼ぶ可能性がある
        self.get_current_actor() # 次の行動者を決定 (内部で _advance_turn_index が呼ばれる)
        
        # 生存者全員が行動し終わった（インデックスが一周した）タイミングで継続ダメージ
        if self.current_turn_index <= prev_index:
            self._process_end_of_turn_effects(current_actor, target_actor)
            
        self._check_win_condition()
        self._patch_ability_events(current_actor, target_actor)
        self.record_used_word(word, current_actor.id)
        self.last_actor_id = current_actor.id
        ret = self._make_response()
        self.word, self.events = "", []
        return ret

    def execute_cpu_turn(self):
        actor = self.get_current_actor()
        cpu_word = self.get_cpu_word()
        if cpu_word:
            valid_targets = [p.id for p in self.team1 if not p.is_defeated]
            if not valid_targets:
                self.team1_win = False
                return self._make_response()
            return self.try_attack(actor.owner_id, cpu_word, target_char_id=random.choice(valid_targets))
        else:
            actor.hp = 0
            self.events.append({"message": f"{actor.name}は ことばを思いつかなかった！", "target": actor.id})
            if not self._check_win_condition(): self._advance_turn_index()
            return self._make_response()

    def get_cpu_word(self):
        candidates = self.sb_info.get_typed_word_candidates(self.character)
        for word in candidates:
            if not self._is_used(word): return word
        return ""

    def _is_used(self, word: str) -> bool:
        return word in self.used

    def timeout(self):
        if self.team1_win is not None: return self._make_response()
        current_actor = self.get_current_actor()
        timed_out_team = self.team1 if current_actor in self.team1 else self.team2
        for p in timed_out_team:
            if not p.is_defeated:
                dmg = p.hp
                p.take_damage(dmg)
                self.events.append({"type": "damage", "message": f"時間切れ！{p.name}は倒れた！", "target": p.id, "damage": dmg})
        self._check_win_condition()
        ret = self._make_response()
        self.events = []
        return ret

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
            "char_id": char.id,
            "new_ability": new_ability_id,
            "new_ability_change_count": char.ability_change_count
        })
        res = self._make_response()
        self.events = []
        return res

    def make_init_response(self, player_id: str) -> dict:
        res = self._make_response()
        res["type"] = "init_double_battle"
        res["all_abilities"] = self._get_serializable_abilities()
        return self.get_personalized_response(res, player_id)

    def _get_serializable_abilities(self):
        return {k: {"name": v.name, "description": v.description, "icon_type": v.icon_type} for k, v in self.abilities.items()}

    def _make_response(self):
        current_actor = self.get_current_actor()
        return {
            "type": "turn_result",
            "room_id": self.room_id,
            "mode": self.mode,
            "is_cpu": self.is_cpu,
            "turn": self.turn,
            "current_actor_id": current_actor.id,
            "current_owner_id": current_actor.owner_id,
            "last_actor_id": self.last_actor_id,
            "character": self.character,
            "word": self.word,
            "events": self.events,
            "team1_win": self.team1_win,
            "characters": {
                "p1a": self._serialize_player(self.p1a),
                "p1b": self._serialize_player(self.p1b),
                "p2a": self._serialize_player(self.p2a),
                "p2b": self._serialize_player(self.p2b),
            }
        }

    def _serialize_player(self, p: DoubleBattlePlayer):
        return {
            "id": p.id, "name": p.name, "hp": p.hp, "maxHp": MAX_HP,
            "attack_rank": p.attack_rank, "defense_rank": p.defense_rank,
            "types": p.types, "ability": p.ability, "ability_change_count": p.ability_change_count,
            "is_defeated": p.is_defeated, "is_poison": p.poison_turns > 0, "owner_id": p.owner_id
        }

    def get_personalized_response(self, base_res: dict, request_player_id: str) -> dict:
        import copy
        new_res = copy.deepcopy(base_res)
        is_t1 = any(p.owner_id == request_player_id for p in self.team1)
        if "characters" in new_res:
            chars = new_res["characters"]
            for k, char_info in chars.items():
                if char_info.get("owner_id") != request_player_id: char_info["owner_id"] = "opponent"
                if (is_t1 and k in ["p2a", "p2b"]) or (not is_t1 and k in ["p1a", "p1b"]):
                    char_info["ability"] = "secret"
                    char_info["ability_change_count"] = ABILITY_CHANGE_COUNT_INIT
        if "current_owner_id" in new_res and new_res["current_owner_id"] != request_player_id:
            new_res["current_owner_id"] = "opponent"
        if "events" in new_res:
            masked_events = []
            for e in new_res["events"]:
                if e.get("type") == "ability_changed":
                    cid = e.get("char_id")
                    if (is_t1 and cid in ["p2a", "p2b"]) or (not is_t1 and cid in ["p1a", "p1b"]): continue
                masked_events.append(e)
            new_res["events"] = masked_events
        return new_res

    def handle_disconnection(self, player_id: str, message: str = "あいてが通信を切断しました。"):
        if self.team1_win is not None: return None
        for p in self.team1 + self.team2:
            if p.owner_id == player_id and not p.is_defeated:
                p.hp = 0
                self.events.append({"type": "message", "message": f"{p.name} は逃げ出した！"})
        self.events.append({"type": "error", "message": message})
        self._check_win_condition()
        ret = self._make_response()
        self.events = []
        return ret
