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
  
  const dynamicWsUrl = React.useMemo(() => {
    return WS_BASE_URL;
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
    showResultButton,
    allAbilities: battleAbilities,
    sendMessage,
    sendIncludeCheck,
    clearPrediction
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

  const [allAbilities, setAllAbilities] = React.useState<Record<string, AbilityData>>({});

  const isStock = location.search.includes('mode=stock');
  const canChangeAbility = isLobby || (ally?.ability_change_count ?? 0) > 0;

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
    
    if (battleState) {
      // マッチング完了時の状態整理
      setIsAbilityModalOpen(false);
      setIsSituationModalOpen(false);
      setIsStockModalOpen(false);
    }
  }, [battleState, battleAbilities]);

  const [playerId] = React.useState(() => {
    const saved = localStorage.getItem('sb_player_id');
    if (saved) return saved;
    const newId = "p_" + Math.random().toString(36).substring(7);
    localStorage.setItem('sb_player_id', newId);
    return newId;
  });

  const handleStartMatch = (mode: 'player' | 'cpu' | 'room', options?: Record<string, string | number | boolean>) => {
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
      } else if (mode === 'room') {
        const roomId = options?.roomId as string;
        sendMessage({ type: "join_double_private_room", info: { ...commonInfo, room_id: roomId || "" } });
      }
    } else {
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
      } else if (mode === 'room') {
        const roomId = options?.roomId as string;
        sendMessage({ type: "join_private_room", info: { ...commonInfo, room_id: roomId || "" } });
      }
    }

    // 即座にバトル画面（待機状態）へ遷移
    setIsLobby(false);
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
    // 即座にバトル画面（待機状態）へ遷移
    setIsLobby(false);
  };

  const handleOpenAbility = (index: number = 0) => {
    setTargetAbilityIndex(index);
    setIsAbilityModalOpen(true);
  };

  const handleSelectAbility = (abilityId: string) => {
    if (isLobby) {
      const newAbilities = [...selectedAbilities];
      newAbilities[targetAbilityIndex] = abilityId;
      setSelectedAbilities(newAbilities);
      if (targetAbilityIndex === 0) {
        localStorage.setItem('sb_ability', abilityId);
      } else {
        localStorage.setItem('sb_ability_2', abilityId);
      }
    } else if (battleState?.room_id) {
      sendMessage({
        type: 'change_ability',
        info: { 
          room_id: battleState.room_id, 
          player_id: playerId, 
          ability_id: abilityId,
          char_id: targetAbilityIndex === 0 ? allyId : foeId
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
    clearPrediction();
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
        {isLobby ? (
          <LobbyView 
            onStartMatch={handleStartMatch}
            onOpenAbilityModal={handleOpenAbility}
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
              onOpenAbility={() => handleOpenAbility(0)}
              onRunAway={handleRunAway}
            />

            {showResultButton && (
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
          currentAbilityId={
            !isLobby 
              ? (targetAbilityIndex === 0 ? ally?.ability : foe?.ability) || selectedAbilities[targetAbilityIndex]
              : selectedAbilities[targetAbilityIndex]
          }
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
