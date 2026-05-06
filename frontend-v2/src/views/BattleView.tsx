import React from 'react';
import { useBattle } from '../hooks/useBattle';
import { useUser } from '../context/UserContext';
import { LobbyView } from '../components/battle/LobbyView';
import { AbilityModal } from '../components/battle/AbilityModal';
import { BattleArena } from '../components/battle/BattleArena';
import { GameLayout } from '../components/layout/GameLayout';
import { SituationModal } from '../components/battle/SituationModal';
import { StockSelectionModal } from '../components/battle/StockSelectionModal';
import { GameButton } from '../components/common/GameButton';
import { API_BASE_URL, WS_BASE_URL } from '../constants/game';
import type { AbilityData } from '../types/battle';
import styles from './BattleView.module.css';

import { useNavigate, useLocation } from 'react-router-dom';

export const BattleView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isDouble = location.pathname.includes('double');
  const { username } = useUser();
  
  // 動的なWebSocket URLの決定 (開発環境と本番環境の両対応)
  const dynamicWsUrl = React.useMemo(() => {
    if (WS_BASE_URL.includes('127.0.0.1') || WS_BASE_URL.includes('localhost')) {
       // ローカル時はそのまま、あるいは必要なら window.location.hostname を使う
       return WS_BASE_URL;
    }
    return WS_BASE_URL; // 本番環境などは定数に従う
  }, []);

  const { 
    ally, 
    foe, 
    battleState, 
    isConnected, 
    prediction,
    messageLog,
    notification,
    waitMessage,
    isProcessing,
    allyEffect,
    foeEffect,
    timer,
    allyWord,
    foeWord,
    knockoutStates,
    allyId,
    foeId,
    allAbilities: battleAbilities,
    sendMessage,
    sendIncludeCheck 
  } = useBattle(dynamicWsUrl);
  
  const [isLobby, setIsLobby] = React.useState(true);
  const [isAbilityModalOpen, setIsAbilityModalOpen] = React.useState(false);
  const [targetAbilityIndex, setTargetAbilityIndex] = React.useState(0);
  const [isSituationModalOpen, setIsSituationModalOpen] = React.useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = React.useState(false);
  
  const [selectedAbilities, setSelectedAbilities] = React.useState<string[]>(() => {
    const a1 = localStorage.getItem('sb_ability') || 'ikaku';
    const a2 = localStorage.getItem('sb_ability_2') || 'ikaku';
    return [a1, a2];
  });

  const [matchingMessage, setMatchingMessage] = React.useState<string | null>(null);
  const [allAbilities, setAllAbilities] = React.useState<Record<string, AbilityData>>({});

  // Hookのルールを守るため、すべての変数定義を早期リターンの前に配置
  const isStock = location.search.includes('mode=stock');
  const canChangeAbility = isLobby || (ally?.ability_change_count ?? 0) > 0;

  React.useEffect(() => {
    fetch(`${API_BASE_URL}/abilities`)
      .then(res => res.json())
      .then(data => setAllAbilities(data))
      .catch(err => console.error("Failed to fetch abilities:", err));
  }, []);

  React.useEffect(() => {
    if (battleState && isLobby) {
      if (battleAbilities && Object.keys(battleAbilities).length > 0) {
        setAllAbilities(battleAbilities);
      }
      setMatchingMessage("マッチングした！");
      const timer = setTimeout(() => {
        setIsLobby(false);
        setMatchingMessage(null);
        // 本家再現: 対戦開始時にモーダルをすべて閉じる
        setIsAbilityModalOpen(false);
        setIsSituationModalOpen(false);
        setIsStockModalOpen(false);
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

  if (!isConnected) {
    return (
      <GameLayout>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', background: '#fce5cd' }}>
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
              messageLog={messageLog}
              notification={notification}
              waitMessage={waitMessage}
              isProcessing={isProcessing}
              allyEffect={allyEffect}
              foeEffect={foeEffect}
              timer={timer}
              allyWord={allyWord}
              foeWord={foeWord}
              knockoutStates={knockoutStates}
              allyId={allyId}
              foeId={foeId}
              username={username || "ななし"}
              onSendWord={handleSubmitWord}
              onSendIncludeCheck={sendIncludeCheck}
              onOpenSituation={() => setIsSituationModalOpen(true)}
              onOpenAbility={() => handleOpenAbilityModal(0)}
              onRunAway={handleRunAway}
            />

            {battleState?.status === 'finished' && (
              <div className={styles.simpleResultArea}>
                <GameButton 
                  variant="orange"
                  className={styles.lobbyReturnBtn}
                  onClick={() => window.location.reload()}
                >
                  ロビーへ戻る
                </GameButton>
              </div>
            )}
          </>
        )}

        <StockSelectionModal 
          isOpen={isStockModalOpen}
          onClose={() => setIsStockModalOpen(false)}
          onConfirm={handleConfirmStockMatch}
        />

        <SituationModal 
          isOpen={isSituationModalOpen}
          onClose={() => setIsSituationModalOpen(false)}
          ally={ally}
          foe={foe}
          battleState={battleState}
          username={username || "ななし"}
        />

        <AbilityModal 
          isOpen={isAbilityModalOpen}
          onClose={() => setIsAbilityModalOpen(false)}
          onSelect={handleSelectAbility}
          currentAbilityId={selectedAbilities[targetAbilityIndex]}
          allyAbilityId={ally?.ability || ''}
          allAbilities={allAbilities}
          canChange={canChangeAbility}
          abilityChangeCount={ally?.ability_change_count ?? 0}
          isLobby={isLobby}
        />
      </div>
    </GameLayout>
  );
};
