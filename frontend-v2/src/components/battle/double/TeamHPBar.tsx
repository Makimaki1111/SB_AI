import React from 'react';
import styles from './TeamHPBar.module.css';
import type { CharacterState } from '../../../types/battle';

interface TeamHPBarProps {
  characters: CharacterState[];
  isAlly: boolean;
  teamName: string;
}

/**
 * 既存のデザインを維持したチームHPバー(バルーン)
 */
export const TeamHPBar: React.FC<TeamHPBarProps> = ({ characters, isAlly, teamName }) => {
  return (
    <div className={`${styles.balloon} ${isAlly ? styles.right : styles.left}`}>
      <div className={styles.teamInfo}>
        <div className={styles.teamHeader}>
          <span className={styles.teamTitle}>{teamName}</span>
        </div>
        
        {characters.map((char, index) => {
          const hpPercent = (char.hp / char.max_hp) * 100;
          let barColor = styles.hpHigh;
          if (hpPercent <= 20) barColor = styles.hpLow;
          else if (hpPercent <= 50) barColor = styles.hpMedium;

          return (
            <div key={char.id || index} className={styles.memberInfo}>
              <div className={styles.nameRow}>
                <span className={styles.memberName}>{char.name}</span>
                {char.is_poison && <span className={styles.poisonBadge}>どく</span>}
              </div>
              <div className={styles.hpBarContainer}>
                <div 
                  className={`${styles.hpBar} ${barColor}`} 
                  style={{ width: `${Math.max(0, hpPercent)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
