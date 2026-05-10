import React from 'react';
import { WordDisplay } from '../WordDisplay';
import { BattleEffects } from '../BattleEffects';
import styles from './DoubleBattleSide.module.css';
import type { CharacterState } from '../../../types/battle';
import { TYPE_TO_IMAGE } from '../../../constants/game';

interface DoubleBattleSideProps {
  characters: CharacterState[];
  isAlly: boolean;
  effect: string | null;
  knockoutStates: Record<string, boolean>;
}

/**
 * 既存のデザインを維持したダブルバトル用キャラクター配置
 */
export const DoubleBattleSide: React.FC<DoubleBattleSideProps> = ({
  characters,
  isAlly,
  effect,
  knockoutStates
}) => {
  return (
    <div className={`${styles.teamContainer} ${isAlly ? styles.ally : styles.foe}`}>
      {/* チーム全体の足元の影 */}
      <div className={styles.doubleEllipse} />

      {characters.map((char, index) => {
        const isKnockout = char.id ? knockoutStates[char.id] || char.hp <= 0 || !!char.is_defeated : char.hp <= 0;

        return (
          <div key={char.id || index} className={styles.charWrapper}>
            {char.types?.map((type, tIndex) => (
              <img
                key={tIndex}
                src={`/img/${TYPE_TO_IMAGE[type] || 'normal'}.gif`}
                className={`${styles.sprite} ${tIndex > 0 ? styles.type2 : ''}`}
                style={{ opacity: isKnockout ? 0.3 : 1 }}
                alt={char.name}
              />
            ))}

            <div className={styles.effectsContainer}>
              <BattleEffects
                trigger={effect}
                side={isAlly ? "ally" : "foe"}
              />
            </div>

            <div className={styles.wordWrapper}>
              <WordDisplay
                word={char.word || null}
                isAlly={isAlly}
                isBlinking={effect === 'blink'}
                isKnockout={isKnockout}
                isDouble={true}
                slot={isAlly ? (index === 0 ? 'p1a' : 'p1b') : (index === 0 ? 'p2a' : 'p2b')}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
