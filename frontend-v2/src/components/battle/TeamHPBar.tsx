import React from 'react';
import type { CharacterState } from '../../types/battle';
import styles from './TeamHPBar.module.css';

interface TeamHPBarProps {
  characters: CharacterState[];
  isAlly: boolean;
  teamName: string;
}

/**
 * ダブルバトル用のチーム統合型HPバルーン
 * 2人分のHPバーとステータスを1つのバルーン内に表示します。
 */
export const TeamHPBar: React.FC<TeamHPBarProps> = ({ characters, isAlly, teamName }) => {
  const getHPColor = (current: number, max: number) => {
    const ratio = current / max;
    if (ratio > 0.5) return 'linear-gradient(90deg, #2ecc71, #27ae60)';
    if (ratio > 0.2) return 'linear-gradient(90deg, #f1c40f, #f39c12)';
    return 'linear-gradient(90deg, #e74c3c, #c0392b)';
  };

  return (
    <div className={`${styles.balloon} ${isAlly ? styles.ally : styles.foe}`}>
      <div className={styles.teamHeader}>{teamName}</div>
      <div className={styles.membersContainer}>
        {characters.map((char, index) => {
          const hpRatio = (char.hp / char.max_hp) * 100;
          return (
            <div key={char.id || index} className={styles.memberInfo}>
              <div className={styles.nameRow}>
                <span className={styles.memberName}>{char.name}</span>
                <span className={styles.hpText}>{Math.max(0, char.hp)} / {char.max_hp}</span>
              </div>
              <div className={styles.hpBarContainer}>
                <div 
                  className={`${styles.hpBarFill} ${char.is_poison ? styles.poison : ''}`}
                  style={{ 
                    width: `${Math.max(0, hpRatio)}%`,
                    background: char.is_poison ? undefined : getHPColor(char.hp, char.max_hp)
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
