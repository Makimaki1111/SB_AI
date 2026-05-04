export interface AbilityData {
  id?: string;
  name: string;
  description: string;
  desc?: string; // 互換性のため
  icon_type: string;
  remain_count?: number;
}

export interface CharacterState {
  id: string;
  owner_id: string;
  name: string;
  hp: number;
  max_hp: number;
  ability: string;
  ability_name: string;
  ability_desc: string;
  ability_change_count: number;
  lives?: number;
  max_lives?: number;
  types: string[];
  is_poison?: boolean;
}

export interface BattleState {
  room_id: string;
  turn: number;
  status: 'waiting' | 'active' | 'finished';
  characters: Record<string, CharacterState>;
  last_word: string;
  last_char: string;
  timer: number;
  max_timer: number;
  all_abilities?: Record<string, AbilityData>;
  ally_win?: boolean;
  ally_stats?: { attack: number; defense: number };
  foe_stats?: { attack: number; defense: number };
  is_my_turn?: boolean;
  character?: string;
  message?: string;
  word?: string | null;
  foe_max_lives?: number;
  ally_max_lives?: number;
}

export interface BattleEvent {
  type: string;
  message: string;
  target?: string | null;
  attacker?: string | null;
  damage?: number | null;
  amount?: number | null;
  stat_type?: "attack" | "defense" | null;
  new_rank?: number | null;
  hp?: number | null;
  lives?: number | null;
  new_ability?: string | null;
  new_ability_change_count?: number | null;
  poison_target?: string | null;
}

export interface BattleResponse {
  type: string;
  state: BattleState;
  events: BattleEvent[];
  all_abilities?: Record<string, AbilityData>;
  info?: {
    player_ids: string[];
    id_to_ui_map: Record<string, string>;
  };
}

export type SocketMessageType = 
  | "find_match"
  | "find_match_double"
  | "make_new_battle"
  | "join_double_cpu_room"
  | "submit_word"
  | "submit_word_double"
  | "change_ability"
  | "include_check"
  | "run_away";

export interface SocketMessage {
  type: SocketMessageType;
  info: Record<string, any>;
}

export type GameMode = 'single' | 'stock' | 'double';
export type MatchType = 'player' | 'cpu' | 'room';
