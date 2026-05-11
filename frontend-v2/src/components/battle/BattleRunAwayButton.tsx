import React from 'react';
import styles from './BattleRunAwayButton.module.css';

interface BattleRunAwayButtonProps {
  onRunAway: () => void;
}

export const BattleRunAwayButton: React.FC<BattleRunAwayButtonProps> = ({
  onRunAway,
}) => {
  return (
    <div className={styles.footerArea}>
      <button
        className={styles.cancelBattleBtn}
        onClick={onRunAway}
      >
        にげる
      </button>
    </div>
  );
};
