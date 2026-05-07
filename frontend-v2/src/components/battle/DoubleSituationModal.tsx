import React from 'react';
import { GameModal } from '../common/GameModal';
import { StatCard } from './StatCard';
import styles from '../../views/BattleView.module.css';
import type { BattleState } from '../../types/battle';

interface DoubleSituationModalProps {
  isOpen: boolean;
  onClose: () => void;
  battleState: BattleState | null;
}

export const DoubleSituationModal: React.FC<DoubleSituationModalProps> = ({
  isOpen,
  onClose,
  battleState
}) => {
  if (!battleState) return null;

  const characters = Object.entries(battleState.characters);
  // 味方と敵に分離
  const allyChars = characters.filter(([id]) => id.startsWith('p1'));
  const foeChars = characters.filter(([id]) => id.startsWith('p2'));

  return (
    <GameModal
      isOpen={isOpen}
      onClose={onClose}
      title="じょうきょう"
      footer={
        <button className={styles.situationCloseButton} onClick={onClose}>とじる</button>
      }
    >
      <div className={styles.situationCardsContainer} style={{ flexWrap: 'wrap', gap: '8px' }}>
        {/* 敵チーム */}
        {foeChars.map(([id, char]) => (
          <div key={id} style={{ width: '47%' }}>
            <StatCard
              type="foe"
              title={char.name}
              attackPower={char.attack_power ?? 1.0}
              defensePower={char.defense_power ?? 1.0}
              lives={char.lives ?? 0}
              maxLives={battleState.foe_max_lives ?? 1}
            />
          </div>
        ))}

        {/* 自分チーム */}
        {allyChars.map(([id, char]) => (
          <div key={id} style={{ width: '47%' }}>
            <StatCard
              type="ally"
              title={char.name}
              attackPower={char.attack_power ?? 1.0}
              defensePower={char.defense_power ?? 1.0}
              lives={char.lives ?? 0}
              maxLives={battleState.ally_max_lives ?? 1}
            />
          </div>
        ))}
      </div>
    </GameModal>
  );
};
