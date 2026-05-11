import React from 'react';
import styles from './BattleTimer.module.css';

interface BattleTimerProps {
  remaining: number;
  total: number;
}

export const BattleTimer: React.FC<BattleTimerProps> = ({ remaining, total }) => {
  const percentage = (remaining / (total || 1)) * 100;
  
  // 色の決定ロジックを共通化
  const getBackgroundColor = () => {
    if (remaining > 10) return '#00FF00'; // 緑
    if (remaining > 5) return '#FFFF00';  // 黄
    return '#FF0000';                     // 赤
  };

  return (
    <div className={styles.timerContainer}>
      <div
        className={styles.timerBar}
        style={{
          width: `${percentage}%`,
          backgroundColor: getBackgroundColor()
        }}
      />
    </div>
  );
};
