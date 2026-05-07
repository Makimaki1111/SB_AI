import React from 'react';
import { useDoubleBattle } from '../hooks/useDoubleBattle';
import { useUser } from '../context/UserContext';
import { AbilityModal } from '../components/battle/AbilityModal';
import { DoubleBattleArena } from '../components/battle/DoubleBattleArena';
import { GameLayout } from '../components/layout/GameLayout';
import { DoubleSituationModal } from '../components/battle/DoubleSituationModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { GameButton } from '../components/common/GameButton';
import { API_BASE_URL, WS_BASE_URL } from '../constants/game';
import type { AbilityData } from '../types/battle';
import styles from './BattleView.module.css'; // Reuse common layout styles

import { useNavigate } from 'react-router-dom';

export const DoubleBattleView: React.FC = () => {
  const navigate = useNavigate();
  const { username } = useUser();
  
  const { 
    allyTeam, 
    foeTeam, 
    battleState, 
    isConnected, 
    prediction,
    messageLog,
    notification,
    waitMessage,
    isProcessing,
    characterEffects,
    characterWords,
    knockoutStates,
    selectedTargetId,
    setSelectedTargetId,
    timer,
    allAbilities: battleAbilities,
    sendMessage,
    sendWord,
    sendIncludeCheck,
    startMatching,
    resetBattle
  } = useDoubleBattle(WS_BASE_URL, () => setIsLobby(true));
  
  const [isLobby, setIsLobby] = React.useState(true);
  const [isAbilityModalOpen, setIsAbilityModalOpen] = React.useState(false);
  const [targetAbilityIndex, setTargetAbilityIndex] = React.useState(0); // 0 or 1 for double
  const [isSituationModalOpen, setIsSituationModalOpen] = React.useState(false);
  const [isRunAwayConfirmOpen, setIsRunAwayConfirmOpen] = React.useState(false);
  const lastRoomIdRef = React.useRef<string | null>(null);
  
  const [selectedAbilities, setSelectedAbilities] = React.useState<string[]>(() => {
    const a1 = localStorage.getItem('sb_ability') || 'ikaku';
    const a2 = localStorage.getItem('sb_ability_2') || 'ikaku';
    return [a1, a2];
  });

  const [allAbilities, setAllAbilities] = React.useState<Record<string, AbilityData>>({});

  React.useEffect(() => {
    fetch(`${API_BASE_URL}/abilities`)
      .then(res => res.json())
      .then(data => setAllAbilities(data))
      .catch(err => console.error("Failed to fetch abilities:", err));
  }, []);

  React.useEffect(() => {
    if (battleAbilities && Object.keys(battleAbilities).length > 0) {
      setAllAbilities(battleAbilities);
    }
    
    if (battleState && battleState.room_id !== lastRoomIdRef.current) {
      setIsAbilityModalOpen(false);
      setIsSituationModalOpen(false);
      setIsLobby(false);
      lastRoomIdRef.current = battleState.room_id;
    }
  }, [battleState, battleAbilities]);

  const handleAbilitySelect = (abilityId: string) => {
    const newAbilities = [...selectedAbilities];
    newAbilities[targetAbilityIndex] = abilityId;
    setSelectedAbilities(newAbilities);
    localStorage.setItem(targetAbilityIndex === 0 ? 'sb_ability' : 'sb_ability_2', abilityId);
    
    if (!isLobby && battleState?.room_id) {
      const charId = targetAbilityIndex === 0 ? 'p1a' : 'p1b'; // Simple mapping
      sendMessage({
        type: 'change_ability_double',
        info: {
          room_id: battleState.room_id,
          char_id: charId,
          ability_id: abilityId
        }
      });
    }
    setIsAbilityModalOpen(false);
  };

  const handleJoinMatch = (mode: 'match' | 'cpu' | 'create' | 'join', roomId?: string) => {
    startMatching();
    const info = {
      player_id: localStorage.getItem('sb_player_id'),
      name: username || "名無し",
      ability: selectedAbilities[0],
      ability_2: selectedAbilities[1]
    };

    if (mode === 'match') {
      sendMessage({ type: 'find_match_double', info });
    } else if (mode === 'cpu') {
      sendMessage({ type: 'join_double_cpu_room', info });
    } else if (mode === 'create') {
      sendMessage({ type: 'create_double_room', info: { ...info, mode: '1v1_double' } });
    } else if (mode === 'join' && roomId) {
      sendMessage({ type: 'join_double_room', info: { ...info, room_id: roomId } });
    }
  };

  const handleRunAway = () => {
    if (battleState?.room_id) {
      sendMessage({
        type: 'run_away_double',
        info: { room_id: battleState.room_id }
      });
    }
    resetBattle();
    setIsLobby(true);
    setIsRunAwayConfirmOpen(false);
    navigate('/');
  };

  return (
    <GameLayout>
      {isLobby ? (
        <div className={styles.lobbyWrapper}>
          <div className={styles.lobbyHeader}>
            <button className={styles.backBtn} onClick={() => navigate('/')}>←もどる</button>
            <h1>ダブルバトル</h1>
          </div>

          <div className={styles.abilitySection}>
            <p className={styles.sectionTitle}>使用するとくせい</p>
            <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
              {[0, 1].map(idx => (
                <div key={idx} className={styles.abilityCard} onClick={() => { setTargetAbilityIndex(idx); setIsAbilityModalOpen(true); }}>
                  <div className={styles.abilityIcon}>
                    <img src={`/img/${allAbilities[selectedAbilities[idx]]?.icon_type || 'normal'}.gif`} alt="" />
                  </div>
                  <div className={styles.abilityInfo}>
                    <span className={styles.memberLabel}>{idx === 0 ? '1人目' : '2人目'}</span>
                    <span className={styles.abilityName}>{allAbilities[selectedAbilities[idx]]?.name || '読み込み中...'}</span>
                    <span className={styles.abilityDesc}>{allAbilities[selectedAbilities[idx]]?.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.matchButtons}>
            <GameButton variant="orange" onClick={() => handleJoinMatch('match')} disabled={!isConnected}>
              ランダムマッチ
            </GameButton>
            <GameButton variant="green" onClick={() => handleJoinMatch('cpu')} disabled={!isConnected}>
              コンピュータ戦
            </GameButton>
            <div className={styles.divider} />
            <GameButton variant="grey" onClick={() => handleJoinMatch('create')} disabled={!isConnected}>
              ルーム作成
            </GameButton>
            <div className={styles.roomJoinRow}>
              <input type="text" id="roomIdInput" placeholder="ルームID" className={styles.roomIdInput} />
              <GameButton variant="green" onClick={() => {
                const id = (document.getElementById('roomIdInput') as HTMLInputElement).value;
                handleJoinMatch('join', id);
              }} disabled={!isConnected}>
                参加
              </GameButton>
            </div>
          </div>
          
          {messageLog.isOpen && <div className={styles.lobbyMessage}>{messageLog.text}</div>}
        </div>
      ) : (
        <DoubleBattleArena 
          battleState={battleState}
          allyTeam={allyTeam}
          foeTeam={foeTeam}
          prediction={prediction}
          messageLog={messageLog}
          notification={notification}
          waitMessage={waitMessage}
          isProcessing={isProcessing}
          characterEffects={characterEffects}
          characterWords={characterWords}
          knockoutStates={knockoutStates}
          timer={timer}
          username={username}
          selectedTargetId={selectedTargetId}
          onTargetSelect={setSelectedTargetId}
          onSendWord={sendWord}
          onSendIncludeCheck={sendIncludeCheck}
          onOpenSituation={() => setIsSituationModalOpen(true)}
          onOpenAbility={() => {
            // 現在の行動者のインデックスを特定
            if (battleState?.current_actor_id) {
              setTargetAbilityIndex(battleState.current_actor_id.endsWith('b') ? 1 : 0);
            }
            setIsAbilityModalOpen(true);
          }}
          onRunAway={() => setIsRunAwayConfirmOpen(true)}
        />
      )}

      {/* Modals */}
      {isAbilityModalOpen && (
        <AbilityModal 
          isOpen={isAbilityModalOpen}
          onClose={() => setIsAbilityModalOpen(false)}
          abilities={allAbilities}
          onSelect={handleAbilitySelect}
          currentAbilityId={selectedAbilities[targetAbilityIndex]}
          remainCount={!isLobby && battleState?.current_actor_id ? battleState.characters[battleState.current_actor_id]?.ability_change_count : undefined}
        />
      )}

      {isSituationModalOpen && (
        <DoubleSituationModal 
          isOpen={isSituationModalOpen}
          onClose={() => setIsSituationModalOpen(false)}
          battleState={battleState}
        />
      )}

      {isRunAwayConfirmOpen && (
        <ConfirmModal 
          isOpen={isRunAwayConfirmOpen}
          title="にげる"
          message="本当に逃げますか？"
          onConfirm={handleRunAway}
          onCancel={() => setIsRunAwayConfirmOpen(false)}
        />
      )}
    </GameLayout>
  );
};
