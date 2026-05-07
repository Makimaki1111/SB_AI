import { useState, useRef } from 'react';
import type { BattleResponse, BattleState } from '../types/battle';
import SoundManager from '../utils/SoundManager';
import * as wanakana from 'wanakana';

import { useBattleSocket } from './battle/useBattleSocket';
import { useDoubleBattleState } from './battle/useDoubleBattleState';
import { useBattleTimer } from './battle/useBattleTimer';
import { useDoubleBattleDisplay } from './battle/useDoubleBattleDisplay';

export const useDoubleBattle = (url: string, onRoomError?: () => void) => {
  // --- Sub-hooks ---
  const {
    battleState, setBattleState, battleStateRef,
    allAbilities, setAllAbilities,
    updateUiMapping, uiMapping,
    getAllyTeam, getFoeTeam, getTeamIds,
    reset: resetState
  } = useDoubleBattleState();

  const display = useDoubleBattleDisplay();
  const { timer, resetTimer } = useBattleTimer(battleState?.status === 'finished', !!battleState?.is_cpu);
  const soundManager = SoundManager.getInstance();

  const messageQueue = useRef<BattleResponse[]>([]);
  const isHandlingQueue = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const currentRoomIdRef = useRef<string | null>(null);

  // ダブルバトル固有の状態
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  const startMatching = () => {
    currentRoomIdRef.current = null;
    messageQueue.current = [];
    display.resetDisplay();
    display.setMessageLog({ text: '', isOpen: true });
  };

  const resetBattle = () => {
    currentRoomIdRef.current = null;
    resetState();
    messageQueue.current = [];
    isHandlingQueue.current = false;
    setIsProcessing(false);
    display.resetDisplay();
    setSelectedTargetId(null);
  };

  // --- WebSocket Handler ---
  const onMessage = (data: BattleResponse) => {
    console.log(`[Double] Received message type: ${data.type}`);

    if (data.type === 'pre_check') {
      const d = data as any;
      display.setPrediction({
        include: d.include ?? false,
        used: d.used ?? false,
        type1: d.type1,
        type2: d.type2,
        prediction: d.prediction,
        predictions: d.predictions
      });
      return;
    }

    if (data.type === 'error') {
      const msg = (data as any).message || 'エラーが発生しました';
      display.setWaitMessage(msg);
      if (msg.includes('ルームが見つかりません') || msg.includes('不明です')) {
        setTimeout(() => {
          display.setWaitMessage(null);
          onRoomError?.();
        }, 1500);
      } else {
        setTimeout(() => display.setWaitMessage(null), 2000);
      }
      return;
    }

    if (data.type === 'waiting') {
      display.setMessageLog({ text: (data as any).message || 'マッチング中...', isOpen: true });
      return;
    }

    if (data.type === 'double_room_created') {
      const roomId = (data as any).room_id;
      display.setMessageLog({ text: `ルームID: ${roomId}\n相手を待っています…`, isOpen: true });
      currentRoomIdRef.current = roomId;
      return;
    }

    if (data.type === 'opponent_disconnected') {
      soundManager.play('end');
      display.setWaitMessage('あいてが切断しました');
      display.setShowResultButton(true);
      display.setMessageLog({ text: null, isOpen: false });
      setBattleState(prev => prev ? { ...prev, status: 'finished' } : null);
      return;
    }

    // ダブルバトルでは init_double_battle, turn_result などが来る
    if (['accepted', 'init_double_battle', 'turn_result', 'timeout'].includes(data.type)) {
      if (data.type === 'accepted' || data.type === 'init_double_battle') {
        currentRoomIdRef.current = data.state.room_id;
      } else {
        if (!currentRoomIdRef.current || data.state?.room_id !== currentRoomIdRef.current) {
          console.warn(`Ignoring message for old room: ${data.state?.room_id}`);
          return;
        }
      }

      // 特性変更のみの割り込み処理
      const isOnlyAbilityChange = data.type === 'turn_result' && data.events?.every(ev => ev.type === "ability_changed");
      if (isOnlyAbilityChange) {
        handleBattleUpdate(data, true);
        if (data.events!.length === 1) return;
      }

      messageQueue.current.push(data);
      processQueue();
    }
  };

  const { isConnected, sendMessage } = useBattleSocket(`${url}/double`, onMessage);

  // --- Queue Processing ---
  const processQueue = async () => {
    if (isHandlingQueue.current || messageQueue.current.length === 0) return;
    isHandlingQueue.current = true;
    setIsProcessing(true);

    while (messageQueue.current.length > 0) {
      const data = messageQueue.current.shift();
      if (data) {
        await handleBattleUpdate(data);
        if (!currentRoomIdRef.current) {
          messageQueue.current = [];
          break;
        }
      }
    }

    setIsProcessing(false);
    isHandlingQueue.current = false;
  };

  // --- Battle Logic ---
  const handleBattleUpdate = async (data: BattleResponse, isInterrupt: boolean = false) => {
    const checkAbort = () => !currentRoomIdRef.current || data.state.room_id !== currentRoomIdRef.current;

    try {
      if (data.all_abilities) setAllAbilities(data.all_abilities);
      if (data.info?.id_to_ui_map) updateUiMapping(data.info.id_to_ui_map);

      if (checkAbort()) return;

      const prevState = battleStateRef.current || data.state;
      const isInitialBattle = data.type === 'init_double_battle' && !battleStateRef.current;

      // 1. Initial State Sync
      const initialVisualState: BattleState = {
        ...data.state,
        characters: { ...data.state.characters },
        status: 'active'
      };

      if (!isInitialBattle) {
        Object.keys(initialVisualState.characters).forEach(id => {
          if (prevState.characters[id]) {
            initialVisualState.characters[id].hp = prevState.characters[id].hp;
          }
        });
      }

      setBattleState(initialVisualState);
      battleStateRef.current = initialVisualState;

      // 2. Matching Animation
      if (isInitialBattle) {
        resetTimer(data.info?.time_limit || 30, data.info?.total_time || 30);
        display.resetDisplay();
        display.setMessageLog({ text: 'バトルスタート！', isOpen: true });
        soundManager.stopBGM();
        soundManager.play('start');
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (checkAbort()) return;
        soundManager.playBGM('/resource/overflow.mp3');
        data.state.word = "";
      }

      // 3. Turn Display
      const isTimeout = data.events?.some(e => e.message?.includes('時間切れ'));
      if (data.state.word && !isTimeout) {
        display.clearPrediction();
        display.setMessageLog({ text: '', isOpen: true });

        const actorId = data.state.last_actor_id;
        if (actorId) {
          display.setCharacterWord(actorId, data.state.word);
          const actorState = data.state.characters[actorId];
          if (actorState?.types?.[0]) soundManager.playType(actorState.types[0]);
        }
      }

      let tempCharacters = { ...initialVisualState.characters };

      // 4. Timer Sync
      if (!isInterrupt && !isInitialBattle && (data.state.turn !== prevState?.turn)) {
        resetTimer(data.info?.time_limit || 30, data.info?.total_time || 30);
      }

      // 5. Initial delay
      const events = data.events || [];
      const isAbilityChangeOnly = events.length === 1 && events[0].type === 'ability_changed';
      if (data.state.word && !isAbilityChangeOnly && !isTimeout) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (checkAbort()) return;
      }

      // 6. Event Loop
      for (const event of events) {
        const targetId = event.target;
        if (!isInitialBattle) soundManager.playEventSound(event.type, event.message || '');

        if (event.type === 'ability_changed') {
          display.showNotification('特性が変わった！');
        } else {
          display.setMessageLog({ text: event.message || null, isOpen: true });
        }

        if (event.type === 'knockout' && targetId) {
          display.setKnockoutStates(prev => ({ ...prev, [targetId]: true }));
        }

        if (event.type === 'damage' || event.type === 'drain' || event.type === 'cure') {
          const isHeal = event.type === 'cure';
          const effect = isHeal ? 'heal' : 'blink';
          const msg = event.message || '';
          
          if (targetId) {
            if (!msg.includes('毒のダメージ')) display.setCharacterEffect(targetId, effect);
            if (event.hp !== undefined && event.hp !== null) {
              tempCharacters[targetId].hp = event.hp;
              setBattleState(prev => prev ? { ...prev, characters: { ...tempCharacters } } : null);
            }
          }

          if (event.type === 'drain' && event.attacker) {
            display.setCharacterEffect(event.attacker, 'heal');
            const eventAny = event as any;
            if (eventAny.attacker_hp !== undefined && eventAny.attacker_hp !== null) {
              tempCharacters[event.attacker].hp = eventAny.attacker_hp;
              setBattleState(prev => prev ? { ...prev, characters: { ...tempCharacters } } : null);
            }
          }

          if (!isInitialBattle) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (checkAbort()) return;
          }
          if (targetId) display.setCharacterEffect(targetId, null);
          if (event.attacker) display.setCharacterEffect(event.attacker, null);
        } else if (event.type === 'revive' && targetId) {
          display.setKnockoutStates(prev => ({ ...prev, [targetId]: false }));
          if (event.hp !== undefined) {
            tempCharacters[targetId].hp = event.hp;
            setBattleState(prev => prev ? { ...prev, characters: { ...tempCharacters } } : null);
          }
          if (!isInitialBattle) await new Promise(resolve => setTimeout(resolve, 1000));
        } else if (event.type === 'stat_up' || event.type === 'stat_down') {
          if (targetId) {
            display.setCharacterEffect(targetId, event.type === 'stat_up' ? 'up' : 'down');
            if (event.new_rank !== undefined && event.new_rank !== null) {
              const field = event.stat_type === 'defense' ? 'defense_rank' : 'attack_rank';
              (tempCharacters[targetId] as any)[field] = event.new_rank;
              setBattleState(prev => prev ? { ...prev, characters: { ...tempCharacters } } : null);
            }
          }
          if (!isInitialBattle) await new Promise(resolve => setTimeout(resolve, 1000));
          if (targetId) display.setCharacterEffect(targetId, null);
        } else if (event.type === 'ability_changed' && targetId && event.new_ability) {
          tempCharacters[targetId].ability = event.new_ability;
          tempCharacters[targetId].ability_change_count = event.new_ability_change_count ?? tempCharacters[targetId].ability_change_count;
          setBattleState(prev => prev ? { ...prev, characters: { ...tempCharacters } } : null);
          if (!isInterrupt) await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          if (!isInitialBattle) await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (checkAbort()) return;
      }

      // 7. Finalize
      const final: BattleState = { ...data.state };
      setBattleState(final);
      battleStateRef.current = final;

      if (final.status !== 'finished') {
        const actorId = final.current_actor_id;
        const actorName = actorId ? final.characters[actorId]?.name : '誰か';
        display.setWaitMessage(final.is_my_turn ? `あなたのターンです (${actorName})` : `${actorName} のターンです`);
        if (!final.is_my_turn) display.setMessageLog({ text: '', isOpen: true });
        else display.setMessageLog({ text: null, isOpen: false });

        // 自分のターンのとき、生存している敵からターゲットを自動選択
        if (final.is_my_turn) {
          const foeTeam = getTeamIds(data.info?.id_to_ui_map || {}, 'foe');
          const aliveFoes = foeTeam.filter(id => final.characters[id] && final.characters[id].hp > 0);
          if (aliveFoes.length > 0) {
            // 現在のターゲットが無効なら、1体目を選択
            if (!selectedTargetId || !aliveFoes.includes(selectedTargetId)) {
              setSelectedTargetId(aliveFoes[0]);
            }
          }
        }
      } else {
        display.setWaitMessage(null);
        display.setShowResultButton(true);
      }
    } catch (err) {
      console.error('Error in DoubleBattleUpdate:', err);
    }
  };

  const sendIncludeCheck = (word: string) => {
    const current = battleStateRef.current;
    if (!current?.room_id || !word) {
      display.clearPrediction();
      return;
    }
    if (wanakana.toHiragana(word.charAt(0)) !== (current.character || '')) {
      display.clearPrediction();
      return;
    }
    sendMessage({ type: 'include_check', info: { word, room_id: current.room_id } });
  };

  const sendWord = (word: string) => {
    const current = battleStateRef.current;
    if (!current?.room_id || !word) return;
    
    sendMessage({ 
      type: 'submit_word', 
      info: { 
        word, 
        room_id: current.room_id,
        target_id: selectedTargetId // ターゲットIDを含める
      } 
    });
    display.clearPrediction();
  };

  return {
    battleState,
    allAbilities,
    isConnected,
    isProcessing,
    sendMessage,
    sendWord,
    sendIncludeCheck,
    startMatching,
    resetBattle,
    allyTeam: getAllyTeam(battleState, uiMapping),
    foeTeam: getFoeTeam(battleState, uiMapping),
    uiMapping,
    selectedTargetId,
    setSelectedTargetId,
    timer,
    ...display
  };
};
