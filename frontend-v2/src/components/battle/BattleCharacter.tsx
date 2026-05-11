import React from 'react';
import { CharacterAvatar } from './CharacterAvatar';
import { WordDisplay } from './WordDisplay';
import { BattleEffects } from './BattleEffects';
import styles from './BattleCharacter.module.css';

interface BattleCharacterProps {
  types: string[];
  word: string | null;
  isAlly: boolean;
  effect?: string | null;
  isKnockout: boolean;
  scale?: number;
  slot?: string;
  className?: string;
}

/**
 * キャラクターの姿(Avatar)、言葉(WordDisplay)、エフェクトを
 * ひとまとめにした統合コンポーネント。
 */
export const BattleCharacter: React.FC<BattleCharacterProps> = ({
  types,
  word,
  isAlly,
  effect,
  isKnockout,
  scale = 1,
  slot,
  className = ''
}) => {
  const isBlinking = effect === 'blink';
  const displayEffect = effect && effect !== 'blink' ? effect : null;

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
      {/* キャラクター本体 */}
      <CharacterAvatar
        types={types}
        isAlly={isAlly}
        isBlinking={isBlinking}
        isKnockout={isKnockout}
        isDouble={!!slot}
        className={styles.avatar}
      />

      {/* エフェクト演出 */}
      <div className={styles.effectsContainer}>
        <BattleEffects trigger={displayEffect} side={isAlly ? "ally" : "foe"} />
      </div>

      {/* 発した言葉 */}
      <div className={styles.wordWrapper}>
        <WordDisplay
          word={word}
          isAlly={isAlly}
          isBlinking={isBlinking}
          isKnockout={isKnockout}
          isDouble={!!slot}
        />
      </div>
    </div>
  );
};
