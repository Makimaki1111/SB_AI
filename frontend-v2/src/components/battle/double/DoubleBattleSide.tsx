import React from 'react';
import styles from './DoubleBattleSide.module.css';
import { BattleCharacter } from '../BattleCharacter';
import type { CharacterState } from '../../../types/battle';

interface DoubleBattleSideProps {
  characters: CharacterState[];
  isAlly: boolean;
  knockoutStates: Record<string, boolean>;
  activeEffects?: Record<string, string>;
}

/**
 * 統合された BattleCharacter を使用したダブルバトルキャラクター配置
 */
export const DoubleBattleSide: React.FC<DoubleBattleSideProps> = ({
  characters,
  isAlly,
  knockoutStates,
  activeEffects = {}
}) => {
  return (
    <div className={`${styles.teamContainer} ${isAlly ? styles.ally : styles.foe}`}>
      {/* チーム全体の足元の影 */}
      <div className={styles.doubleEllipse} />

      {characters.map((char, index) => {
        const isKnockout = char.id ? knockoutStates[char.id] || char.hp <= 0 || !!char.is_defeated : char.hp <= 0;
        const charEffect = char.id ? activeEffects[char.id] : null;
        
        // ダブルバトルのスロットID決定
        const slot = isAlly ? (index === 0 ? 'p1a' : 'p1b') : (index === 0 ? 'p2a' : 'p2b');

        return (
          <BattleCharacter
            key={char.id || index}
            types={char.types || []}
            word={char.word || null}
            isAlly={isAlly}
            effect={charEffect}
            isKnockout={isKnockout}
            scale={1.0} /* CSS側のwidth/heightで制御するため、scaleは1倍固定 */
            slot={slot}
            className={styles[`slot_${slot}`]}
          />
        );
      })}
    </div>
  );
};
