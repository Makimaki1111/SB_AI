import React from 'react';
import type { CharacterState } from '../../types/battle';
import styles from './TeamHPBar.module.css';

interface TeamHPBarProps {
  characters: CharacterState[];
  isAlly: boolean;
  teamName: string;
}

/**
 * ダブルバトル用のチーム統合型HPバルーン (本家完全再現版)
 * 待機中（キャラクター不在）の状態もサポートします。
 */
export const TeamHPBar: React.FC<TeamHPBarProps> = ({ characters, isAlly }) => {
  // キャラクターが不在（マッチング待機中など）の場合はプレースホルダーを表示
  const isWaiting = characters.length === 0;
  
  return (
    <div className={`${styles.balloon} ${isAlly ? styles.ally : styles.foe} ${styles.doubleBalloon}`}>
      {isWaiting ? (
        <div className={styles.memberInfo}>
          <div className={styles.nameRow}>
            <span className={styles.memberName} style={{ opacity: 0.5 }}>
              待機中...
            </span>
          </div>
          <div className={styles.bar}>
            <div className={styles.hpBarFill} style={{ width: '0%', background: '#ddd' }} />
          </div>
        </div>
      ) : (
        <div className={styles.membersContainer}>
          {characters.map((char, index) => {
            const hpRatio = (char.hp / char.max_hp) * 100;
            return (
              <div key={char.id || index} className={styles.memberInfo}>
                <div className={styles.nameRow}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span className={styles.memberName}>{char.name}</span>
                    {char.is_poison && (
                      <span className={styles.poisonLabel}>どく</span>
                    )}
                  </div>
                  <span className={styles.hpText}>
                    {Math.max(0, char.hp)}/{char.max_hp}
                  </span>
                </div>
                <div className={styles.hpBarContainer}>
                  <div 
                    className={styles.hpBarFill}
                    style={{ width: `${Math.max(0, hpRatio)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
