import React from 'react';
import styles from './StatCard.module.css';

interface StatCardProps {
  type: 'ally' | 'foe';
  name: string;
  stats: {
    attack: number;
    defense: number;
  };
}

export const StatCard: React.FC<StatCardProps> = ({ type, name, stats }) => {
  const isFoe = type === 'foe';
  const cardClass = isFoe ? styles.foeCard : styles.allyCard;

  return (
    <div className={`${styles.sCard} ${cardClass}`}>
      <div className={styles.sCardHeader}>{name}</div>
      <div className={styles.sStatGrid}>
        <div className={styles.sStatItem}>
          <span className={styles.sStatLabel}>こうげき</span>
          <span className={styles.sStatValue}>{(stats.attack || 1.0).toFixed(1)}倍</span>
        </div>
        <div className={styles.sStatItem}>
          <span className={styles.sStatLabel}>ぼうぎょ</span>
          <span className={styles.sStatValue}>{(stats.defense || 1.0).toFixed(1)}倍</span>
        </div>
      </div>
    </div>
  );
};
