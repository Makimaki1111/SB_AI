import React from 'react';
import { BattleHPBar } from '../BattleHPBar';
import { BattleCharacter } from '../BattleCharacter';
import type { CharacterState } from '../../../types/battle';

interface SingleBattleSideProps {
  character: CharacterState | null;
  isAlly: boolean;
  effect: string | null;
  word: string | null;
  isKnockout: boolean;
  name: string;
}

/**
 * シングルバトル専用の表示コンポーネント
 * 1体のキャラクターとそのステータス（HPバー等）を垂直に配置します。
 */
export const SingleBattleSide: React.FC<SingleBattleSideProps> = ({
  character,
  isAlly,
  effect,
  word,
  isKnockout,
}) => {
  return (
    <>
      <BattleCharacter
        types={character?.types || []}
        word={word}
        isAlly={isAlly}
        effect={effect}
        isKnockout={isKnockout}
        scale={1.0}
      />

      <BattleHPBar
        characters={character ? [character] : []}
        isAlly={isAlly}
        mode="single"
        isWaiting={!character}
      />
    </>
  );
};
