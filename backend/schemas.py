from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Optional, Any, Union

class BattleEvent(BaseModel):
    """バトル中に発生する個別のイベント（ダメージ、回復、特性発動など）"""
    model_config = ConfigDict(populate_by_name=True)
    
    type: str = Field(..., description="イベントの種類")
    message: str = Field("", description="表示用メッセージ")
    target: Any = None
    attacker: Any = None
    damage: Any = None
    amount: Any = None
    stat_type: Any = None
    new_rank: Any = None
    hp: Any = None
    lives: Any = None
    new_ability: Any = None
    new_ability_change_count: Any = None
    poison_target: Any = None
    new_ranks: Any = None

class CharacterState(BaseModel):
    """個別のキャラクターの状態"""
    model_config = ConfigDict(populate_by_name=True)

    name: str = ""
    hp: int = 0
    max_hp: int = 0
    atk: int = Field(0, alias="attack_rank")
    def_: int = Field(0, alias="defense_rank")
    types: Any = []
    is_poison: bool = False
    ability: str = ""
    ability_change_count: int = 0
    lives: Any = None
    owner_id: str = ""

class BattleState(BaseModel):
    """バトル全体の現在の状態"""
    room_id: str = ""
    character: str = ""
    is_my_turn: bool = False
    turn: int = 1
    last_actor_id: Any = None
    word: Any = ""
    characters: Any = {}
    winner_team: Any = None
    ally_win: Any = None
    ally_max_lives: Any = None
    foe_max_lives: Any = None
    current_actor_id: Any = None
    current_owner_id: Any = None

class BattleResponse(BaseModel):
    """サーバーからクライアントへ送る標準レスポンス"""
    type: str = "battle_state"
    state: Optional[Any] = None
    events: List[Any] = []
    all_abilities: Optional[Dict[str, Any]] = None
    info: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
