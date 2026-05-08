import React from 'react';
import { GameModal } from '../common/GameModal';
import { StatCard } from './StatCard';
import styles from '../../views/BattleView.module.css';
import type { CharacterState, BattleState } from '../../types/battle';

interface SituationModalProps {
  isOpen: boolean;
  onClose: () => void;
  ally: CharacterState | null;
  foe: CharacterState | null;
  battleState: BattleState | null;
}

export const SituationModal: React.FC<SituationModalProps> = ({
  isOpen,
  onClose,
  ally,
  foe,
  battleState
}) => {
  return (
    <GameModal
      isOpen={isOpen}
      onClose={onClose}
      title="じょうきょう"
      footer={
        <button className={styles.situationCloseButton} onClick={onClose}>とじる</button>
      }
    >
      <div className={styles.situationCardsContainer}>
        <StatCard
          type="foe"
          title="あいて"
          attackPower={foe?.attack_power ?? 1.0}
          defensePower={foe?.defense_power ?? 1.0}
          lives={foe?.lives ?? 0}
          maxLives={battleState?.foe_max_lives ?? 1}
        />
        <StatCard
          type="ally"
          title="じぶん"
          attackPower={ally?.attack_power ?? 1.0}
          defensePower={ally?.defense_power ?? 1.0}
          lives={ally?.lives ?? 0}
          maxLives={battleState?.ally_max_lives ?? 1}
        />
      </div>
    </GameModal>
  );
};
