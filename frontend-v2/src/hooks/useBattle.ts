import { useState, useRef, useEffect } from 'react';
import type { BattleResponse, BattleState } from '../types/battle';
import { SoundManager } from '../utils/SoundManager';
import * as wanakana from 'wanakana';

import { useBattleSocket } from './battle/useBattleSocket';
import { useBattleState } from './battle/useBattleState';
import { useBattleTimer } from './battle/useBattleTimer';
import { useBattleDisplay } from './battle/useBattleDisplay';
import { useBattleSequence } from './battle/useBattleSequence';

export const useBattle = (url: string, onRoomError?: () => void) => {
  // --- Sub-hooks ---
  const {
    battleState, setBattleState, battleStateRef,
    allAbilities, setAllAbilities,
    uiMapping, updateUiMapping,
    getAlly, getFoe, getAllyId, getFoeId,
    getAllies, getFoes, getAllyIds, getFoeIds,
    reset: resetState
  } = useBattleState();

  const display = useBattleDisplay();
  const { timer, resetTimer } = useBattleTimer(battleState?.status === 'finished', !!battleState?.is_cpu);
  const soundManager = SoundManager.getInstance();
  const { playSequence } = useBattleSequence(setBattleState, display, allAbilities);

  const messageQueue = useRef<BattleResponse[]>([]);
  const isHandlingQueue = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const currentRoomIdRef = useRef<string | null>(null);

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
  };

  // --- WebSocket Handler ---
  function onMessage(data: BattleResponse) {
    console.log(`Received message type: ${data.type}`);

    if (data.type === 'pre_check') {
      display.setPrediction({
        include: data.include ?? false,
        used: data.used ?? false,
        type1: data.type1,
        type2: data.type2,
        prediction: data.prediction,
        predictions: data.predictions
      });
      return;
    }

    if (data.type === 'error') {
      const msg = data.message || 'エラーが発生しました';
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
      display.setMessageLog({ text: data.message || 'マッチング中...', isOpen: true });
      return;
    }

    if (data.type === 'private_room_created') {
      const roomId = data.room_id;
      display.setMessageLog({ text: `ルームID: ${roomId}\n相手を待っています…`, isOpen: true });
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

    if (['accepted', 'made_room', 'update', 'battle_end', 'timeout'].includes(data.type)) {
      if (!data.state) return;
      if (data.type === 'accepted' || data.type === 'made_room') {
        currentRoomIdRef.current = data.state.room_id;
      } else {
        // 現在のルームIDと異なるメッセージは無視する
        if (!currentRoomIdRef.current || data.state?.room_id !== currentRoomIdRef.current) {
          console.warn(`Ignoring message for old room: ${data.state?.room_id} (current: ${currentRoomIdRef.current})`);
          return;
        }
      }

      if (data.type === 'update' && data.events?.some(e => e.type === 'ability_changed')) {
        handleBattleUpdate(data, true);
        if (data.events.length === 1) return;
      }

      messageQueue.current.push(data);
      processQueue();
    }
  }

  // --- Queue Processing ---
  async function processQueue() {
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
  }

  // --- Battle Logic (The Core) ---
  async function handleBattleUpdate(data: BattleResponse, isInterrupt: boolean = false) {
    if (!data.state) return;

    const checkAbort = () => {
      if (!currentRoomIdRef.current || data.state.room_id !== currentRoomIdRef.current) return true;
      return false;
    };

    try {
      if (data.all_abilities) setAllAbilities(data.all_abilities);
      if (data.info?.id_to_ui_map) updateUiMapping(data.info.id_to_ui_map);

      if (checkAbort()) return;

      const prevState = battleStateRef.current || data.state;
      const isInitialBattle = (data.type === 'made_room' || data.type === 'accepted') && !battleStateRef.current;

      const events = data.events || [];
      const isTimeout = events.some(e => e.message?.includes('時間切れ'));
      const attackerSide = prevState.is_my_turn ? 'ally' : 'foe';

      const uiMap = data.info?.id_to_ui_map || {};
      const isDouble = Object.keys(uiMap).length > 2;
      
      let attackerId = events.find(e => e.attacker && data.state.characters[e.attacker])?.attacker
        || data.state.last_actor_id
        || events.find(e => (
          e.target
          && data.state.characters[e.target]
          && ['cure'].includes(e.type)
        ))?.target;

      // フォールバックロジックの修正
      if (!attackerId || !data.state.characters[attackerId]) {
        if (!isDouble) {
          // シングルバトルの場合のみ、サイド情報から特定を試みる
          attackerId = Object.keys(uiMap).find(id => uiMap[id]?.startsWith(attackerSide)) || null;
        } else {
          // ダブルバトルの場合は、特定できないなら無理にアタッカーを決めない
          attackerId = null;
        }
      }

      // 1. Initial State Sync
      const initialVisualState: BattleState = {
        ...data.state,
        characters: { ...data.state.characters },
        status: 'active'
      };

      if (!isInitialBattle) {
        Object.keys(initialVisualState.characters).forEach(id => {
          if (prevState.characters[id]) {
            const isAttacker = id === attackerId;
            initialVisualState.characters[id] = { 
              ...initialVisualState.characters[id],
              hp: prevState.characters[id].hp,
              // アタッカーのみ、単語送信と同時に決定したタイプを表示する
              types: isAttacker ? [...initialVisualState.characters[id].types] : [...prevState.characters[id].types],
              attack_rank: prevState.characters[id].attack_rank,
              defense_rank: prevState.characters[id].defense_rank,
              lives: prevState.characters[id].lives,
              word: prevState.characters[id].word,
              is_poison: prevState.characters[id].is_poison
            };
          }
        });
      }

      setBattleState(initialVisualState);
      battleStateRef.current = initialVisualState;

      // 2. Matching Animation
      if (isInitialBattle) {
        resetTimer(data.info?.time_limit || 20, data.info?.total_time || 20);
        display.resetDisplay();
        display.setMessageLog({ text: 'マッチングした！', isOpen: true });
        soundManager.stopBGM();
        soundManager.play('start');
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (checkAbort()) return;
        soundManager.playBGM('/resource/overflow.mp3');
        data.state.word = "";
      }

      if (data.state.word && !isTimeout) {
        display.clearPrediction();
        display.setMessageLog({ text: '', isOpen: true });

        // 単語を特定のキャラクターに紐付ける
        if (attackerId && data.state.characters[attackerId]) {
          // initialVisualState に単語をセット (後続の処理用)
          if (initialVisualState.characters[attackerId]) {
            initialVisualState.characters[attackerId].word = data.state.word;
          }

          // 画面上の状態を更新 (単語とタイプを即時反映)
          setBattleState(prev => {
            if (!prev || !attackerId || !prev.characters[attackerId]) return prev;
            return {
              ...prev,
              characters: {
                ...prev.characters,
                [attackerId]: { 
                  ...prev.characters[attackerId], 
                  word: data.state.word,
                  types: [...data.state.characters[attackerId].types]
                }
              }
            };
          });
        }

        const attackerState = data.state.characters[attackerId || ''];
        if (attackerState?.types?.[0]) soundManager.playType(attackerState.types[0]);
      }



      if (!isInterrupt && !isInitialBattle && (data.state.is_my_turn !== prevState?.is_my_turn)) {
        resetTimer(data.info?.time_limit || 20, data.info?.total_time || 20);
      }

      // 5. Delay before starting events
      const isAbilityChangeOnly = events.length === 1 && events[0].type === 'ability_changed';
      if (data.state.word && !isAbilityChangeOnly && !isTimeout) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (checkAbort()) return;
      }

      // 6. Delegate to Animation Engine
      await playSequence(events, data.state, initialVisualState, isInitialBattle, checkAbort);

      // 7. Final Sync & Turn Transition UI
      if (checkAbort()) return;

      const final = battleStateRef.current || data.state;
      if (final.status !== 'finished') {
        display.setWaitMessage(final.is_my_turn ? 'あなたのターンです。' : '相手のターンです。');
        if (!final.is_my_turn) display.setMessageLog({ text: '', isOpen: true });
        else display.setMessageLog({ text: null, isOpen: false });
      } else {
        display.setWaitMessage(null);
      }
    } catch (err) {
      console.error('Error in handleBattleUpdate:', err);
    }
  }

  const { isConnected, sendMessage } = useBattleSocket(url, onMessage);

  useEffect(() => {
    if (battleState?.status === 'finished') {
      soundManager.stopBGM();
      soundManager.play('end');
    }
  }, [battleState?.status, soundManager]);

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
    sendMessage({
      type: url.includes('/double') ? 'include_check_double' : 'include_check',
      info: { word, room_id: current.room_id }
    });
  };

  return {
    battleState,
    allAbilities,
    isConnected,
    isProcessing,
    sendMessage,
    sendIncludeCheck,
    startMatching,
    ally: getAlly(battleState, uiMapping),
    foe: getFoe(battleState, uiMapping),
    allies: getAllies(battleState, uiMapping),
    foes: getFoes(battleState, uiMapping),
    allyId: getAllyId(uiMapping),
    foeId: getFoeId(uiMapping),
    allyIds: getAllyIds(uiMapping),
    foeIds: getFoeIds(uiMapping),
    ...display,
    timer,
    resetBattle
  };
};
