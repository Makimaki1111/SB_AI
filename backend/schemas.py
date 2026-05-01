from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Optional, Any, Union

class BattleEvent(BaseModel):
    """バトル中に発生する個別のイベント（ダメージ、回復、特性発動など）"""
    model_config = ConfigDict(populate_by_name=True)
    
    type: str = Field(..., description="イベントの種類: damage, cure, revive, stat_change, ability_trigger, ability_changed, message")
    message: str = Field("", description="表示用メッセージ")
    target: Optional[str] = Field(None, description="対象の絶対ID (p1, p2, p1a など)")
    attacker: Optional[str] = Field(None, description="行動者の絶対ID")
    damage: Optional[int] = None
    amount: Optional[int] = None # 回復量など
    stat_type: Optional[str] = None # attack, defense
    new_rank: Optional[int] = None
    hp: Optional[int] = None # revive時のHP
    lives: Optional[int] = None # revive時の残機
    new_ability: Optional[str] = None
    new_ability_change_count: Optional[int] = None
    poison_target: Optional[str] = None
    new_ranks: Optional[Dict[str, Dict[str, int]]] = None # 一括ランク変化用

class CharacterState(BaseModel):
    """個別のキャラクターの状態"""
    model_config = ConfigDict(populate_by_name=True)

    name: str
    hp: int
    max_hp: int
    atk: int = Field(..., alias="attack_rank")
    def_: int = Field(..., alias="defense_rank")
    types: List[str]
    is_poison: bool
    ability: str
    ability_change_count: int
    lives: Optional[int] = None
    owner_id: str

class BattleState(BaseModel):
    """バトル全体の現在の状態"""
    room_id: str
    character: str
    is_my_turn: bool
    turn: int
    last_actor_id: Optional[str] = None
    word: Optional[str] = ""
    characters: Dict[str, CharacterState] = {}
    winner_team: Optional[int] = None # 0: Team1, 1: Team2
    ally_win: Optional[bool] = None # フロントエンド向け勝敗判定
    ally_max_lives: Optional[int] = None
    foe_max_lives: Optional[int] = None
    current_actor_id: Optional[str] = None
    current_owner_id: Optional[str] = None

class BattleResponse(BaseModel):
    """サーバーからクライアントへ送る標準レスポンス"""
    type: str = "accepted"
    state: BattleState
    events: List[BattleEvent] = []
