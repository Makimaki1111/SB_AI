import React from 'react';
import styles from './BattleOverlay.module.css';

interface BattleOverlayProps {
  messageLog: { text: string | null; isOpen: boolean };
  notification: string | null;
}

export const BattleOverlay: React.FC<BattleOverlayProps> = ({
  messageLog,
  notification,
}) => {
  return (
    <>
      {/* メッセージボックス */}
      {messageLog.isOpen && (
        <div className={styles.messageOverlay}>
          {messageLog.text}
        </div>
      )}

      {/* 特性変更などの通知 */}
      {notification && (
        <div className={styles.toastNotification}>
          {notification}
        </div>
      )}
    </>
  );
};
