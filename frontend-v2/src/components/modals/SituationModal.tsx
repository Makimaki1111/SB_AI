import React from 'react';
import { GameModal } from '../common/GameModal';
import { StatCard } from '../lobby/StatCard';
import styles from '../../views/BattleView.module.css';
import type { CharacterState, BattleState } from '../../types/battle';

interface SituationModalProps {
  isOpen: boolean;
  onClose: () => void;
  ally: CharacterState | null;
  foe: CharacterState | null;
  allies?: CharacterState[];
  foes?: CharacterState[];
  battleState: BattleState | null;
}

export const SituationModal: React.FC<SituationModalProps> = ({
  isOpen,
  onClose,
  ally,
  foe,
  allies = [],
  foes = [],
  battleState
}) => {
  const isDouble = allies.length > 1 || foes.length > 1;

  const renderSingle = () => (
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
  );

  const renderDouble = () => (
    <div className={styles.situationCardsContainer} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
      {foes.map((f, i) => (
        <div key={f.id || i} style={{ width: '48%', minWidth: '140px' }}>
          <StatCard
            type="foe"
            title={f.name || "あいて"}
            attackPower={f.attack_power ?? 1.0}
            defensePower={f.defense_power ?? 1.0}
            lives={f.lives ?? 0}
            maxLives={battleState?.foe_max_lives ?? 1}
          />
        </div>
      ))}
      {allies.map((a, i) => (
        <div key={a.id || i} style={{ width: '48%', minWidth: '140px' }}>
          <StatCard
            type="ally"
            title={a.name || "じぶん"}
            attackPower={a.attack_power ?? 1.0}
            defensePower={a.defense_power ?? 1.0}
            lives={a.lives ?? 0}
            maxLives={battleState?.ally_max_lives ?? 1}
          />
        </div>
      ))}
    </div>
  );

  return (
    <GameModal
      isOpen={isOpen}
      onClose={onClose}
      title="じょうきょう"
      footer={
        <button className={styles.situationCloseButton} onClick={onClose}>とじる</button>
      }
    >
      {isDouble ? renderDouble() : renderSingle()}
    </GameModal>
  );
};
