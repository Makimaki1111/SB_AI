import React, { useState } from 'react';
import { useBattle } from '../context/BattleContext';
import { BattleField } from '../components/Battle/BattleField';
import { ActionController } from '../components/Battle/ActionController';
import { AbilityModal } from '../components/Battle/AbilityModal';
import { SituationModal } from '../components/Battle/SituationModal';
import './BattlePage.css';

export const BattlePage: React.FC = () => {
  const { state } = useBattle();
  const [isAbilityModalOpen, setIsAbilityModalOpen] = useState(false);
  const [isSituationModalOpen, setIsSituationModalOpen] = useState(false);

  // Convert characters record to arrays based on team
  const team1 = Object.values(state.characters).filter(c => c.id.startsWith('p1'));
  const team2 = Object.values(state.characters).filter(c => c.id.startsWith('p2'));

  // Placeholder while data is loading
  if (!state.roomId && Object.keys(state.characters).length === 0) {
    return (
      <div className="battle-page loading">
        <div className="glass loading-box">
          <h2>対戦準備中...</h2>
          <p>ルームに接続しています</p>
        </div>
      </div>
    );
  }

  return (
    <div className="battle-page">
      <BattleField 
        mode={state.mode}
        team1={team1}
        team2={team2}
        myTeam={state.myTeam}
      />
      
      <ActionController 
        onOpenAbility={() => setIsAbilityModalOpen(true)}
        onOpenSituation={() => setIsSituationModalOpen(true)}
      />

      <AbilityModal isOpen={isAbilityModalOpen} onClose={() => setIsAbilityModalOpen(false)} />
      <SituationModal isOpen={isSituationModalOpen} onClose={() => setIsSituationModalOpen(false)} />

      <div className="ui-overlay">
        {state.isMyTurn && <div className="turn-indicator">あなたのターン</div>}
      </div>
    </div>
  );
};
