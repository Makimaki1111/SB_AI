import React from 'react';
import styles from './BattleActionButtons.module.css';
import SoundManager from '../../utils/SoundManager';

interface BattleActionButtonsProps {
  onOpenSituation: () => void;
  onOpenAbility: () => void;
}

export const BattleActionButtons: React.FC<BattleActionButtonsProps> = ({
  onOpenSituation,
  onOpenAbility,
}) => {
  return (
    <div className={styles.actionsWrapper}>
      <div
        className={`${styles.actionBtn} ${styles.situationBtn}`}
        onClick={() => {
          SoundManager.play('pera');
          onOpenSituation();
        }}
      >
        <svg className={styles.actionBtnIcon} viewBox="0 0 24 24">
          <path d="M3 13.125C3 12.5037 3.50368 12 4.125 12H6.75C7.37132 12 7.875 12.5037 7.875 13.125V18.375C7.875 18.9963 7.37132 19.5 6.75 19.5H4.125C3.50368 19.5 3 18.9963 3 18.375V13.125ZM10.125 7.125C10.125 6.50368 10.6287 6 11.25 6H13.875C14.4963 6 15 6.50368 15 7.125V18.375C15 18.9963 14.4963 19.5 13.875 19.5H11.25C10.6287 19.5 10.125 18.9963 10.125 18.375V7.125ZM17.25 3.375C17.25 2.75368 17.7537 2.25 18.375 2.25H21C21.6213 2.25 22.125 2.75368 22.125 3.375V18.375C22.125 18.9963 21.6213 19.5 21 19.5H18.375C17.7537 19.5 17.25 18.9963 17.25 18.375V3.375Z" />
        </svg>
        <span className={styles.actionBtnText}>状況</span>
      </div>
      <div
        className={`${styles.actionBtn} ${styles.abilityBtn}`}
        onClick={() => {
          SoundManager.play('pera');
          onOpenAbility();
        }}
      >
        <svg className={styles.actionBtnIcon} viewBox="0 0 24 24">
          <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
        <span className={styles.actionBtnText}>特性</span>
      </div>
    </div>
  );
};
