export type BattleMode = 'single' | 'double';

export interface CharacterData {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  atkRank: number;
  defRank: number;
  ability: string;
  abilityChangeCount: number;
  isPoison: boolean;
  animation?: 'damage' | 'heal' | 'stat-up' | 'stat-down' | null;
  isDefeated: boolean;
  types: string[];
  currentWord: string;
}

export interface BattleState {
  roomId: string | null;
  mode: BattleMode;
  isVsCpu: boolean;
  characters: Record<string, CharacterData>;
  myTeam: 'p1' | 'p2' | null;
  isMyTurn: boolean;
  characterToStartWith: string;
  allAbilities: Record<string, { name: string; description: string }>;
  currentTargetId: string | null;
  preCheckResult: {
    isPossible: boolean;
    word: string;
    damage: number;
    type: string;
    message: string;
  } | null;
}

