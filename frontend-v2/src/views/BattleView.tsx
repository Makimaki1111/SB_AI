import React from 'react';
import { useBattle } from '../hooks/useBattle';
import { useUser } from '../context/UserContext';
import { HPBar } from '../components/battle/HPBar';
import { CharacterAvatar } from '../components/battle/CharacterAvatar';
import { WordDisplay } from '../components/battle/WordDisplay';
import { WordInput } from '../components/battle/WordInput';
const WS_URL = 'ws://127.0.0.1:8000/ws';

import { LobbyView } from '../components/battle/LobbyView';
import { AbilityModal } from '../components/battle/AbilityModal';
import styles from './BattleView.module.css';

import { useNavigate } from 'react-router-dom';

export const BattleView: React.FC = () => {
  const navigate = useNavigate();
  const { username } = useUser();
  const { ally, foe, battleState, isConnected, sendMessage } = useBattle(WS_URL);
  
  const [isLobby, setIsLobby] = React.useState(true);
  const [isAbilityModalOpen, setIsAbilityModalOpen] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [tempName, setTempName] = React.useState(username);
  const [selectedAbility, setSelectedAbility] = React.useState(localStorage.getItem('sb_ability') || 'ikaku');
  const [matchingMessage, setMatchingMessage] = React.useState<string | null>(null);
  const [allAbilities, setAllAbilities] = React.useState<Record<string, any>>({});

  const { setUsername } = useUser();
  const handleSaveSettings = () => {
    setUsername(tempName);
    setIsSettingsOpen(false);
  };

  // 特性リストを事前に取得
  React.useEffect(() => {
    fetch('http://127.0.0.1:8000/abilities')
      .then(res => res.json())
      .then(data => setAllAbilities(data))
      .catch(err => console.error("Failed to fetch abilities:", err));
  }, []);

  // マッチング成功時の演出
  React.useEffect(() => {
    if (battleState && isLobby) {
      // サーバーからの最新の特性リストがあれば上書き
      if (battleState.all_abilities) {
        setAllAbilities(battleState.all_abilities);
      }
      setMatchingMessage("マッチングした！");
      const timer = setTimeout(() => {
        setIsLobby(false);
        setMatchingMessage(null);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [battleState, isLobby]);

  const handleStartMatch = (mode: 'player' | 'cpu' | 'room') => {
    const playerId = "p_" + Math.random().toString(36).substring(7);
    const commonInfo = {
      player_id: playerId,
      name: username || "ななし",
      ability: selectedAbility,
      ability_2: ""
    };

    if (mode === 'cpu') {
      sendMessage({
        type: "make_new_battle",
        info: { 
          ...commonInfo,
          player1_id: playerId, 
          player2_id: "cpu", 
          p1_max_lives: 2, 
          p2_max_lives: 2
        }
      });
    } else if (mode === 'player') {
      sendMessage({
        type: "find_match",
        info: { 
          ...commonInfo,
          max_lives: 2
        }
      });
    }
  };

  const handleAbilitySelect = (abilityId: string) => {
    setSelectedAbility(abilityId);
    localStorage.setItem('sb_ability', abilityId);
    if (!isLobby && battleState) {
      sendMessage({
        type: "change_ability",
        info: { 
          ability_id: abilityId,
          room_id: battleState.room_id
        }
      } as any);
    }
  };

  if (!isConnected) {
    return (
      <div className={styles.container}>
        <div className={styles.phoneBox} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className={styles.loading}>サーバーに接続中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.phoneBox} id="phone-box">
        {isLobby ? (
          <LobbyView 
            onStartMatch={handleStartMatch}
            onOpenAbilityModal={() => setIsAbilityModalOpen(true)}
            onBackToTitle={() => navigate('/')}
            selectedAbility={selectedAbility}
            allAbilities={allAbilities}
          />
        ) : (
          <div className={styles.battleContainer}>
            <div className={styles.topImage}>
              <img src="/img/ground.jpg" className={styles.bgImage} alt="背景画像" />
              
              {/* 相手セクション */}
              <HPBar 
                hp={foe?.hp ?? 0} 
                maxHp={foe?.max_hp ?? 100} 
                name={foe?.name ?? "あいて"} 
                isPoison={foe?.is_poison ?? false}
                lives={foe?.lives ?? 0}
                maxLives={battleState?.foe_max_lives ?? 2}
                isAlly={false}
              />
              <CharacterAvatar type={foe?.types[0] ?? "ノーマル"} isAlly={false} />
              <WordDisplay word={battleState?.word || null} isAlly={false} />

              {/* 自分セクション */}
              <CharacterAvatar type={ally?.types[0] ?? "ノーマル"} isAlly={true} />
              <WordDisplay word={null} isAlly={true} />
              <HPBar 
                hp={ally?.hp ?? 0} 
                maxHp={ally?.max_hp ?? 100} 
                name={username || ally?.name || "じぶん"} 
                isPoison={ally?.is_poison ?? false}
                lives={ally?.lives ?? 0}
                maxLives={battleState?.ally_max_lives ?? 2}
                isAlly={true}
              />
            </div>

            <div className={styles.content}>
              <div className={styles.actionArea}>
                <div className={styles.inputWrapper}>
                  <div className={styles.timerContainer}>
                    <div className={styles.timerBar} style={{ width: '100%', backgroundColor: '#00FF00' }} />
                  </div>
                  <WordInput 
                    onSend={(word) => sendMessage({ type: 'submit_word', info: { word, room_id: battleState?.room_id } } as any)} 
                    disabled={!battleState?.is_my_turn}
                    initialChar={battleState?.character || ''}
                  />
                  <div className={styles.message}>
                    {battleState?.message}
                  </div>
                  <div className={styles.waitMessage}>
                    {battleState?.is_my_turn ? "" : "あいてのターンです..."}
                  </div>
                </div>
              </div>

              <div className={styles.footerArea}>
                <div className={styles.actionBtn} onClick={() => { /* 状況モーダル */ }}>
                  <svg viewBox="0 0 24 24" className={styles.actionBtnIcon}>
                    <path d="M3 13.125C3 12.5037 3.50368 12 4.125 12H6.75C7.37132 12 7.875 12.5037 7.875 13.125V18.375C7.875 18.9963 7.37132 19.5 6.75 19.5H4.125C3.50368 19.5 3 18.9963 3 18.375V13.125ZM10.125 7.125C10.125 6.50368 10.6287 6 11.25 6H13.875C14.4963 6 15 6.50368 15 7.125V18.375C15 18.9963 14.4963 19.5 13.875 19.5H11.25C10.6287 19.5 10.125 18.9963 10.125 18.375V7.125ZM17.25 3.375C17.25 2.75368 17.7537 2.25 18.375 2.25H21C21.6213 2.25 22.125 2.75368 22.125 3.375V18.375C22.125 18.9963 21.6213 19.5 21 19.5H18.375C17.7537 19.5 17.25 18.9963 17.25 18.375V3.375Z" />
                  </svg>
                  <p className={styles.actionBtnText}>状況</p>
                </div>
                <div className={styles.actionBtn} onClick={() => setIsAbilityModalOpen(true)}>
                  <svg viewBox="0 0 24 24" className={styles.actionBtnIcon}>
                    <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                  <p className={styles.actionBtnText}>特性</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* マッチング・決着オーバーレイ */}
        {matchingMessage && (
          <div className={styles.matchingOverlay}>
            <div className={styles.matchingText}>{matchingMessage}</div>
          </div>
        )}

        {!isLobby && typeof battleState?.ally_win === 'boolean' && (
          <div className={styles.gameOverOverlay}>
            <div className={styles.gameOverBox}>
              <h2>{battleState.ally_win ? 'YOU WIN!' : 'YOU LOSE...'}</h2>
              <button onClick={() => window.location.reload()}>タイトルへ</button>
            </div>
          </div>
        )}

        {isSettingsOpen && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <h2 className={styles.modalTitle}>設定</h2>
              <div className={styles.field}>
                <label>名前</label>
                <input 
                  type="text" 
                  value={tempName} 
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="名無し"
                />
              </div>
              <div className={styles.field}>
                <label>BGM音量</label>
                <input type="range" min="0" max="100" defaultValue="50" style={{ width: '100%' }} />
              </div>
              <div className={styles.field}>
                <label>SE音量</label>
                <input type="range" min="0" max="100" defaultValue="80" style={{ width: '100%' }} />
              </div>
              <button className={styles.closeButton} onClick={handleSaveSettings}>
                閉じる
              </button>
            </div>
          </div>
        )}

        <AbilityModal 
          isOpen={isAbilityModalOpen}
          onClose={() => setIsAbilityModalOpen(false)}
          onSelect={handleAbilitySelect}
          currentAbilityId={selectedAbility}
          allAbilities={allAbilities}
          canChange={isLobby || (Object.values(battleState?.characters || {}).find(c => c.owner_id === "player1")?.ability_change_count ?? 0) > 0}
        />
      </div>
    </div>
  );
};
