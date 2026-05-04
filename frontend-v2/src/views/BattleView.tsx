import React from 'react';
import { useBattle } from '../hooks/useBattle';
import { useUser } from '../context/UserContext';
import { HPBar } from '../components/battle/HPBar';
import { CharacterAvatar } from '../components/battle/CharacterAvatar';
import { WordDisplay } from '../components/battle/WordDisplay';
import { WordInput } from '../components/battle/WordInput';

import { LobbyView } from '../components/battle/LobbyView';
import { AbilityModal } from '../components/battle/AbilityModal';
import { BattleEffects } from '../components/battle/BattleEffects';
import { GameLayout } from '../components/layout/GameLayout';
import { GameModal } from '../components/common/GameModal';
import { StatCard } from '../components/battle/StatCard';
import { StockSelectionModal } from '../components/battle/StockSelectionModal';
import { API_BASE_URL, WS_BASE_URL, TYPE_TO_IMAGE } from '../constants/game';
import type { AbilityData } from '../types/battle';
import styles from './BattleView.module.css';

import { useNavigate, useLocation } from 'react-router-dom';

export const BattleView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isDouble = location.pathname.includes('double');
  const { username } = useUser();
  const { 
    ally, 
    foe, 
    battleState, 
    isConnected, 
    prediction,
    displayMessage,
    isProcessing,
    allyEffect,
    foeEffect,
    timer,
    allyWord,
    foeWord,
    sendMessage,
    sendIncludeCheck 
  } = useBattle(WS_BASE_URL);
  
  const [isLobby, setIsLobby] = React.useState(true);
  const [isAbilityModalOpen, setIsAbilityModalOpen] = React.useState(false);
  const [targetAbilityIndex, setTargetAbilityIndex] = React.useState(0); // ダブルバトル用
  const [isSituationModalOpen, setIsSituationModalOpen] = React.useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = React.useState(false);
  
  const [selectedAbilities, setSelectedAbilities] = React.useState<string[]>(() => {
    const a1 = localStorage.getItem('sb_ability') || 'ikaku';
    const a2 = localStorage.getItem('sb_ability_2') || 'ikaku';
    return [a1, a2];
  });

  const [matchingMessage, setMatchingMessage] = React.useState<string | null>(null);
  const [allAbilities, setAllAbilities] = React.useState<Record<string, AbilityData>>({});


  // 特性リストを事前に取得
  React.useEffect(() => {
    fetch(`${API_BASE_URL}/abilities`)
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

  const [playerId] = React.useState(() => {
    const saved = localStorage.getItem('sb_player_id');
    if (saved) return saved;
    const newId = "p_" + Math.random().toString(36).substring(7);
    localStorage.setItem('sb_player_id', newId);
    return newId;
  });

  const handleStartMatch = (mode: 'player' | 'cpu' | 'room') => {
    const isStockMode = location.search.includes('mode=stock');
    
    // ストック制のルーム作成時は、まずモーダルを開く
    if (isStockMode && mode === 'room') {
      setIsStockModalOpen(true);
      return;
    }

    const commonInfo = {
      player_id: playerId,
      name: username || "ななし",
      ability: selectedAbilities[0],
      ability_2: isDouble ? selectedAbilities[1] : "",
      ally_max_lives: isStockMode ? 2 : 1, // デフォルト
      foe_max_lives: isStockMode ? 2 : 1
    };

    if (isDouble) {
      if (mode === 'cpu') {
        sendMessage({
          type: "join_double_cpu_room",
          info: { ...commonInfo }
        });
      } else if (mode === 'player') {
        sendMessage({
          type: "find_match_double",
          info: { ...commonInfo }
        });
      }
      return;
    }

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

  const handleConfirmStockMatch = (allyStock: number, foeStock: number) => {
    setIsStockModalOpen(false);
    sendMessage({
      type: "make_new_battle",
      info: { 
        player_id: playerId,
        name: username || "ななし",
        ability: selectedAbilities[0],
        ability_2: "",
        mode: "cpu", // ルーム作成からの開始は一旦CPU戦に準拠（要件に合わせて調整可）
        ally_max_lives: allyStock,
        foe_max_lives: foeStock
      }
    });
  };

  const handleOpenAbilityModal = (index?: number) => {
    setTargetAbilityIndex(index || 0);
    setIsAbilityModalOpen(true);
  };

  const handleSelectAbility = (abilityId: string) => {
    const newAbilities = [...selectedAbilities];
    newAbilities[targetAbilityIndex] = abilityId;
    setSelectedAbilities(newAbilities);
    
    if (targetAbilityIndex === 0) {
      localStorage.setItem('sb_ability', abilityId);
    } else {
      localStorage.setItem('sb_ability_2', abilityId);
    }
    setIsAbilityModalOpen(false);
  };

  const handleRunAway = () => {
    if (battleState?.room_id) {
      sendMessage({
        type: 'run_away',
        info: { room_id: battleState.room_id, player_id: playerId }
      });
    }
    window.location.reload();
  };

  const handleSubmitWord = (word: string) => {
    sendMessage({
      type: 'submit_word',
      info: { 
        word, 
        room_id: battleState?.room_id,
        player_id: playerId 
      }
    });
  };

  if (!isConnected) {
    return (
      <GameLayout>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <div className={styles.loading}>サーバーに接続中...</div>
        </div>
      </GameLayout>
    );
  }

  const isStock = location.search.includes('mode=stock');

  return (
    <GameLayout id="phone-box">
      <div className={styles.battleArea}>
        {matchingMessage && (
          <div className={styles.matchOverlay}>
            <div className={styles.matchMessage}>{matchingMessage}</div>
          </div>
        )}

        {isLobby ? (
          <LobbyView 
            onStartMatch={handleStartMatch}
            onOpenAbilityModal={handleOpenAbilityModal}
            onBackToTitle={() => navigate('/')}
            selectedAbilities={selectedAbilities}
            allAbilities={allAbilities}
            mode={isDouble ? 'double' : isStock ? 'stock' : 'single'}
          />
        ) : (
            <div className={styles.battleContainer}>
              <div className={styles.topImage}>
                <img src="/img/ground.jpg" className={styles.bgImage} alt="背景画像" />
                
                {/* 背景要素 (地面) */}
                <div className={`${styles.ellipse} ${styles.ellipseRight}`} />
                <div className={`${styles.ellipse} ${styles.ellipseLeft}`} />

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
                <CharacterAvatar 
                  type={foe?.types[0] ?? "ノーマル"} 
                  isAlly={false} 
                  isBlinking={foeEffect === 'blink'}
                />
                <BattleEffects trigger={foeEffect} side="foe" />
                <WordDisplay word={foeWord} isAlly={false} />

                {/* 自分セクション */}
                <CharacterAvatar 
                  type={ally?.types[0] ?? "ノーマル"} 
                  isAlly={true} 
                  isBlinking={allyEffect === 'blink'}
                />
                <BattleEffects trigger={allyEffect} side="ally" />
                <WordDisplay word={allyWord} isAlly={true} />
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
                    <div 
                      className={styles.timerBar} 
                      style={{ 
                        width: `${(timer.remaining / timer.total) * 100}%`,
                        backgroundColor: timer.remaining > 10 ? '#00FF00' : timer.remaining > 5 ? '#FFFF00' : '#FF0000'
                      }} 
                    />
                  </div>
                  <WordInput 
                    onSend={handleSubmitWord} 
                    onChange={sendIncludeCheck}
                    disabled={!battleState?.is_my_turn || isProcessing}
                    initialChar={battleState?.character || ''}
                  />
                  {prediction && prediction.include && (
                    <div className={styles.predictionContainer}>
                      <div className={styles.predictionImages}>
                        {prediction.used ? (
                          <img src="/img/god.gif" alt="Used" className={styles.predictionImg} />
                        ) : (
                          <>
                            {prediction.type1 && <img src={`/img/${TYPE_TO_IMAGE[prediction.type1] || 'normal'}.gif`} alt="Type 1" className={styles.predictionImg} />}
                            {prediction.type2 && <img src={`/img/${TYPE_TO_IMAGE[prediction.type2] || 'normal'}.gif`} alt="Type 2" className={styles.predictionImg} />}
                          </>
                        )}
                      </div>
                      {prediction.prediction && <div className={styles.predictionMsg}>{prediction.prediction}</div>}
                    </div>
                  )}
                  {displayMessage && (
                    <div className={styles.messageOverlay}>
                      {displayMessage}
                    </div>
                  )}
                  <div className={styles.message}>
                    {battleState?.message}
                  </div>
                </div>
              </div>

              <div className={styles.actionsWrapper}>
                  <div 
                    className={`${styles.actionBtn} ${styles.situationBtn}`} 
                    onClick={() => setIsSituationModalOpen(true)}
                  >
                    <svg className={styles.actionBtnIcon} viewBox="0 0 24 24">
                      <path d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10,0,0,0,2,12A10,10,0,0,0,12,22A10,10,0,0,0,22,12A10,10,0,0,0,12,2Z" />
                    </svg>
                    <span className={styles.actionBtnText}>状況</span>
                  </div>
                  <div 
                    className={`${styles.actionBtn} ${styles.abilityBtn}`}
                    onClick={() => setIsAbilityModalOpen(true)}
                  >
                    <svg className={styles.actionBtnIcon} viewBox="0 0 24 24">
                      <path d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z" />
                    </svg>
                    <span className={styles.actionBtnText}>特性</span>
                  </div>
              </div>

              <div className={styles.footerArea}>
                <button 
                  className={styles.cancelBattleBtn}
                  onClick={handleRunAway}
                >
                  にげる
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ストック選択モーダル (本家仕様) */}
        <StockSelectionModal 
          isOpen={isStockModalOpen}
          onClose={() => setIsStockModalOpen(false)}
          onConfirm={handleConfirmStockMatch}
        />

        {/* 状況確認モーダル (GameModal / StatCard 使用) */}
        <GameModal
          isOpen={isSituationModalOpen}
          onClose={() => setIsSituationModalOpen(false)}
          title="じょうきょう"
          footer={
            <button className={styles.backBtn} onClick={() => setIsSituationModalOpen(false)}>とじる</button>
          }
        >
          <div className={styles.situationCardsContainer}>
            <StatCard 
              type="foe"
              name="あいて"
              stats={{
                attack: battleState?.foe_stats?.attack || 1.0,
                defense: battleState?.foe_stats?.defense || 1.0
              }}
            />
            <StatCard 
              type="ally"
              name="じぶん"
              stats={{
                attack: battleState?.ally_stats?.attack || 1.0,
                defense: battleState?.ally_stats?.defense || 1.0
              }}
            />
          </div>
        </GameModal>

        <AbilityModal 
          isOpen={isAbilityModalOpen}
          onClose={() => setIsAbilityModalOpen(false)}
          onSelect={handleSelectAbility}
          currentAbilityId={selectedAbilities[targetAbilityIndex]}
          allAbilities={allAbilities}
          canChange={isLobby || (Object.values(battleState?.characters || {}).find(c => c.owner_id === "player1")?.ability_change_count ?? 0) > 0}
        />
      </div>
    </GameLayout>
  );
};
