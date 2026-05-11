import React from 'react';
import styles from './BattleTeamDisplay.module.css';
import { BattleCharacter } from './BattleCharacter';
import { BattleHPBar } from './BattleHPBar';
import type { CharacterState } from '../../types/battle';

interface BattleTeamDisplayProps {
  mode: 'single' | 'double';
  side: 'ally' | 'foe';
  characters: CharacterState[];
  knockoutStates: Record<string, boolean>;
  activeEffects?: Record<string, string>;
  username?: string; // シングルバトルの味方名用
  isWaiting?: boolean; // シングルバトルの交代待ち用
}

/**
 * キャラクターとHPバーをセットで管理・配置する共通ユニット
 */
export const BattleTeamDisplay: React.FC<BattleTeamDisplayProps> = ({
  mode,
  side,
  characters,
  knockoutStates,
  activeEffects = {},
  username,
  isWaiting = false
}) => {
  const isAlly = side === 'ally';

  return (
    <div className={styles.sideContainer} data-mode={mode} data-side={side}>
      {/* キャラクターレイヤー (影とスロットを管理) */}
      <div className={styles.characterLayer}>
        {/* ダブルバトル専用：チーム全体の足元の影 */}
        {mode === 'double' && <div className={styles.doubleEllipse} />}

        {/* キャラクターの描画 */}
        {characters.map((char, index) => {
          const isKnockout = char.id 
            ? knockoutStates[char.id] || char.hp <= 0 || !!char.is_defeated 
            : char.hp <= 0;
          const charEffect = char.id ? activeEffects[char.id] : null;
          
          // キャラクターの座標クラス決定
          let charClass = '';
          let slot = undefined;
          if (mode === 'single') {
            charClass = isAlly ? styles.char_singleAlly : styles.char_singleFoe;
          } else {
            slot = isAlly ? (index === 0 ? 'p1a' : 'p1b') : (index === 0 ? 'p2a' : 'p2b');
            charClass = styles[`slot_${slot}`];
          }

          return (
            <BattleCharacter
              key={char.id || index}
              types={char.types || []}
              word={char.word || null}
              isAlly={isAlly}
              effect={charEffect}
              isKnockout={isKnockout}
              slot={slot}
              className={charClass}
            />
          );
        })}
      </div>

      {/* HPバーの描画 (座標クラスを渡す) */}
      <BattleHPBar
        characters={characters.map((char, index) => 
          (mode === 'single' && isAlly && index === 0 && username) 
            ? { ...char, name: username } 
            : char
        )}
        isAlly={isAlly}
        isWaiting={isWaiting}
        className={mode === 'single' 
          ? (isAlly ? styles.hp_singleAlly : styles.hp_singleFoe)
          : (isAlly ? styles.hp_doubleAlly : styles.hp_doubleFoe)
        }
      />
    </div>
  );
};
