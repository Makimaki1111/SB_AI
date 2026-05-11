import React from 'react';
import styles from './BattleToast.module.css';

interface BattleToastProps {
  message: string | null;
}

/**
 * 特性の発動通知。以前の CSS アニメーションをそのまま使用。
 */
export const BattleToast: React.FC<BattleToastProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className={styles.toast}>
      {message}
    </div>
  );
};
