try:
    from SB_info import SB_info
    from base_battle import BaseBattle
    from constants import *
except ImportError:
    from backend.SB_info import SB_info
    from backend.base_battle import BaseBattle
    from backend.constants import *

from collections import defaultdict
from pydantic import BaseModel
import random
import uuid

# 定数は constants.py に集約されています

class TextInput(BaseModel):
    text: str

class Player:
    def __init__(self, id: str, name: str):
        self.id = id
        self.name = name
        self.hp = MAX_HP
        self.attack_rank = 0
        self.defense_rank = 0
        self.types = [""]
        self.ability = "random"
        self.ability_change_count = ABILITY_CHANGE_COUNT_INIT
        self.food_count = 0
        self.medical_count = 0
        self.poison_turns = 0
        self.poisoner_id = None
        self.leech_turns = 0
        self.leech_target_id = None

    def take_damage(self, damage: int):
        self.hp = max(0, self.hp - damage)

    def heal(self, amount: int):
        self.hp = min(MAX_HP, self.hp + amount)

    @property
    def is_active(self) -> bool:
        return self.hp > 0

    @property
    def is_defeated(self) -> bool:
        return self.hp <= 0

class Ability:
    def __init__(self, name: str, description: str, icon_type: str):
        self.name = name
        self.description = description
        self.icon_type = icon_type
        self.replaces_damage = False

    def check_condition(self, player: Player, types: list, word: str) -> bool:
        return False

    def apply_after_effect(self, player: Player, battle: 'BaseBattle'):
        pass

    def apply_damage_replacement_effect(self, player: Player, battle: 'BaseBattle'):
        pass

    def get_damage_multiplier(self, types: list, word: str) -> float:
        return 1.0

    def get_food_recovery_amount(self, default_amount: int) -> int:
        return default_amount

    def should_ignore_food_limit(self) -> bool:
        return False

    def get_violence_penalty_reduction(self) -> int:
        return 0

    def on_receive_damage(self, player: Player, attacker: Player, damage: int, effect: float, battle: 'BaseBattle'):
        pass

    def should_force_critical(self, types: list) -> bool:
        return False

    def get_display_data(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "icon_type": self.icon_type
        }

class TypePowerUpAbility(Ability):
    def __init__(self, name: str, description: str, icon_type: str, target_type: str, damage_multiplier: float = 1.5):
        super().__init__(name, description, icon_type)
        self.target_type = target_type
        self.damage_multiplier = damage_multiplier

    def get_damage_multiplier(self, types: list, word: str) -> float:
        if self.target_type in types:
            return self.damage_multiplier
        return 1.0

class TypeStatBoostAbility(Ability):
    def __init__(self, name: str, description: str, icon_type: str, target_type: str, boost_amount: int, stat_type: str = "attack"):
        super().__init__(name, description, icon_type)
        self.target_type = target_type
        self.boost_amount = boost_amount
        self.stat_type = stat_type
        self.replaces_damage = True

    def check_condition(self, player: Player, types: list, word: str) -> bool:
        return self.target_type in types

    def apply_damage_replacement_effect(self, player: Player, battle: 'BaseBattle'):
        if self.stat_type == "attack":
            player.attack_rank = min(MAX_RANK, player.attack_rank + self.boost_amount)
            new_rank = player.attack_rank
        else:
            player.defense_rank = min(MAX_RANK, player.defense_rank + self.boost_amount)
            new_rank = player.defense_rank

        stat_name = "攻撃" if self.stat_type == "attack" else "防御"
        event = {
            "type": "stat_up",
            "message": f"{stat_name}が上がった！(現在{battle.sb_info.rank_to_power(new_rank)}倍)",
            "stat_type": self.stat_type,
            "new_rank": new_rank
        }
        if hasattr(battle, "player1"):
            event["player"] = "ally" if player.id == battle.player1.id else "foe"
        else:
            event["target"] = player.id
        battle.events.append(event)

class MukimukiAbility(Ability):
    def __init__(self):
        super().__init__(name="むきむき", description="暴力タイプの言葉を使っても攻撃がすこししか下がらなくなる", icon_type="暴力")

    def get_violence_penalty_reduction(self) -> int:
        return 1

class LeechSeedAbility(Ability):
    def __init__(self):
        super().__init__(name="やどりぎ", description="植物タイプの言葉を使うとダメージを与える代わりに相手にやどりぎを植え付ける", icon_type="植物")
        self.replaces_damage = True

    def check_condition(self, player: Player, types: list, word: str) -> bool:
        return "植物" in types and player.leech_turns == 0

    def apply_damage_replacement_effect(self, player: Player, battle: 'BaseBattle'):
        player.leech_turns = LEECH_SEED_TURNS
        # ターゲットの特定
        if hasattr(battle, "player1"):
            opponent = battle.player2 if player.id == battle.player1.id else battle.player1
            player.leech_target_id = opponent.id
            event = {
                "type": "ability_trigger",
                "message": "相手に種を植え付けた！",
                "player": "ally" if player.id == battle.player1.id else "foe"
            }
            battle.events.append(event)
        else:
            # ダブルバトルの場合は要件に応じて実装
            pass

class LongWordBonusAbility(Ability):
    def __init__(self):
        super().__init__(name="おれのことばのもじすうがおおいほどあいてへのダメージがおおきくなるけんについて", description="言葉の文字数が多いほど威力が大きくなる", icon_type="物語")

    def get_damage_multiplier(self, types: list, word: str) -> float:
        length = len(word)
        if length >= 7: return 2.0
        elif length == 6: return 1.5
        return 1.0

class RevolutionAbility(Ability):
    def __init__(self):
        super().__init__(name="かくめい", description="遊びタイプの言葉を使うたびに自分と相手の能力変化をひっくり返す", icon_type="遊び")

    def check_condition(self, player: Player, types: list, word: str) -> bool:
        return "遊び" in types

    def apply_after_effect(self, player: Player, battle: 'BaseBattle'):
        new_ranks = {}
        for p in battle.players:
            if not p.is_defeated:
                p.attack_rank *= -1
                p.defense_rank *= -1
                new_ranks[p.id] = {"attack_rank": p.attack_rank, "defense_rank": p.defense_rank}

        event = {
            "type": "ability_trigger",
            "message": "全ての能力変化がひっくり返った！"
        }
        if hasattr(battle, "player1"):
            event["player"] = "ally" if player.id == battle.player1.id else "foe"
            event["new_ranks"] = {
                "ally_atk": battle.player1.attack_rank,
                "ally_def": battle.player1.defense_rank,
                "foe_atk": battle.player2.attack_rank,
                "foe_def": battle.player2.defense_rank
            }
        else:
            event["new_ranks"] = new_ranks
        battle.events.append(event)

class TyphoonIkkaAbility(Ability):
    def __init__(self):
        super().__init__(name="たいふういっか", description="天気タイプの言葉を使うと自分と相手の能力変化をもとに戻す", icon_type="天気")

    def check_condition(self, player: Player, types: list, word: str) -> bool:
        return "天気" in types

    def apply_after_effect(self, player: Player, battle: 'BaseBattle'):
        new_ranks = {}
        for p in battle.players:
            if not p.is_defeated:
                p.attack_rank = 0
                p.defense_rank = 0
                new_ranks[p.id] = {"attack_rank": 0, "defense_rank": 0}

        event = {
            "type": "ability_trigger",
            "message": "すべての能力変化が元に戻った！"
        }
        if hasattr(battle, "player1"):
            event["player"] = "ally" if player.id == battle.player1.id else "foe"
            event["new_ranks"] = {"ally_atk": 0, "ally_def": 0, "foe_atk": 0, "foe_def": 0}
        else:
            event["new_ranks"] = new_ranks
        battle.events.append(event)

class IkasuiAbility(Ability):
    def __init__(self):
        super().__init__(name="いかすい", description="いくらでも食べることができる", icon_type="食べ物")

    def should_ignore_food_limit(self) -> bool:
        return True

class IshokudogenAbility(Ability):
    def __init__(self):
        super().__init__(name="いしょくどうげん", description="食べ物タイプの言葉で医療タイプと同じ効果が得られる", icon_type="医療")

    def get_food_recovery_amount(self, default_amount: int) -> int:
        return MEDICAL_RECOVERY_AMOUNT

class HokenAbility(Ability):
    def __init__(self):
        super().__init__(name="ほけん", description="効果抜群のダメージを受けると攻撃力がぐぐーんと上がる", icon_type="社会")

    def on_receive_damage(self, player: Player, attacker: Player, damage: int, effect: float, battle: 'BaseBattle'):
        if effect > 1:
            player.attack_rank = min(MAX_RANK, player.attack_rank + 3)
            event = {
                "type": "stat_up",
                "message": f"弱点を突かれて攻撃がぐぐーんと上がった！(現在{battle.sb_info.rank_to_power(player.attack_rank)}倍)",
                "stat_type": "attack",
                "new_rank": player.attack_rank
            }
            if hasattr(battle, "player1"):
                event["player"] = "ally" if player.id == battle.player1.id else "foe"
            else:
                event["target"] = player.id
            battle.events.append(event)

class KarateAbility(Ability):
    def __init__(self):
        super().__init__(name="からて", description="人体タイプの言葉を使った時に必ず相手の急所に当たる", icon_type="人体")

    def should_force_critical(self, types: list) -> bool:
        return "人体" in types

class ZuboshiAbility(Ability):
    def __init__(self):
        super().__init__(name="ずぼし", description="暴言タイプの言葉を使った時に必ず相手の急所に当たる", icon_type="暴言")

    def should_force_critical(self, types: list) -> bool:
        return "暴言" in types

class DebuggerAbility(Ability):
    def __init__(self):
        super().__init__(name="デバッガー", description="まだタイプのついていない言葉の威力が上がる", icon_type="ノーマル")

    def get_damage_multiplier(self, types: list, word: str) -> float:
        if not types: return 1.9
        return 1.0

class DokubariAbility(Ability):
    def __init__(self):
        super().__init__(name="どくばり", description="虫タイプの言葉を使うと相手を毒状態にできる", icon_type="虫")

    def check_condition(self, player: Player, types: list, word: str) -> bool:
        return "虫" in types

    def apply_after_effect(self, player: Player, battle: 'BaseBattle'):
        if hasattr(battle, "player1"):
            opponent = battle.player2 if player.id == battle.player1.id else battle.player1
            if opponent.poison_turns == 0:
                opponent.poison_turns = 1
                opponent.poisoner_id = player.id
                event = {
                    "type": "ability_trigger",
                    "message": "毒を受けた！",
                    "player": "ally" if player.id == battle.player1.id else "foe",
                    "poison_target": "ally" if opponent.id == battle.player1.id else "foe"
                }
                battle.events.append(event)

class IkakuAbility(Ability):
    def __init__(self):
        super().__init__(name="いかく", description="動物タイプの言葉を使うとダメージを与える代わりに相手の攻撃力を下げる", icon_type="動物")
        self.replaces_damage = True

    def check_condition(self, player: Player, types: list, word: str) -> bool:
        return "動物" in types

    def apply_damage_replacement_effect(self, player: Player, battle: 'BaseBattle'):
        if hasattr(battle, "player1"):
            opponent = battle.player2 if player.id == battle.player1.id else battle.player1
            opponent.attack_rank = max(MIN_RANK, opponent.attack_rank - 1)
            event = {
                "type": "stat_down",
                "message": f"いかくで攻撃が下がった！(現在{battle.sb_info.rank_to_power(opponent.attack_rank)}倍)",
                "player": "foe" if player.id == battle.player1.id else "ally",
                "stat_type": "attack",
                "new_rank": opponent.attack_rank
            }
            battle.events.append(event)

def get_default_abilities() -> dict:
    return {
        "ikaku": IkakuAbility(),
        "debugger": DebuggerAbility(),
        "passion": TypeStatBoostAbility("じょうねつ", "感情タイプの言葉を使うとダメージを与える代わりに攻撃力が上がる", "感情", "感情", 1),
        "kyojin": TypePowerUpAbility("きょじん", "人物タイプの言葉の威力が上がる", "人物", "人物", 1.5),
        "ikasui": IkasuiAbility(),
        "rocknroll": TypeStatBoostAbility("ロックンロール", "芸術タイプの言葉を使うとダメージを与える代わりに攻撃力がぐーんと上がる", "芸術", "芸術", 2),
        "mukimuki": MukimukiAbility(),
        "training": TypeStatBoostAbility("トレーニング", "スポーツタイプの言葉を使うとダメージを与える代わりに攻撃力が上がる", "スポーツ", "スポーツ", 1),
        "hoken": HokenAbility(),
        "procrastination": TypeStatBoostAbility("さきのばし", "時間タイプの言葉を使うとダメージを与える代わりに防御力が上がる", "時間", "時間", 1, stat_type="defense"),
        "karate": KarateAbility(),
        "zuboshi": ZuboshiAbility(),
        "ishokudogen": IshokudogenAbility(),
        "kachikochi": TypeStatBoostAbility("かちこち", "機械タイプの言葉を使うとダメージを与える代わりに防御力が上がる", "機械", "機械", 1, stat_type="defense"),
        "dokubari": DokubariAbility(),
        "taifuikka": TyphoonIkkaAbility(),
        "yadorigi": LeechSeedAbility(),
        "jikken": TypePowerUpAbility("じっけん", "理科タイプの言葉の威力が上がる", "理科", "理科", 1.5),
        "global": TypePowerUpAbility("グローバル", "地名タイプの言葉の威力が上がる", "地名", "地名", 1.5),
        "shinkoushin": TypePowerUpAbility("しんこうしん", "宗教タイプの言葉の威力が上がる", "宗教", "宗教", 1.5),
        "revolution": RevolutionAbility(),
        "calculation": TypeStatBoostAbility("けいさん", "数学タイプの言葉を使うとダメージを与える代わりに攻撃力が上がる", "数学", "数学", 1),
        "layering": TypeStatBoostAbility("かさねぎ", "服飾タイプの言葉を使うとダメージを与える代わりに防御力が上がる", "服飾", "服飾", 1, stat_type="defense"),
        "arming": TypeStatBoostAbility("ぶそう", "工作タイプの言葉を使うとダメージを与える代わりに攻撃力が上がる", "工作", "工作", 1),
        "long_word": LongWordBonusAbility()
    }

def get_all_abilities_info() -> dict:
    abilities = get_default_abilities()
    return {k: v.get_display_data() for k, v in abilities.items()}

class Battle_info(BaseBattle):
    def __init__(self, player1_id: str, player2_id: str, sb_info: SB_info, room_id: str | None = None, p1_profile: dict = None, p2_profile: dict = None, p1_max_lives: int = 1, p2_max_lives: int = 1, is_cpu: bool = False):
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
        
        # プロファイルから特性を反映
        if p1_profile and p1_profile.get("ability") in self.abilities:
            self.player1.ability = p1_profile["ability"]
        if p2_profile and p2_profile.get("ability") in self.abilities:
            self.player2.ability = p2_profile["ability"]

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
                "player": "ally" if defeated_player.id == self.player1.id else "foe",
                "message": f"{defeated_player.name}は復帰した！（のこり{lives_left}）",
                "lives": lives_left,
                "hp": MAX_HP
            })

    def try_attack(self, player_id: str, word: str):
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
