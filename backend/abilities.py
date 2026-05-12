try:
    from constants import *
    from player import Player
except ImportError:
    from backend.constants import *
    from backend.player import Player

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
            "new_rank": new_rank,
            "target": battle.get_player_label(player)
        }
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
        opponent = battle.current_target
        if opponent:
            player.leech_target_id = opponent.id
            event = {
                "type": "ability_trigger",
                "message": "相手に種を植え付けた！",
                "attacker": battle.get_player_label(player),
                "target": battle.get_player_label(opponent)
            }
            battle.events.append(event)

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
            "message": "全ての能力変化がひっくり返った！",
            "new_ranks": new_ranks
        }
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
            "message": "すべての能力変化が元に戻った！",
            "new_ranks": new_ranks
        }
        battle.events.append(event)

class IkasuiAbility(Ability):
    def __init__(self):
        super().__init__(name="いかすい", description="いくらでも食べることができる", icon_type="食べ物")

    def should_ignore_food_limit(self) -> bool:
        return True

class IshokudogenAbility(Ability):
    def __init__(self):
        super().__init__(name="いしょくどうげん", description="食べ物タイプの言葉で医療タイプと同じ効果が得られる(毒も治る)", icon_type="医療")

    def get_food_recovery_amount(self, default_amount: int) -> int:
        return MEDICAL_RECOVERY_AMOUNT

    def check_condition(self, player: Player, types: list, word: str) -> bool:
        return "食べ物" in types

    def apply_after_effect(self, player: Player, battle: 'BaseBattle'):
        # 毒を治す (仕様)
        if player.poison_turns > 0:
            player.poison_turns = 0
            player.poisoner_id = None
            battle.events.append({
                "type": "cure_poison",
                "message": f"医食同源の効果で毒が治った！",
                "target": battle.get_player_label(player),
                "new_is_poison": False
            })

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
                "new_rank": player.attack_rank,
                "target": battle.get_player_label(player)
            }
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
        opponent = battle.current_target
        if opponent and opponent.poison_turns == 0:
            opponent.poison_turns = 1
            opponent.poisoner_id = player.id
            event = {
                "type": "ability_trigger",
                "message": "毒を受けた！",
                "target": battle.get_player_label(opponent),
                "attacker": battle.get_player_label(player),
                "new_is_poison": True
            }
            battle.events.append(event)

class IkakuAbility(Ability):
    def __init__(self):
        super().__init__(name="いかく", description="動物タイプの言葉を使うとダメージを与える代わりに相手の攻撃力を下げる", icon_type="動物")
        self.replaces_damage = True

    def check_condition(self, player: Player, types: list, word: str) -> bool:
        return "動物" in types

    def apply_damage_replacement_effect(self, player: Player, battle: 'BaseBattle'):
        opponent = battle.current_target
        if opponent:
            opponent.attack_rank = max(MIN_RANK, opponent.attack_rank - 1)
            event = {
                "type": "stat_down",
                "message": f"いかくで攻撃が下がった！(現在{battle.sb_info.rank_to_power(opponent.attack_rank)}倍)",
                "target": battle.get_player_label(opponent),
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
