import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBattle } from '../context/BattleContext';
import { useAudio } from '../context/AudioContext';
import './LobbyPage.css';

interface AbilityInfo {
  name: string;
  description: string;
  icon_type: string;
}

export const LobbyPage: React.FC = () => {
  const { mode } = useParams<{ mode: 'single' | 'double' }>();
  const navigate = useNavigate();
  const { startBattle, connect } = useBattle();
  const { playSound } = useAudio();

  const [username] = useState(localStorage.getItem('sb_username') || '');
  const [roomId, setRoomId] = useState('');
  const [isMatching, setIsMatching] = useState(false);
  const [abilities, setAbilities] = useState<Record<string, AbilityInfo>>({});
  const [selectedAbility1, setSelectedAbility1] = useState(localStorage.getItem('sb_ability') || '');
  const [selectedAbility2, setSelectedAbility2] = useState(localStorage.getItem('sb_ability2') || '');
  const [showAbilityModal, setShowAbilityModal] = useState<{ target: 1 | 2 } | null>(null);

  const getIconUrl = (iconType: string) => {
    const fileName = (iconType && iconType.includes('.')) ? iconType : `${iconType || 'normal'}.gif`;
    return `/src/assets/img/${fileName}`;
  };

  useEffect(() => {
    // Fetch abilities from backend
    fetch('/abilities')
      .then(res => res.json())
      .then(data => setAbilities(data))
      .catch(err => console.error('Failed to fetch abilities:', err));
  }, []);

  const handleBack = () => {
    playSound('/src/assets/resource/pera.mp3');
    navigate('/');
  };

  const handleStart = (subMode: 'player' | 'cpu' | 'room', joinRoomId?: string) => {
    if (!username.trim()) {
      alert('なまえを にゅうりょく してください！');
      return;
    }
    localStorage.setItem('sb_username', username);
    localStorage.setItem('sb_ability', selectedAbility1);
    if (mode === 'double') localStorage.setItem('sb_ability2', selectedAbility2);

    playSound('/src/assets/resource/pera.mp3');
    setIsMatching(true);

    if (subMode === 'room' && joinRoomId) {
       connect(mode!, 'join', joinRoomId);
    } else if (subMode === 'room') {
       connect(mode!, 'create');
    } else {
       startBattle(mode!, subMode, username);
    }
  };

  const openAbilityModal = (target: 1 | 2) => {
    playSound('/src/assets/resource/pera.mp3');
    setShowAbilityModal({ target });
  };

  const selectAbility = (abilityId: string) => {
    playSound('/src/assets/resource/concent.mp3');
    if (showAbilityModal?.target === 1) {
      setSelectedAbility1(abilityId);
    } else {
      setSelectedAbility2(abilityId);
    }
  };

  const closeAbilityModal = () => {
    playSound('/src/assets/resource/pera.mp3');
    setShowAbilityModal(null);
  };

  const renderAbilityButton = (target: 1 | 2) => {
    const abilityId = target === 1 ? selectedAbility1 : selectedAbility2;
    const ability = abilities[abilityId];
    const isDouble = mode === 'double';

    return (
      <div className="lobby-ability-btn" onClick={() => openAbilityModal(target)}>
        <div className="ability-icon-container">
          <img 
            src={getIconUrl(ability?.icon_type || 'normal')} 
            alt="icon" 
            style={{ opacity: ability ? 1 : 0.5 }}
          />
        </div>
        <div className="ability-info-container">
          {isDouble && <div className="target-label">{target === 1 ? '1人目' : '2人目'}</div>}
          <div className="ability-name">{ability ? ability.name : 'ランダム'}</div>
          <div className="ability-desc">
            {ability ? ability.description : 'ランダムに決定されます'}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`lobby-screen ${mode}-lobby`}>
      <div className="phone-box">
        <div className="content">
          <button className="back-to-title-link" onClick={handleBack}>←もどる</button>
          <h1>{mode === 'single' ? 'シングルバトル' : 'ダブルバトル'}</h1>

          <div className="lobby-main-content">
            {renderAbilityButton(1)}
            {mode === 'double' && renderAbilityButton(2)}

            <div className="lobby-menu">
              <button className="button-lobby" onClick={() => handleStart('cpu')}>
                コンピュータ戦
              </button>
              
              <hr className="lobby-divider" />

              <button className="button-lobby" onClick={() => handleStart('room')}>
                ルーム作成
              </button>

              <div className="join-room-container">
                <input 
                  type="text" 
                  placeholder="ルームID" 
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                />
                <button className="join-btn" onClick={() => handleStart('room', roomId)}>
                  参加する
                </button>
              </div>
            </div>
          </div>

          {isMatching && (
            <div className="matching-overlay">
              <div className="spinner"></div>
              <p>対戦相手を探しています...</p>
            </div>
          )}
        </div>
      </div>

      {showAbilityModal && (
        <div className="lobby-modal-overlay">
          <div className="lobby-modal-content">
            <h3>とくせいを選択</h3>
            <div className="modal-ability-desc">
              {abilities[showAbilityModal.target === 1 ? selectedAbility1 : selectedAbility2]?.description || 'ランダムに決定されます'}
            </div>
            <div className="abilities-grid">
              <div 
                className={`ability-item ${((showAbilityModal.target === 1 ? selectedAbility1 : selectedAbility2) === '') ? 'selected' : ''}`}
                onClick={() => selectAbility('')}
              >
                <img 
                  src={getIconUrl('normal')} 
                  alt="random" 
                  style={{ opacity: 0.5 }} 
                />
                <span>ランダム</span>
              </div>
              {Object.entries(abilities).map(([id, info]) => (
                <div 
                  key={id}
                  className={`ability-item ${((showAbilityModal.target === 1 ? selectedAbility1 : selectedAbility2) === id) ? 'selected' : ''}`}
                  onClick={() => selectAbility(id)}
                >
                  <img 
                    src={getIconUrl(info.icon_type)} 
                    alt={info.name} 
                  />
                  <span>{info.name}</span>
                </div>
              ))}
            </div>
            <button className="modal-close-btn" onClick={closeAbilityModal}>決定</button>
          </div>
        </div>
      )}
    </div>
  );
};
