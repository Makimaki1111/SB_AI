/**
 * しりとりバトルの型定義ファイル
 * バックエンド (backend/schemas.py) の Pydantic モデルと同期しています。
 */

export type AbilityId = string;

export interface CharacterState {
  name: string;
  hp: number;
  max_hp: number;
  attack_rank: number;
  defense_rank: number;
  types: string[];
  is_poison: boolean;
  ability: AbilityId;
  ability_change_count: number;
  lives: number | null;
  owner_id: string;
}

export interface BattleState {
  room_id: string;
  character: string;
  is_my_turn: boolean;
  turn: number;
  last_actor_id: string | null;
  word: string | null;
  characters: Record<string, CharacterState>;
  winner_team: number | null;
  ally_win: boolean | null;
  ally_max_lives: number | null;
  foe_max_lives: number | null;
  current_actor_id: string | null;
  current_owner_id: string | null;
}

export type EventType = 
  | "damage" 
  | "cure" 
  | "revive" 
  | "stat_change" 
  | "ability_trigger" 
  | "ability_changed" 
  | "message";

export interface BattleEvent {
  type: EventType;
  message: string;
  target?: string | null;
  attacker?: string | null;
  damage?: number | null;
  amount?: number | null;
  stat_type?: "attack" | "defense" | null;
  new_rank?: number | null;
  hp?: number | null;
  lives?: number | null;
  new_ability?: AbilityId | null;
  new_ability_change_count?: number | null;
  poison_target?: string | null;
  new_ranks?: Record<string, Record<string, number>> | null;
}

export interface BattleResponse {
  type: string;
  state: BattleState;
  events: BattleEvent[];
  all_abilities?: Record<AbilityId, { name: string; description: string }>;
  info?: {
    player_ids: string[];
    id_to_ui_map: Record<string, "ally" | "foe" | "p1a" | "p1b" | "p2a" | "p2b">;
  };
}

// 通信メッセージの型
export type SocketMessageType = 
  | "find_match"
  | "make_new_battle"
  | "submit_word"
  | "submit_word_double"
  | "change_ability"
  | "include_check"
  | "run_away";

export interface SocketMessage {
  type: SocketMessageType;
  info: Record<string, any>;
}
