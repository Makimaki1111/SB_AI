import { useState, useRef, useEffect } from 'react';
import type { BattleState, CharacterState, AbilityData } from '../../types/battle';

export const useBattleState = () => {
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [allAbilities, setAllAbilities] = useState<Record<string, AbilityData>>({});
  const [uiMapping, setUiMapping] = useState<Record<string, string>>({});
  
  const battleStateRef = useRef<BattleState | null>(null);
  const uiMappingRef = useRef<Record<string, string>>({});

  useEffect(() => {
    battleStateRef.current = battleState;
  }, [battleState]);

  useEffect(() => {
    uiMappingRef.current = uiMapping;
  }, [uiMapping]);

  const updateBattleStateAndRef = (state: BattleState | null | ((prev: BattleState | null) => BattleState | null)) => {
    if (typeof state === 'function') {
      setBattleState(prev => {
        const next = state(prev);
        battleStateRef.current = next;
        return next;
      });
    } else {
      setBattleState(state);
      battleStateRef.current = state;
    }
  };

  const updateUiMapping = (mapping: Record<string, string>) => {
    setUiMapping(mapping);
    uiMappingRef.current = mapping;
  };

  const getAlly = (state: BattleState | null, mapping: Record<string, string>): CharacterState | null => {
    if (!state?.characters || !mapping) return null;
    const entry = Object.entries(state.characters).find(([id, _]) => mapping[id]?.startsWith('ally'));
    return entry ? entry[1] : null;
  };

  const getFoe = (state: BattleState | null, mapping: Record<string, string>): CharacterState | null => {
    if (!state?.characters || !mapping) return null;
    const entry = Object.entries(state.characters).find(([id, _]) => mapping[id]?.startsWith('foe'));
    return entry ? entry[1] : null;
  };

  const getAllyId = (mapping: Record<string, string>): string | null => {
    return Object.keys(mapping).find(id => mapping[id]?.startsWith('ally')) || null;
  };

  const getFoeId = (mapping: Record<string, string>): string | null => {
    return Object.keys(mapping).find(id => mapping[id]?.startsWith('foe')) || null;
  };

  const reset = () => {
    setBattleState(null);
    battleStateRef.current = null;
    setUiMapping({});
    uiMappingRef.current = {};
    // allAbilitiesはリロードの手間を省くため保持しても良いが、
    // 完全に初期化したい場合はここでもクリアする
  };

  return {
    battleState, setBattleState: updateBattleStateAndRef, battleStateRef,
    allAbilities, setAllAbilities,
    uiMapping, updateUiMapping, uiMappingRef,
    getAlly, getFoe, getAllyId, getFoeId,
    reset
  };
};
