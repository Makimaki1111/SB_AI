import React from 'react';
import { useBattle } from '../hooks/useBattle';
import { useUser } from '../context/UserContext';
import { LobbyView } from '../components/battle/LobbyView';
import { AbilityModal } from '../components/battle/AbilityModal';
import { BattleArena } from '../components/battle/BattleArena';
import { GameLayout } from '../components/layout/GameLayout';
import { GameModal } from '../components/common/GameModal';
import { StatCard } from '../components/battle/StatCard';
import { StockSelectionModal } from '../components/battle/StockSelectionModal';
import { API_BASE_URL, WS_BASE_URL } from '../constants/game';
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
    allAbilities: battleAbilities,
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
      if (battleAbilities && Object.keys(battleAbilities).length > 0) {
        setAllAbilities(battleAbilities);
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
    if (isStockMode && mode === 'room') {
      setIsStockModalOpen(true);
      return;
    }

    const commonInfo = {
      player_id: playerId,
      name: username || "ななし",
      ability: selectedAbilities[0],
      ability_2: isDouble ? selectedAbilities[1] : "",
      ally_max_lives: isStockMode ? 2 : 1,
      foe_max_lives: isStockMode ? 2 : 1
    };

    if (isDouble) {
      if (mode === 'cpu') {
        sendMessage({ type: "join_double_cpu_room", info: { ...commonInfo } });
      } else if (mode === 'player') {
        sendMessage({ type: "find_match_double", info: { ...commonInfo } });
      }
      return;
    }

    if (mode === 'cpu') {
      sendMessage({
        type: "make_new_battle",
        info: { ...commonInfo, player1_id: playerId, player2_id: "cpu", p1_max_lives: 2, p2_max_lives: 2 }
      });
    } else if (mode === 'player') {
      sendMessage({
        type: "find_match",
        info: { ...commonInfo, max_lives: 2 }
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
        mode: "cpu",
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

    // 対戦中ならサーバーへ送信
    if (!isLobby && battleState?.room_id) {
      sendMessage({
        type: 'change_ability',
        info: { 
          room_id: battleState.room_id, 
          player_id: playerId, 
          ability_id: abilityId,
          char_id: isDouble ? (targetAbilityIndex === 0 ? 'p1' : 'p2') : 'p1'
        }
      });
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
      info: { word, room_id: battleState?.room_id, player_id: playerId }
    });
  };

  const isStock = location.search.includes('mode=stock');
  const canChangeAbility = isLobby || (ally?.ability_change_count ?? 0) > 0;

  if (!isConnected) {
    return (
      <GameLayout>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <div className={styles.loading}>サーバーに接続中...</div>
        </div>
      </GameLayout>
    );
  }

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
          <>
            <BattleArena 
              battleState={battleState}
              ally={ally}
              foe={foe}
              prediction={prediction}
              displayMessage={displayMessage}
              isProcessing={isProcessing}
              allyEffect={allyEffect}
              foeEffect={foeEffect}
              timer={timer}
              allyWord={allyWord}
              foeWord={foeWord}
              username={username || "ななし"}
              onSendWord={handleSubmitWord}
              onSendIncludeCheck={sendIncludeCheck}
              onOpenSituation={() => setIsSituationModalOpen(true)}
              onOpenAbility={() => handleOpenAbilityModal(0)}
              onRunAway={handleRunAway}
            />

            {/* リザルトオーバーレイ */}
            {battleState?.status === 'finished' && (
              <div className={styles.resultOverlay}>
                <div className={styles.resultCard}>
                  <h2 className={styles.resultTitle}>
                    {battleState.ally_win === true ? 'YOU WIN!' : 
                     battleState.ally_win === false ? 'YOU LOSE...' : 'DRAW'}
                  </h2>
                  <div className={styles.resultActions}>
                    <button 
                      className={styles.resultBtn}
                      onClick={() => window.location.reload()}
                    >
                      ロビーへ戻る
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <StockSelectionModal 
          isOpen={isStockModalOpen}
          onClose={() => setIsStockModalOpen(false)}
          onConfirm={handleConfirmStockMatch}
        />

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
                attack: foe?.attack_rank || 1.0,
                defense: foe?.defense_rank || 1.0
              }}
            />
            <StatCard 
              type="ally"
              name="じぶん"
              stats={{
                attack: ally?.attack_rank || 1.0,
                defense: ally?.defense_rank || 1.0
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
          canChange={canChangeAbility}
        />
      </div>
    </GameLayout>
  );
};
