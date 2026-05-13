import React from 'react';
import styles from './BattleOverlay.module.css';

interface BattleOverlayProps {
  messageLog: { text: string | null; isOpen: boolean };
}

export const BattleOverlay: React.FC<BattleOverlayProps> = ({
  messageLog,
}) => {
  return (
    <>
      {/* メッセージボックス */}
      {messageLog.isOpen && (
        <div className={styles.messageOverlay}>
          {messageLog.text}
        </div>
      )}
    </>
  );
};
