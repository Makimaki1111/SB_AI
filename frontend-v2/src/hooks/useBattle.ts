import { useState, useRef, useEffect } from 'react';
import type { BattleResponse, BattleState } from '../types/battle';
import { SoundManager } from '../utils/SoundManager';
import * as wanakana from 'wanakana';

import { useBattleSocket } from './battle/useBattleSocket';
import { useBattleState } from './battle/useBattleState';
import { useBattleTimer } from './battle/useBattleTimer';
import { useBattleDisplay } from './battle/useBattleDisplay';

export const useBattle = (url: string, onRoomError?: () => void) => {
  // --- Sub-hooks ---
  const { 
    battleState, setBattleState, battleStateRef, 
    allAbilities, setAllAbilities, 
    uiMapping, updateUiMapping, uiMappingRef,
    getAlly, getFoe, getAllyId, getFoeId 
  } = useBattleState();

  const display = useBattleDisplay();
  const { timer, resetTimer } = useBattleTimer(battleState?.status === 'finished', !!battleState?.is_cpu);
  const soundManager = SoundManager.getInstance();

  const messageQueue = useRef<BattleResponse[]>([]);
  const isHandlingQueue = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const startMatching = () => {
    display.resetDisplay();
    display.setMessageLog({ text: 'マッチング待機中...', isOpen: true });
  };

  const resetBattle = () => {
    setBattleState(null);
    battleStateRef.current = null;
    display.resetDisplay();
  };

  // --- WebSocket Handler ---
  const onMessage = (data: BattleResponse) => {
    console.log(`Received message type: ${data.type}`);

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

    if (data.type === 'private_room_created') {
      const roomId = (data as any).room_id;
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
      if (data.type === 'update' && data.events?.some(e => e.type === 'ability_changed')) {
        handleBattleUpdate(data, true);
        if (data.events.length === 1) return;
      }
      
      messageQueue.current.push(data);
      processQueue();
    }
  };

  const { isConnected, sendMessage } = useBattleSocket(url, onMessage);

  // --- Queue Processing ---
  const processQueue = async () => {
    if (isHandlingQueue.current || messageQueue.current.length === 0) return;
    isHandlingQueue.current = true;
    setIsProcessing(true);

    while (messageQueue.current.length > 0) {
      const data = messageQueue.current.shift();
      if (data) {
        await handleBattleUpdate(data);
      }
    }

    setIsProcessing(false);
    isHandlingQueue.current = false;
  };

  // --- Battle Logic (The Core) ---
  const handleBattleUpdate = async (data: BattleResponse, isInterrupt: boolean = false) => {
    try {
      if (data.all_abilities) setAllAbilities(data.all_abilities);
      if (data.info?.id_to_ui_map) updateUiMapping(data.info.id_to_ui_map);

      const prevState = battleStateRef.current || data.state;
      const isInitialBattle = (data.type === 'made_room' || data.type === 'accepted') && !battleStateRef.current;

      // 1. Initial State Sync (Do this immediately to show UI elements)
      const initialVisualState: BattleState = {
        ...data.state,
        characters: { ...data.state.characters },
        status: 'active'
      };

      // Keep old HP for damage animation (only if not initial battle)
      if (!isInitialBattle) {
        Object.keys(initialVisualState.characters).forEach(id => {
          if (prevState.characters[id]) {
            initialVisualState.characters[id].hp = prevState.characters[id].hp;
          }
        });
      }

      setBattleState(initialVisualState);
      battleStateRef.current = initialVisualState;

      // 2. Matching Animation (Delayed BGM transition)
      if (isInitialBattle) {
        display.resetDisplay();
        display.setMessageLog({ text: 'マッチングした！', isOpen: true });
        soundManager.stopBGM();
        soundManager.play('start');
        // Legacy uses 1500ms
        await new Promise(resolve => setTimeout(resolve, 1500));
        soundManager.playBGM('/resource/overflow.mp3');
        // Initial battle doesn't have a word to read, so we can skip the next word delay
        data.state.word = ""; 
      }

      // 3. Pre-effect updates (Word submission display etc)
      const isTimeout = data.events?.some(e => e.message?.includes('時間切れ'));
      
      if (data.state.word && !isTimeout) {
        display.clearPrediction();
        display.setMessageLog({ text: '', isOpen: true });
        
        if (prevState.is_my_turn) display.setAllyWord(data.state.word);
        else display.setFoeWord(data.state.word);

        const attackerSide = prevState.is_my_turn ? 'ally' : 'foe';
        const attackerId = Object.keys(data.info?.id_to_ui_map || {}).find(id => data.info?.id_to_ui_map[id] === attackerSide);
        const attackerState = data.state.characters[attackerId || ''];
        if (attackerState?.types?.[0]) soundManager.playType(attackerState.types[0]);
      }

      let tempCharacters = { ...initialVisualState.characters };

      // 4. Timer Sync
      if (data.state.is_my_turn !== (prevState?.is_my_turn) || isInitialBattle) {
        resetTimer(data.info?.time_limit || 20, data.info?.total_time || 20);
      }

      const events = data.events || [];
      const currentUiMap = data.info?.id_to_ui_map || uiMappingRef.current;
      const allyId = getAllyId(currentUiMap);
      const foeId = getFoeId(currentUiMap);

      // 5. Initial delay for word reading
      const isAbilityChangeOnly = events.length === 1 && events[0].type === 'ability_changed';
      if (data.state.word && !isAbilityChangeOnly && !isTimeout) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 6. Event Processing Loop
      for (const event of events) {
        const targetSide = event.target === allyId ? 'ally' : event.target === foeId ? 'foe' : null;
        const targetId = event.target;

        // Logic by Event Type (Sound is now handled via playEventSound)
        if (!isInitialBattle) {
          soundManager.playEventSound(event.type, event.message || '');
        }

        if (event.type === 'ability_changed') {
          display.setMessageLog({ text: null, isOpen: false });
          display.showNotification('特性が変わった！');
        }

        if (event.type !== 'ability_changed') {
          display.setMessageLog({ text: event.message || null, isOpen: true });
        }

        if (event.type === 'damage' || event.type === 'drain') {
          const msg = event.message || '';
          // 毒ダメージのときは点滅させない (本家仕様)
          if (!msg.includes('毒のダメージ')) {
            if (targetSide === 'ally') display.setAllyEffect('blink');
            else if (targetSide === 'foe') display.setFoeEffect('blink');
          }
          
          if (event.type === 'damage' && (msg.includes('はたおれた！') || msg.includes('力尽きた'))) {
            if (targetId) display.setKnockoutStates(prev => ({ ...prev, [targetId]: true }));
          }
          if (targetId && tempCharacters[targetId] && event.hp !== undefined && event.hp !== null) {
            tempCharacters[targetId].hp = event.hp;
            setBattleState(prev => prev ? { ...prev, characters: { ...tempCharacters } } : null);
          }
          if (event.type === 'drain' && event.attacker) {
            const attackerSide = event.attacker === allyId ? 'ally' : event.attacker === foeId ? 'foe' : null;
            if (attackerSide === 'ally') display.setAllyEffect('heal');
            else if (attackerSide === 'foe') display.setFoeEffect('heal');
            const eventAny = event as any;
            if (eventAny.attacker_hp !== undefined && eventAny.attacker_hp !== null) {
              tempCharacters[event.attacker].hp = eventAny.attacker_hp;
              setBattleState(prev => prev ? { ...prev, characters: { ...tempCharacters } } : null);
            }
          }
          if (!isInitialBattle) await new Promise(resolve => setTimeout(resolve, 1000));
          display.setAllyEffect(null);
          display.setFoeEffect(null);
        } else if (event.type === 'cure') {
          if (targetSide === 'ally') display.setAllyEffect('heal');
          else if (targetSide === 'foe') display.setFoeEffect('heal');
          if (targetId && tempCharacters[targetId] && event.hp !== undefined && event.hp !== null) {
            tempCharacters[targetId].hp = event.hp;
            setBattleState(prev => prev ? { ...prev, characters: { ...tempCharacters } } : null);
          }
          if (!isInitialBattle) await new Promise(resolve => setTimeout(resolve, 1000));
          display.setAllyEffect(null);
          display.setFoeEffect(null);
        } else if (event.type === 'revive') {
          if (targetId) {
            display.setKnockoutStates(prev => ({ ...prev, [targetId]: false }));
            if (tempCharacters[targetId] && event.hp !== undefined) {
              tempCharacters[targetId].hp = event.hp;
              setBattleState(prev => prev ? { ...prev, characters: { ...tempCharacters } } : null);
            }
          }
          if (!isInitialBattle) await new Promise(resolve => setTimeout(resolve, 1000));
        } else if (event.type === 'stat_up' || event.type === 'stat_down') {
          const effect = event.type === 'stat_up' ? 'up' : 'down';
          if (targetSide === 'ally') display.setAllyEffect(effect);
          else if (targetSide === 'foe') display.setFoeEffect(effect);
          if (targetId && tempCharacters[targetId] && event.new_rank !== undefined && event.new_rank !== null) {
            const field = event.stat_type === 'defense' ? 'defense_rank' : 'attack_rank';
            (tempCharacters[targetId] as any)[field] = event.new_rank;
            setBattleState(prev => prev ? { ...prev, characters: { ...tempCharacters } } : null);
          }
          if (!isInitialBattle) await new Promise(resolve => setTimeout(resolve, 1000));
          display.setAllyEffect(null);
          display.setFoeEffect(null);
        } else if (event.type === 'ability_changed') {
          if (targetId && tempCharacters[targetId] && event.new_ability) {
            tempCharacters[targetId].ability = event.new_ability;
            tempCharacters[targetId].ability_change_count = event.new_ability_change_count ?? tempCharacters[targetId].ability_change_count;
            setBattleState(prev => prev ? { ...prev, characters: { ...tempCharacters } } : null);
          }
          if (!isInterrupt && !isInitialBattle) await new Promise(resolve => setTimeout(resolve, 100));
        } else if (event.type === 'battle_result') {
          display.setShowResultButton(true);
          if (!isInitialBattle) await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          if (!isInitialBattle) await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // 7. Finalize State
      const mergedChars = { ...data.state.characters };
      const lastVisual = battleStateRef.current;
      if (lastVisual) {
        for (const id in mergedChars) {
          if (lastVisual.characters[id] && lastVisual.characters[id].ability_change_count < mergedChars[id].ability_change_count) {
            mergedChars[id].ability = lastVisual.characters[id].ability;
            mergedChars[id].ability_change_count = lastVisual.characters[id].ability_change_count;
          }
        }
      }
      const final: BattleState = { ...data.state, characters: mergedChars };
      setBattleState(final);
      battleStateRef.current = final;

      // 8. Turn Transition UI
      if (final.status !== 'finished') {
        display.setWaitMessage(final.is_my_turn ? 'あなたのターンです。' : '相手のターンです。');
        resetTimer(20, 20);
        if (!final.is_my_turn) display.setMessageLog({ text: '相手のターンです。', isOpen: true });
        else display.setMessageLog({ text: null, isOpen: false });
      } else {
        display.setWaitMessage(null);
      }
    } catch (err) {
      console.error('Error in handleBattleUpdate:', err);
    }
  };

  useEffect(() => {
    if (battleState?.status === 'finished') {
      soundManager.stopBGM();
      soundManager.play('end');
    }
  }, [battleState?.status]);

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
    allyId: getAllyId(uiMapping),
    foeId: getFoeId(uiMapping),
    ...display,
    timer,
    resetBattle
  };
};
