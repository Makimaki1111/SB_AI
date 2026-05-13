import React from 'react';
import { useBattle } from '../hooks/useBattle';
import { useUser } from '../context/useUser';
import { LobbyView } from '../components/lobby/LobbyView';
import { AbilityModal } from '../components/modals/AbilityModal';
import { SingleBattleArena } from '../components/battle/single/SingleBattleArena';
import { DoubleBattleArena } from '../components/battle/double/DoubleBattleArena';
import SoundManager from '../utils/SoundManager';

import { GameLayout } from '../components/layout/GameLayout';
import { SituationModal } from '../components/modals/SituationModal';
import { StockSelectionModal } from '../components/modals/StockSelectionModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { GameButton } from '../components/common/GameButton';
import { API_BASE_URL, WS_BASE_URL, WS_DOUBLE_BASE_URL } from '../constants/game';
import type { AbilityData } from '../types/battle';
import styles from './BattleView.module.css';

import { useNavigate, useLocation } from 'react-router-dom';

export const BattleView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isDouble = location.pathname.includes('double') || location.search.includes('mode=double');
  const isStock = location.search.includes('mode=stock');
  const { username } = useUser();

  const [isLobby, setIsLobby] = React.useState(true);
  const [isAbilityModalOpen, setIsAbilityModalOpen] = React.useState(false);
  const [targetAbilityIndex, setTargetAbilityIndex] = React.useState(0);
  const [isSituationModalOpen, setIsSituationModalOpen] = React.useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = React.useState(false);
  const [isRunAwayConfirmOpen, setIsRunAwayConfirmOpen] = React.useState(false);
  const [pendingMatchMode, setPendingMatchMode] = React.useState<'cpu' | 'room' | null>(null);
  const lastRoomIdRef = React.useRef<string | null>(null);

  const dynamicWsUrl = React.useMemo(() => {
    return isDouble ? WS_DOUBLE_BASE_URL : WS_BASE_URL;
  }, [isDouble]);

  const {
    ally,
    foe,
    allies,
    foes,
    battleState,
    isConnected,
    prediction,
    messageLog,
    notification,
    waitMessage,
    isProcessing,
    timer,
    knockoutStates,
    allyId,
    foeId,
    showResultButton,
    activeEffects,
    allAbilities: battleAbilities,
    sendMessage,
    sendIncludeCheck,
    startMatching,
    resetBattle
  } = useBattle(dynamicWsUrl, () => setIsLobby(true));

  const [selectedAbilities, setSelectedAbilities] = React.useState<string[]>(() => {
    const a1 = localStorage.getItem('sb_ability') || 'ikaku';
    const a2 = localStorage.getItem('sb_ability_2') || 'ikaku';
    return [a1, a2];
  });

  const [fetchedAbilities, setFetchedAbilities] = React.useState<Record<string, AbilityData>>({});
  const allAbilities = React.useMemo(() => {
    return Object.keys(battleAbilities).length > 0 ? battleAbilities : fetchedAbilities;
  }, [battleAbilities, fetchedAbilities]);

  const selectedBattleCharacter = isDouble ? allies[targetAbilityIndex] : ally;
  const selectedBattleAbilityId = selectedBattleCharacter?.ability || selectedAbilities[targetAbilityIndex] || selectedAbilities[0];
  const canChangeAbility = isLobby || (selectedBattleCharacter?.ability_change_count ?? 0) > 0;

  React.useEffect(() => {
    fetch(`${API_BASE_URL}/abilities`)
      .then(res => res.json())
      .then(data => setFetchedAbilities(data))
      .catch(err => console.error("Failed to fetch abilities:", err));
  }, []);

  React.useEffect(() => {
    if (battleState && battleState.room_id !== lastRoomIdRef.current) {
      // マッチング完了（新しいルームに入った）時のみ状態整理
      setIsAbilityModalOpen(false);
      setIsSituationModalOpen(false);
      setIsStockModalOpen(false);
      lastRoomIdRef.current = battleState.room_id;
    }
  }, [battleState]);

  const [playerId] = React.useState(() => {
    const saved = localStorage.getItem('sb_player_id');
    if (saved) return saved;
    const newId = "p_" + Math.random().toString(36).substring(7);
    localStorage.setItem('sb_player_id', newId);
    return newId;
  });

  const handleStartMatch = (mode: 'player' | 'cpu' | 'room', options?: Record<string, string | number | boolean>) => {
    // ストックモードかつルーム作成の場合はまず残機設定モーダルを開く
    // CPU戦は固定設定にするためモーダルを開かない
    // ※参加ボタン（optionsにroomIdキーがある場合）はIDの有無に関わらずモーダルを開かない
    const isJoinAction = options && 'roomId' in options;
    if (isStock && !isJoinAction && mode === 'room') {
      SoundManager.play('pera'); // モーダルを開く場合は音を鳴らす
      setPendingMatchMode(mode);
      setIsStockModalOpen(true);
      return;
    }

    const commonInfo = {
      player_id: playerId,
      name: username || "ななし",
      ability: selectedAbilities[0],
      ability_2: isDouble ? selectedAbilities[1] : "",
      ally_max_lives: isStock ? 2 : 1,
      foe_max_lives: isStock ? 2 : 1
    };

    // ルームIDの有無で作成か参加かを判別
    const roomIdInput = options?.roomId as string | undefined;

    if (mode === 'room') {
      if (isJoinAction) {
        if (!roomIdInput || roomIdInput.trim() === '') {
          // 参加ボタンなのにIDが空なら何もしない
          console.log("Room ID is empty, join canceled.");
          return;
        }
        // ルーム参加
        sendMessage({
          type: isDouble ? "join_double_room" : "join_private_room",
          info: { ...commonInfo, room_id: roomIdInput.trim() }
        });
      } else {
        // ルーム作成
        sendMessage({
          type: isDouble ? "create_double_room" : "create_private_room",
          info: { ...commonInfo, p1_max_lives: commonInfo.ally_max_lives, p2_max_lives: commonInfo.foe_max_lives }
        });
      }
    } else if (mode === 'cpu') {
      sendMessage({
        type: isDouble ? "join_double_cpu_room" : "make_new_battle",
        info: { ...commonInfo, player1_id: playerId, player2_id: "cpu_1" }
      });
    } else if (mode === 'player') {
      sendMessage({
        type: isDouble ? "find_match_double" : "find_match",
        info: { ...commonInfo, max_lives: commonInfo.ally_max_lives }
      });
    }

    // 待機画面へ遷移
    startMatching();
    setIsLobby(false);
  };

  const handleConfirmStockMatch = (allyStock: number, foeStock: number) => {
    setIsStockModalOpen(false);

    const commonInfo = {
      player_id: playerId,
      name: username || "ななし",
      ability: selectedAbilities[0],
      ability_2: "",
      ally_max_lives: allyStock,
      foe_max_lives: foeStock
    };


    if (pendingMatchMode === 'room') {
      sendMessage({
        type: isDouble ? "create_double_room" : "create_private_room",
        info: { ...commonInfo, p1_max_lives: allyStock, p2_max_lives: foeStock }
      });
    } else {
      sendMessage({
        type: isDouble ? "join_double_cpu_room" : "make_new_battle",
        info: { ...commonInfo, player1_id: playerId, player2_id: "cpu_1" }
      });
    }

    // すべての対戦モードで待機画面へ遷移
    startMatching();
    setIsLobby(false);
    setPendingMatchMode(null);
  };

  const handleOpenAbility = (index: number = 0) => {
    SoundManager.play('pera');
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
      const charId = selectedBattleCharacter?.id;
      if (isDouble && !charId) return;

      sendMessage({
        type: isDouble ? 'change_ability_double' : 'change_ability',
        info: {
          room_id: battleState.room_id,
          player_id: playerId,
          ability_id: abilityId,
          char_id: isDouble ? charId : undefined
        }
      });
    }

    setIsAbilityModalOpen(false);
  };

  const handleRunAway = () => {
    SoundManager.play('pera');
    setIsRunAwayConfirmOpen(true);
  };

  const confirmRunAway = () => {
    if (battleState?.room_id) {
      sendMessage({
        type: isDouble ? 'run_away_double' : 'run_away',
        info: { room_id: battleState.room_id, player_id: playerId }
      });
    }
    // ロビーに戻る
    SoundManager.playBGM('/resource/horizon.mp3');
    resetBattle();
    setIsLobby(true);
    setIsRunAwayConfirmOpen(false);
  };

  const handleSubmitWord = (word: string, targetId: string | null = null) => {
    if (!battleState?.room_id) return;
    sendMessage({
      type: isDouble ? 'submit_word_double' : 'submit_word',
      info: { word, room_id: battleState.room_id, player_id: playerId, target_id: targetId || undefined }
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
            {isDouble ? (
              <DoubleBattleArena
                battleState={battleState}
                allies={allies}
                foes={foes}
                prediction={prediction}
                messageLog={messageLog}
                notification={notification}
                waitMessage={waitMessage}
                isProcessing={isProcessing}
                timer={timer}
                knockoutStates={knockoutStates}
                activeEffects={activeEffects}
                onSendWord={handleSubmitWord}
                onSendIncludeCheck={sendIncludeCheck}
                onOpenSituation={() => setIsSituationModalOpen(true)}
                onOpenAbility={handleOpenAbility}
                onRunAway={handleRunAway}
              />
            ) : (
              <SingleBattleArena
                battleState={battleState}
                prediction={prediction}
                messageLog={messageLog}
                notification={notification}
                waitMessage={waitMessage}
                isProcessing={isProcessing}
                timer={timer}
                knockoutStates={knockoutStates}
                activeEffects={activeEffects}
                allyId={allyId}
                foeId={foeId}
                username={username || "ななし"}
                onSendWord={handleSubmitWord}
                onSendIncludeCheck={sendIncludeCheck}
                onOpenSituation={() => setIsSituationModalOpen(true)}
                onOpenAbility={() => handleOpenAbility(0)}
                onRunAway={handleRunAway}
              />
            )}

            {showResultButton && (
              <div className={styles.simpleResultArea}>
                <GameButton
                  variant="orange"
                  className={styles.lobbyReturnBtn}
                  onClick={() => {
                    SoundManager.playBGM('/resource/horizon.mp3');
                    resetBattle();
                    setIsLobby(true);
                  }}
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
          allies={isDouble ? allies : undefined}
          foes={isDouble ? foes : undefined}
          battleState={battleState}
        />

        <AbilityModal
          isOpen={isAbilityModalOpen}
          onClose={() => setIsAbilityModalOpen(false)}
          onSelect={handleSelectAbility}
          currentAbilityId={
            !isLobby
              ? selectedBattleAbilityId
              : selectedAbilities[targetAbilityIndex]
          }
          allyAbilityId={selectedBattleAbilityId || ''}
          allAbilities={allAbilities}
          canChange={canChangeAbility}
          abilityChangeCount={selectedBattleCharacter?.ability_change_count ?? 0}
          isLobby={isLobby}

          allies={isDouble ? allies : undefined}
          targetAbilityIndex={targetAbilityIndex}
          setTargetAbilityIndex={setTargetAbilityIndex}
        />

        <ConfirmModal
          isOpen={isRunAwayConfirmOpen}
          onClose={() => setIsRunAwayConfirmOpen(false)}
          onConfirm={confirmRunAway}
          message="本当に逃げますか？"
        />
      </div>
    </GameLayout>
  );
};
