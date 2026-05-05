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
  username: string;
}

export const SituationModal: React.FC<SituationModalProps> = ({
  isOpen,
  onClose,
  ally,
  foe,
  battleState,
  username
}) => {
  return (
    <GameModal
      isOpen={isOpen}
      onClose={onClose}
      title="じょうきょう"
      footer={
        <button className={styles.backBtn} onClick={onClose}>とじる</button>
      }
    >
      <div className={styles.situationCardsContainer}>
        <StatCard 
          type="foe"
          name={foe?.name || "あいて"}
          hp={foe?.hp ?? 0}
          maxHp={foe?.max_hp ?? 100}
          lives={foe?.lives ?? 0}
          maxLives={battleState?.foe_max_lives ?? 1}
          stats={{
            attack: foe?.attack_rank || 0,
            defense: foe?.defense_rank || 0
          }}
        />
        <StatCard 
          type="ally"
          name={username || ally?.name || "じぶん"}
          hp={ally?.hp ?? 0}
          maxHp={ally?.max_hp ?? 100}
          lives={ally?.lives ?? 0}
          maxLives={battleState?.ally_max_lives ?? 1}
          stats={{
            attack: ally?.attack_rank || 0,
            defense: ally?.defense_rank || 0
          }}
        />
      </div>
    </GameModal>
  );
};
