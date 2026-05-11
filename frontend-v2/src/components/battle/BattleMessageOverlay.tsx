import React from 'react';
import styles from './BattleMessageOverlay.module.css';

interface BattleMessageOverlayProps {
  text: string | null;
  isOpen: boolean;
}

/**
 * バトル中の実況メッセージ。以前の JSX 構造を完全に維持。
 */
export const BattleMessageOverlay: React.FC<BattleMessageOverlayProps> = ({ text, isOpen }) => {
  if (!isOpen || !text) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.messageText}>{text}</div>
    </div>
  );
};
