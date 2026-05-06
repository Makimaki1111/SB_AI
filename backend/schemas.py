from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Optional, Any, Union

class BattleEvent(BaseModel):
    """バトル中に発生する個別のイベント（ダメージ、回復、特性発動など）"""
    model_config = ConfigDict(populate_by_name=True)
    
    type: str = Field(..., description="イベントの種類")
    message: str = Field("", description="表示用メッセージ")
    target: Optional[str] = Field(None, description="対象のプレイヤーID")
    attacker: Optional[str] = Field(None, description="攻撃側のプレイヤーID")
    damage: Optional[int] = Field(None, description="ダメージ量")
    amount: Optional[int] = Field(None, description="回復量や変化量")
    stat_type: Optional[str] = Field(None, description="変化したステータス名(attack/defense)")
    new_rank: Optional[int] = Field(None, description="変化後のランク値")
    hp: Optional[int] = Field(None, description="変化後のHP")
    lives: Optional[int] = Field(None, description="変化後のストック数")
    new_ability: Optional[str] = Field(None, description="変更後の特性ID")
    new_ability_change_count: Optional[int] = Field(None, description="残り特性変更回数")
    new_ranks: Optional[Dict[str, Dict[str, int]]] = Field(None, description="複数のステータスが変化した場合のマップ")
    predictions: Optional[Dict[str, str]] = Field(None, description="ダブルバトル等の複数対象への相性予測")
    winner_team: Optional[int] = Field(None, description="バトルの勝者チーム番号")

class CharacterState(BaseModel):
    """個別のキャラクターの状態"""
    model_config = ConfigDict(populate_by_name=True)

    name: str = ""
    hp: int = 0
    max_hp: int = 0
    atk: int = Field(0, alias="attack_rank")
    def_: int = Field(0, alias="defense_rank")
    types: List[str] = []
    is_poison: bool = False
    ability: str = ""
    ability_change_count: int = 0
    lives: Optional[int] = None
    owner_id: str = ""

class BattleState(BaseModel):
    """バトル全体の現在の状態"""
    room_id: str = ""
    character: str = ""
    is_my_turn: bool = False
    turn: int = 1
    last_actor_id: Optional[str] = None
    word: Optional[str] = ""
    characters: Dict[str, CharacterState] = {}
    winner_team: Optional[int] = None
    ally_win: Optional[bool] = None
    ally_max_lives: Optional[int] = None
    foe_max_lives: Optional[int] = None
    current_actor_id: Optional[str] = None
    current_owner_id: Optional[str] = None

class AbilityDisplay(BaseModel):
    """特性の表示用データ"""
    name: str
    description: str
    icon_type: str
    remain_count: Optional[int] = None

class ResponseInfo(BaseModel):
    """レスポンスに付随する追加情報"""
    player_ids: List[str] = []
    id_to_ui_map: Dict[str, str] = {}
    time_limit: Optional[int] = None
    total_time: Optional[int] = None
    # 既存の動的フィールド（pre_check用など）も許容
    model_config = ConfigDict(extra='allow')

class BattleResponse(BaseModel):
    """サーバーからクライアントへ送る標準レスポンス"""
    type: str = "update"
    state: Optional[BattleState] = None
    events: List[BattleEvent] = []
    all_abilities: Optional[Dict[str, AbilityDisplay]] = None
    info: Optional[ResponseInfo] = None
    message: Optional[str] = None
