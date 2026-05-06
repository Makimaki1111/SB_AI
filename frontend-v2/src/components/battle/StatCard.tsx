import React from 'react';
import styles from './StatCard.module.css';

interface StatCardProps {
  title: string;
  attackPower: number;
  defensePower: number;
  lives: number;
  maxLives: number;
  type: 'ally' | 'foe';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  attackPower,
  defensePower,
  lives,
  maxLives,
  type
}) => {
  return (
    <div className={`${styles.card} ${type === 'ally' ? styles.allyCard : styles.foeCard}`}>
      <div className={styles.header}>{title}</div>
      <div className={styles.statGrid}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>こうげき</span>
          <span className={styles.statValue}>{attackPower.toFixed(1)}倍</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>ぼうぎょ</span>
          <span className={styles.statValue}>{defensePower.toFixed(1)}倍</span>
        </div>
        {maxLives > 1 && (
          <div className={`${styles.statItem} ${styles.livesItem}`}>
            <span className={styles.statLabel}>のこり</span>
            <div className={styles.livesContainer}>
              {Array.from({ length: maxLives }).map((_, i) => (
                <div 
                  key={i} 
                  className={`${styles.livesDisplayItem} ${i < lives ? '' : styles.lost}`} 
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
