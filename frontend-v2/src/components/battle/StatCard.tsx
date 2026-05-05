import React from 'react';
import styles from './StatCard.module.css';

interface StatCardProps {
  type: 'ally' | 'foe';
  name: string;
  hp: number;
  maxHp: number;
  lives: number;
  maxLives: number;
  stats: {
    attack: number;
    defense: number;
  };
}

const rankToPower = (rank: number): number => {
  const mapping: Record<number, number> = {
    [-6]: 0.25, [-5]: 0.28, [-4]: 0.33, [-3]: 0.4, [-2]: 0.5, [-1]: 0.66, [0]: 1.0,
    [1]: 1.5, [2]: 2.0, [3]: 2.5, [4]: 3.0, [5]: 3.5, [6]: 4.0
  };
  return mapping[rank] || 1.0;
};

export const StatCard: React.FC<StatCardProps> = ({ 
  type, 
  name, 
  hp, 
  maxHp, 
  lives, 
  maxLives, 
  stats 
}) => {
  const isFoe = type === 'foe';
  const cardClass = isFoe ? styles.foeCard : styles.allyCard;
  
  const atkPower = rankToPower(stats.attack);
  const defPower = rankToPower(stats.defense);

  return (
    <div className={`${styles.sCard} ${cardClass}`}>
      <div className={styles.sCardHeader}>{name}</div>
      
      <div className={styles.mainStats}>
        <div className={styles.hpSection}>
          <div className={styles.sStatLabel}>HP</div>
          <div className={styles.hpText}>{hp} / {maxHp}</div>
          <div className={styles.miniHPBar}>
            <div 
              className={styles.miniHPFill} 
              style={{ 
                width: `${(hp / maxHp) * 100}%`,
                backgroundColor: hp/maxHp > 0.5 ? '#4caf50' : hp/maxHp > 0.2 ? '#ffeb3b' : '#f44336'
              }} 
            />
          </div>
        </div>

        {maxLives > 1 && (
          <div className={styles.livesSection}>
            <div className={styles.sStatLabel}>のこり数</div>
            <div className={styles.livesDots}>
              {Array.from({ length: maxLives }).map((_, i) => (
                <div 
                  key={i} 
                  className={`${styles.lifeDot} ${i < lives ? styles.alive : styles.dead}`} 
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={styles.divider} />

      <div className={styles.sStatGrid}>
        <div className={styles.sStatItem}>
          <span className={styles.sStatLabel}>こうげき</span>
          <span className={`${styles.sStatValue} ${stats.attack > 0 ? styles.up : stats.attack < 0 ? styles.down : ''}`}>
            {atkPower.toFixed(stats.attack === 0 ? 1 : 2)}倍
          </span>
        </div>
        <div className={styles.sStatItem}>
          <span className={styles.sStatLabel}>ぼうぎょ</span>
          <span className={`${styles.sStatValue} ${stats.defense > 0 ? styles.up : stats.defense < 0 ? styles.down : ''}`}>
            {defPower.toFixed(stats.defense === 0 ? 1 : 2)}倍
          </span>
        </div>
      </div>
    </div>
  );
};
