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
  ability: string;
  ability_change_count: number;
  lives?: number;
  types: string[];
  is_poison?: boolean;
  owner_id?: string;
  id?: string; // keyから補完される場合がある
}

export interface BattleState {
  room_id: string;
  turn: number;
  characters: Record<string, CharacterState>;
  word: string | null;
  character: string; // 次の文字 or 開始文字
  is_my_turn: boolean;
  winner_team: number | null;
  ally_win: boolean | null;
  ally_max_lives: number;
  foe_max_lives: number;
  current_actor_id?: string;
  current_owner_id?: string;
  last_actor_id?: string;
  status?: 'waiting' | 'active' | 'finished'; // フロントエンドで算出/管理
}

export interface BattleEvent {
  type: string;
  message: string;
  target?: string | null;
  attacker?: string | null;
  damage?: number | null;
  ally_damage?: number | null;
  foe_damage?: number | null;
  ally_cure?: number | null;
  foe_cure?: number | null;
  amount?: number | null;
  stat_type?: string | null;
  new_rank?: number | null;
  hp?: number | null;
  lives?: number | null;
  new_ability?: string | null;
  new_ability_change_count?: number | null;
  poison_target?: string | null;
  player?: 'ally' | 'foe'; // stat_up 等の対象
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
