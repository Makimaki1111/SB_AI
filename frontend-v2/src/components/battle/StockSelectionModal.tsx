import React from 'react';
import { GameModal } from '../common/GameModal';
import styles from './StockSelectionModal.module.css';

interface StockSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (allyStock: number, foeStock: number) => void;
}

export const StockSelectionModal: React.FC<StockSelectionModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm 
}) => {
  const [allyStock, setAllyStock] = React.useState(2);
  const [foeStock, setFoeStock] = React.useState(2);

  const handleConfirm = () => {
    onConfirm(allyStock, foeStock);
  };

  const renderOptions = (current: number, setter: (val: number) => void) => {
    return (
      <div className={styles.optionsGrid}>
        {[1, 2, 3, 4, 5].map((val) => (
          <div 
            key={val}
            className={`${styles.optionBtn} ${current === val ? styles.selected : ''}`}
            onClick={() => setter(val)}
          >
            {val}
          </div>
        ))}
      </div>
    );
  };

  const isInvalid = allyStock === 1 && foeStock === 1;

  return (
    <GameModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="のこり数をえらぶ"
      footer={
        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onClose}>キャンセル</button>
          <button 
            className={styles.confirmBtn} 
            onClick={handleConfirm}
            disabled={isInvalid}
          >
            決定
          </button>
        </div>
      }
    >
      <div className={styles.stockSelectionContainer}>
        <div className={styles.section}>
          <label className={styles.label}>じぶん の のこり数</label>
          {renderOptions(allyStock, setAllyStock)}
        </div>

        <div className={styles.divider} />

        <div className={styles.section}>
          <label className={styles.label}>あいて の のこり数</label>
          {renderOptions(foeStock, setFoeStock)}
        </div>
        
        {isInvalid && (
          <div className={styles.errorMsg}>どちらかの残機は2以上にする必要があります</div>
        )}
      </div>
    </GameModal>
  );
};
