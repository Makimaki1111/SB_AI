import React from 'react';
import styles from './BattleOverlay.module.css';

interface BattleWaitMessageProps {
  message: string | null;
}

export const BattleWaitMessage: React.FC<BattleWaitMessageProps> = ({ message }) => {
  if (!message) return null;
  
  return (
    <div className={styles.waitMessage}>
      {message}
    </div>
  );
};
