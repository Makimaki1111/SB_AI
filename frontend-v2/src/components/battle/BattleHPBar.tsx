import React from 'react';
import styles from './HPBar.module.css';
import { StatusRow } from './StatusRow';
import type { CharacterState } from '../../types/battle';

interface BattleHPBarProps {
  characters: CharacterState[];
  isAlly: boolean;
  mode: 'single' | 'double';
  isWaiting?: boolean;
}

/**
 * シングル・ダブル両対応のHP表示バルーン
 */
export const BattleHPBar: React.FC<BattleHPBarProps> = ({
  characters,
  isAlly,
  mode,
  isWaiting = false
}) => {
  // 表示位置のクラス決定
  const positionClass = mode === 'single' 
    ? (isAlly ? styles.singleAlly : styles.singleFoe)
    : (isAlly ? styles.doubleAlly : styles.doubleFoe);

  return (
    <div className={`${styles.balloon} ${positionClass}`}>
      {characters.map((char, index) => (
        <StatusRow
          key={char.id || index}
          name={char.name || (isAlly ? 'プレイヤー' : '相手')}
          hp={char.hp}
          maxHp={char.max_hp || 100}
          isPoison={char.is_poison || false}
          isWaiting={isWaiting}
        />
      ))}
    </div>
  );
};
