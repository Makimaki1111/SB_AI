import React from 'react';
import styles from './BattleTimer.module.css';

interface BattleTimerProps {
  remaining: number;
  total: number;
}

/**
 * バトルの制限時間を表示するプログレスバー。
 * 残り時間に応じて色が緑 -> 黄 -> 赤と変化します。
 */
export const BattleTimer: React.FC<BattleTimerProps> = ({ remaining, total }) => {
  const percentage = Math.max(0, Math.min(100, (remaining / (total || 1)) * 100));

  // 残り時間に応じた色決定ロジックを一箇所に集約
  const getTimerColor = () => {
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
          backgroundColor: getTimerColor(),
        }}
      />
    </div>
  );
};
