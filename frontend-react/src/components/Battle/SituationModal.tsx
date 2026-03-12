import React from 'react';
import { useBattle } from '../../context/BattleContext';
import './Modal.css';

interface SituationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SituationModal: React.FC<SituationModalProps> = ({ isOpen, onClose }) => {
  const { state } = useBattle();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass" onClick={e => e.stopPropagation()}>
        <h3>じょうきょう確認</h3>
        
        <div className="stats-comparison">
          <div className="team-stats ally">
            <h4>自分チーム</h4>
            {Object.values(state.characters).filter(c => c.id.startsWith('p1')).map(c => (
              <div key={c.id} className="stat-row glass">
                <span className="char-name">{c.name}</span>
                <div className="stat-values">
                  <span>HP: {c.hp}/{c.maxHp}</span>
                  <span>火: {c.atkRank > 0 ? `+${c.atkRank}` : c.atkRank}</span>
                  <span>守: {c.defRank > 0 ? `+${c.defRank}` : c.defRank}</span>
                  {c.isPoison && <span className="poison">毒</span>}
                </div>
              </div>
            ))}
          </div>
          
          <div className="team-stats foe">
            <h4>相手チーム</h4>
            {Object.values(state.characters).filter(c => c.id.startsWith('p2')).map(c => (
              <div key={c.id} className="stat-row glass">
                <span className="char-name">{c.name}</span>
                <div className="stat-values">
                  <span>HP: {c.hp}/{c.maxHp}</span>
                  <span>火: {c.atkRank > 0 ? `+${c.atkRank}` : c.atkRank}</span>
                  <span>守: {c.defRank > 0 ? `+${c.defRank}` : c.defRank}</span>
                  {c.isPoison && <span className="poison">毒</span>}
                </div>
              </div>
            ))}
          </div>
        </div>


        <button className="close-btn" onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
};
