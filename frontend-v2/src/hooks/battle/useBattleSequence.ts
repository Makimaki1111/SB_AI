import { useState } from 'react';
import type { BattleEvent, BattleState } from '../../types/battle';
import { SoundManager } from '../../utils/SoundManager';

/**
 * 演出エンジン: サーバーからのイベントリストを順番に再生し、
 * 「現在の見た目の状態（Visual State）」を管理する。
 */
export const useBattleSequence = (
  setBattleState: React.Dispatch<React.SetStateAction<BattleState | null>>,
  display: any, // useBattleDisplay の戻り値
  allAbilities: Record<string, any>
) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const soundManager = SoundManager.getInstance();

  /**
   * 複数のイベントを順番に再生するメインループ
   */
  const playSequence = async (
    events: BattleEvent[], 
    finalState: BattleState,
    initialVisualState: BattleState,
    isInitialBattle: boolean,
    checkAbort: () => boolean
  ) => {
    setIsAnimating(true);

    // 現在の画面上のキャラクター状態（演出中に順次更新される）
    let currentTempCharacters = { ...initialVisualState.characters };

    for (const event of events) {
      if (checkAbort()) break;

      const targetId = event.target;
      
      // 1. SEの再生
      if (!isInitialBattle) {
        soundManager.playEventSound(event.type, event.message || '');
      }

      // 2. メッセージログの更新
      if (event.type === 'ability_changed') {
        display.setMessageLog({ text: null, isOpen: false });
      } else {
        display.setMessageLog({ text: event.message || null, isOpen: true });
      }

      // 3. イベントタイプごとの個別演出
      let duration = 1000; // デフォルトの待機時間

      switch (event.type) {
        case 'damage':
        case 'drain':
          const isPoisonDamage = event.message?.includes('毒のダメージ');
          if (!isPoisonDamage && targetId) {
            display.playCharacterEffect(targetId, 'blink');
          }
          
          if (targetId && currentTempCharacters[targetId]) {
            if (event.hp !== undefined) {
              currentTempCharacters[targetId].hp = event.hp;
            }
            // new_is_poison フラグがあれば優先して更新
            if (event.new_is_poison !== undefined && event.new_is_poison !== null) {
              currentTempCharacters[targetId].is_poison = event.new_is_poison;
            }
            updateVisualState(currentTempCharacters);
          }
          // ドレインの場合、吸い取った側の回復も同時に行う
          if (event.type === 'drain' && event.attacker) {
            display.playCharacterEffect(event.attacker, 'heal');
            if (event.attacker_hp !== undefined && currentTempCharacters[event.attacker]) {
              currentTempCharacters[event.attacker].hp = event.attacker_hp;
              updateVisualState(currentTempCharacters);
            }
          }
          break;

        case 'cure':
        case 'cure_poison':
          if (targetId) display.playCharacterEffect(targetId, 'heal');
          
          if (targetId && currentTempCharacters[targetId]) {
            if (event.hp !== undefined) {
              currentTempCharacters[targetId].hp = event.hp;
            }
            // new_is_poison フラグがあれば優先して更新
            if (event.new_is_poison !== undefined && event.new_is_poison !== null) {
              currentTempCharacters[targetId].is_poison = event.new_is_poison;
            } else if (event.type === 'cure_poison') {
              // フォールバック
              currentTempCharacters[targetId].is_poison = false;
            }
            updateVisualState(currentTempCharacters);
          }
          break;

        case 'stat_up':
        case 'stat_down':
          const effect = event.type === 'stat_up' ? 'up' : 'down';
          if (targetId) display.playCharacterEffect(targetId, effect);

          if (targetId && currentTempCharacters[targetId] && event.new_rank !== undefined) {
            const field = event.stat_type === 'defense' ? 'defense_rank' : 'attack_rank';
            currentTempCharacters[targetId] = { ...currentTempCharacters[targetId], [field]: event.new_rank };
            updateVisualState(currentTempCharacters);
          }
          break;

        case 'ability_trigger':
          const triggerEffect = determineAbilityEffect(event.message || '');
          if (targetId) display.playCharacterEffect(targetId, triggerEffect);
          
          if (targetId && currentTempCharacters[targetId] && event.new_is_poison !== undefined && event.new_is_poison !== null) {
            currentTempCharacters[targetId].is_poison = event.new_is_poison;
            updateVisualState(currentTempCharacters);
          }

          if (event.new_ranks) {
            for (const cid in event.new_ranks) {
              if (currentTempCharacters[cid]) {
                currentTempCharacters[cid] = {
                  ...currentTempCharacters[cid],
                  attack_rank: event.new_ranks[cid].attack_rank ?? currentTempCharacters[cid].attack_rank,
                  defense_rank: event.new_ranks[cid].defense_rank ?? currentTempCharacters[cid].defense_rank
                };
              }
            }
            updateVisualState(currentTempCharacters);
          }
          break;

        case 'knockout':
          if (targetId) {
            display.setKnockoutStates((prev: any) => ({ ...prev, [targetId]: true }));
          }
          break;

        case 'revive':
          if (targetId) {
            display.setKnockoutStates((prev: any) => ({ ...prev, [targetId]: false }));
            if (currentTempCharacters[targetId] && event.hp !== undefined) {
              currentTempCharacters[targetId].hp = event.hp;
              currentTempCharacters[targetId].types = [];
              updateVisualState(currentTempCharacters);
            }
          }
          break;

        case 'ability_changed':
          if (targetId && currentTempCharacters[targetId] && event.new_ability) {
            const prevAbilityId = currentTempCharacters[targetId].ability;
            const nextAbilityId = event.new_ability;
            const playerName = currentTempCharacters[targetId].name;

            const prevAbility = allAbilities[prevAbilityId];
            const nextAbility = allAbilities[nextAbilityId];

            currentTempCharacters[targetId].ability = event.new_ability;
            currentTempCharacters[targetId].ability_change_count = event.new_ability_change_count ?? currentTempCharacters[targetId].ability_change_count;
            updateVisualState(currentTempCharacters);

            // 実際に特性が変わった場合のみ通知を出す
            if (prevAbilityId !== nextAbilityId) {
              display.showNotification({
                text: '特性が変わった！',
                type: 'ability_change',
                prevAbility,
                nextAbility,
                playerName
              });
            }
          }
          duration = 100; // 特性変更は一瞬
          break;

        case 'battle_result':
          display.setShowResultButton(true);
          break;
      }

      // 4. 演出の待機
      if (!isInitialBattle) {
        await new Promise(resolve => setTimeout(resolve, duration));
      }
    }

    // すべての演出終了後に最終状態に同期
    // 注意: サーバーのデータには word が含まれていないため、演出中に保持していた単語をマージする
    const mergedCharacters = { ...finalState.characters };
    for (const id in mergedCharacters) {
      if (currentTempCharacters[id]?.word) {
        mergedCharacters[id] = {
          ...mergedCharacters[id],
          word: currentTempCharacters[id].word
        };
      }
    }

    setBattleState({
      ...finalState,
      characters: mergedCharacters
    });
    setIsAnimating(false);
  };

  /**
   * キャラクターの状態（HP/ランク等）のみを視覚的に更新する
   */
  const updateVisualState = (chars: any) => {
    setBattleState(prev => prev ? { ...prev, characters: { ...chars } } : null);
  };

  /**
   * 特性のメッセージから、どのアニメーションを流すべきか判定する
   */
  const determineAbilityEffect = (msg: string): 'up' | 'down' | 'damage' | 'heal' => {
    if (msg.includes('毒') || msg.includes('種') || msg.includes('下がった')) {
      return msg.includes('下がった') ? 'down' : 'damage';
    }
    return 'up';
  };

  return {
    playSequence,
    isAnimating
  };
};
