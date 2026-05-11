import React from 'react';
import styles from './TeamHPBar.module.css';
import { StatusRow } from '../StatusRow';
import type { CharacterState } from '../../../types/battle';

interface TeamHPBarProps {
  characters: CharacterState[];
  isAlly: boolean;
}

/**
 * 既存のデザインを維持したチームHPバー(バルーン)
 * StatusRowを複数並べることでチーム表示を実現します。
 */
export const TeamHPBar: React.FC<TeamHPBarProps> = ({ characters, isAlly }) => {
  return (
    <div className={`${styles.balloon} ${isAlly ? styles.right : styles.left}`}>
      <div className={styles.teamInfo}>
        {characters.map((char, index) => (
          <StatusRow
            key={char.id || index}
            name={char.name}
            hp={char.hp}
            maxHp={char.max_hp || 1}
            isPoison={char.is_poison || false}
            isAlly={isAlly}
          />
        ))}
      </div>
    </div>
  );
};
