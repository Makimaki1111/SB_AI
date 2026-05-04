import React from 'react';
import styles from './GameModal.module.css';

interface GameModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  closeOnOverlayClick?: boolean;
}

export const GameModal: React.FC<GameModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth,
  closeOnOverlayClick = true
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div 
        className={styles.modalContainer} 
        style={maxWidth ? { maxWidth } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={styles.modalTitle}>{title}</h2>
        
        <div className={styles.modalContent}>
          {children}
        </div>

        {footer && (
          <div className={styles.modalFooter}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
