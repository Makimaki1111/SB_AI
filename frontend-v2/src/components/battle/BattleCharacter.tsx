import React from 'react';
import { CharacterAvatar } from './CharacterAvatar';
import { WordDisplay } from './WordDisplay';
import { BattleEffects } from './BattleEffects';
import styles from './BattleCharacter.module.css';

interface BattleCharacterProps {
  id: string;
  name: string;
  types: string[];
  isAlly: boolean;
  isBlinking: boolean;
  isKnockout: boolean;
  activeEffect?: string | null;
  slot?: 'p1a' | 'p1b' | 'p2a' | 'p2b';
  word?: string | null;
  scale?: number;
  className?: string;
}

/**
 * 役者（キャラクター）一人の表示を司るコンポーネント
 */
export const BattleCharacter: React.FC<BattleCharacterProps> = ({
  types,
  isAlly,
  isBlinking,
  isKnockout,
  activeEffect,
  slot,
  word,
  scale = 1,
  className = ''
}) => {
  return (
    <div 
      className={`${styles.characterContainer} ${className}`}
      data-ally={isAlly}
      data-double={!!slot}
      style={{ 
        transform: `scale(${scale})`,
        transformOrigin: 'bottom center'
      }}
    >
      <CharacterAvatar
        types={types}
        isAlly={isAlly}
        isBlinking={isBlinking}
        isKnockout={isKnockout}
        isDouble={!!slot}
        className={styles.avatar}
      />

      <div className={styles.wordWrapper}>
        <WordDisplay
          word={word}
          isAlly={isAlly}
          isDouble={!!slot}
        />
      </div>

      <div className={styles.effectsContainer}>
        <BattleEffects trigger={activeEffect || null} />
      </div>
    </div>
  );
};
