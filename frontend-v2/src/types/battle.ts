export interface AbilityData {
  id?: string;
  name: string;
  description: string;
  desc?: string; // 互換性のため
  icon_type: string;
  remain_count?: number;
}

export interface CharacterState {
  name: string;
  hp: number;
  max_hp: number;
  attack_rank: number;
  defense_rank: number;
  attack_power: number;
  defense_power: number;
  ability: string;
  ability_change_count: number;
  lives?: number | null;
  types: string[];
  is_poison: boolean;
  owner_id: string;
  id?: string;
}

export interface BattleState {
  room_id: string;
  turn: number;
  characters: Record<string, CharacterState>;
  word: string | null;
  character: string; 
  is_my_turn: boolean;
  winner_team: number | null;
  ally_win: boolean | null;
  ally_max_lives: number | null;
  foe_max_lives: number | null;
  current_actor_id?: string | null;
  current_owner_id?: string | null;
  last_actor_id?: string | null;
  status?: 'waiting' | 'active' | 'finished';
  is_cpu?: boolean;
}

export interface BattleEvent {
  type: string;
  message: string;
  target?: string | null;
  attacker?: string | null;
  damage?: number | null;
  amount?: number | null;
  stat_type?: string | null;
  new_rank?: number | null;
  hp?: number | null;
  lives?: number | null;
  new_ability?: string | null;
  new_ability_change_count?: number | null;
  new_ranks?: Record<string, Record<string, number>> | null;
  predictions?: Record<string, string> | null;
  attacker_hp?: number | null;
}

export interface BattleResponse {
  type: string;
  state: BattleState;
  events: BattleEvent[];
  all_abilities?: Record<string, AbilityData>;
  include?: boolean;
  used?: boolean;
  type1?: string;
  type2?: string;
  prediction?: string;
  predictions?: Record<string, string>;
  message?: string;
  info?: {
    player_ids: string[];
    id_to_ui_map: Record<string, string>;
    word?: string;
    room_id?: string;
    include?: boolean;
    used?: boolean;
    type1?: string;
    type2?: string;
    prediction?: string;
    predictions?: Record<string, string>;
    time_limit?: number;
    total_time?: number;
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
  | "run_away"
  | "ping"
  | "update_user_info";

export interface SocketMessage {
  type: SocketMessageType;
  info: Record<string, string | number | boolean | undefined>;
}

export type GameMode = 'single' | 'stock' | 'double';
export type MatchType = 'player' | 'cpu' | 'room';
