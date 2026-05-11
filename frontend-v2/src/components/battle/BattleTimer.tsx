import React from 'react';
import styles from './BattleTimer.module.css';

interface BattleTimerProps {
  remaining: number;
  total: number;
}

export const BattleTimer: React.FC<BattleTimerProps> = ({ remaining, total }) => {
  const percentage = (remaining / (total || 1)) * 100;
  
  const backgroundColor = remaining > 10 ? '#00FF00' : remaining > 5 ? '#FFFF00' : '#FF0000';

  return (
    <div className={styles.timerContainer}>
      <div
        className={styles.timerBar}
        style={{
          width: `${Math.max(0, Math.min(100, percentage))}%`,
          backgroundColor: backgroundColor
        }}
      />
    </div>
  );
};
