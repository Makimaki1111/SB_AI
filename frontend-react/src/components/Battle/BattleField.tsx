import React from 'react';
import type { CharacterData, BattleMode } from '../../types';
import { PlayerSlot } from './PlayerSlot';
import './BattleField.css';

interface BattleFieldProps {
  mode: BattleMode;
  team1: CharacterData[];
  team2: CharacterData[];
  myTeam: 'team1' | 'team2';
}

export const BattleField: React.FC<BattleFieldProps> = ({ mode, team1, team2, myTeam }) => {
  const isTeam1Ally = myTeam === 'team1';
  
  const allyTeam = isTeam1Ally ? team1 : team2;
  const foeTeam = isTeam1Ally ? team2 : team1;

  return (
    <div className={`battle-field ${mode}`}>
      <div className="ellipse ellipse-foe" id="ellipse-enemy" />
      <div className="ellipse ellipse-ally" id="ellipse-ally" />

      <div className={`team-container foe-team top-right ${mode}`}>
        {foeTeam.map(char => (
          <PlayerSlot key={char.id} data={char} isAlly={false} />
        ))}
      </div>
      
      <div className={`team-container ally-team bottom-left ${mode}`}>
        {allyTeam.map(char => (
          <PlayerSlot key={char.id} data={char} isAlly={true} />
        ))}
      </div>
    </div>
  );
};

