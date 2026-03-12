import React, { useState } from 'react';
import { useBattle } from '../../context/BattleContext';
import { useAudio } from '../../context/AudioContext';
import './Modal.css';

interface AbilityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AbilityModal: React.FC<AbilityModalProps> = ({ isOpen, onClose }) => {
  const { state, changeAbility } = useBattle();
  const { playSound } = useAudio();
  const [selectedCharId, setSelectedCharId] = useState(Object.keys(state.characters)[0] || 'p1a');

  if (!isOpen) return null;

  const characters = Object.values(state.characters).filter(c => c.id.startsWith('p1'));

  const handleSelectAbility = (abilityId: string) => {
    playSound('/src/assets/resource/pera.mp3');
    changeAbility(abilityId, selectedCharId);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass" onClick={e => e.stopPropagation()}>
        <h3>とくせい選択</h3>
        
        {state.mode === 'double' && (
          <div className="char-tabs">
            {characters.map(c => (
              <button 
                key={c.id} 
                className={`tab-btn ${selectedCharId === c.id ? 'active' : ''} ${c.id.startsWith('p1') ? 'ally' : 'foe'}`}
                onClick={() => setSelectedCharId(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="current-ability-info glass">
          <div className="label">現在の特性: {state.allAbilities[state.characters[selectedCharId]?.ability]?.name || '???'}</div>
          <div className="desc">{state.allAbilities[state.characters[selectedCharId]?.ability]?.description}</div>
        </div>

        <div className="ability-list">
          {Object.entries(state.allAbilities).map(([id, ability]) => (
            <button 
              key={id} 
              className={`ability-btn glass ${state.characters[selectedCharId]?.ability === id ? 'current' : ''}`}
              onClick={() => handleSelectAbility(id)}
            >
              <div className="name">{ability.name}</div>
              <div className="desc-small">{ability.description}</div>
            </button>
          ))}
        </div>


        <button className="close-btn" onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
};
