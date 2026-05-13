import React from 'react';
import styles from './HPBar.module.css';
import { StatusRow } from './StatusRow';
import type { CharacterState } from '../../types/battle';

interface BattleHPBarProps {
  characters: CharacterState[];
  isAlly: boolean;
  isWaiting?: boolean;
}

/**
 * シングル・ダブル両対応のHP表示バルーン
 */
export const BattleHPBar: React.FC<BattleHPBarProps & { className?: string }> = ({
  characters,
  isWaiting = false,
  className = ''
}) => {

  return (
    <div className={`${styles.balloon} ${className}`}>
      {isWaiting && characters.length === 0 ? (
        <StatusRow
          name=""
          hp={0}
          maxHp={100}
          isPoison={false}
          isWaiting={true}
        />
      ) : (
        characters.map((char, index) => (
          <StatusRow
            key={char.id || index}
            name={char.name === 'プレイヤー' || char.name === '相手' ? '' : (char.name || '')}
            hp={char.hp}
            maxHp={char.max_hp || 100}
            isPoison={char.is_poison || false}
            isWaiting={isWaiting}
          />
        ))
      )}
    </div>
  );
};
