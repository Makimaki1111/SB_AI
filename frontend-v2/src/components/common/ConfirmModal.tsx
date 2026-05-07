import React from 'react';
import { GameModal } from './GameModal';
import { GameButton } from './GameButton';
import styles from './ConfirmModal.module.css';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "確認",
  message,
  confirmText = "はい",
  cancelText = "いいえ"
}) => {
  return (
    <GameModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <div className={styles.footerButtons}>
          <GameButton variant="grey" onClick={onClose} className={styles.btn}>
            {cancelText}
          </GameButton>
          <GameButton variant="orange" onClick={onConfirm} className={styles.btn}>
            {confirmText}
          </GameButton>
        </div>
      }
    >
      <div className={styles.message}>
        {message}
      </div>
    </GameModal>
  );
};
