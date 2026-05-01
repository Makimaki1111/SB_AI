try:
    from constants import MAX_HP, ABILITY_CHANGE_COUNT_INIT
except ImportError:
    from backend.constants import MAX_HP, ABILITY_CHANGE_COUNT_INIT

class Player:
    """シングルバトル用のプレイヤークラス"""
    def __init__(self, id: str, name: str):
        self.id = id
        self.owner_id = id
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

class DoubleBattlePlayer(Player):
    """ダブルバトル用に拡張したプレイヤークラス"""
    def __init__(self, player_id: str, character_id: str, name: str):
        super().__init__(character_id, name)
        self.owner_id = player_id # 操作権を持つユーザー
