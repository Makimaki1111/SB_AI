import { useState, useRef, useEffect } from 'react';
import type { BattleState, CharacterState, AbilityData } from '../../types/battle';

export const useDoubleBattleState = () => {
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

  const getAllyTeam = (state: BattleState | null, mapping: Record<string, string>): CharacterState[] => {
    if (!state?.characters || !mapping) return [];
    return Object.entries(state.characters)
      .filter(([id, _]) => mapping[id]?.startsWith('ally'))
      .map(([id, char]) => ({ ...char, id }));
  };

  const getFoeTeam = (state: BattleState | null, mapping: Record<string, string>): CharacterState[] => {
    if (!state?.characters || !mapping) return [];
    return Object.entries(state.characters)
      .filter(([id, _]) => mapping[id]?.startsWith('foe'))
      .map(([id, char]) => ({ ...char, id }));
  };

  const getTeamIds = (mapping: Record<string, string>, side: 'ally' | 'foe'): string[] => {
    return Object.keys(mapping).filter(id => mapping[id]?.startsWith(side));
  };

  const reset = () => {
    setBattleState(null);
    battleStateRef.current = null;
    setUiMapping({});
    uiMappingRef.current = {};
  };

  return {
    battleState, setBattleState: updateBattleStateAndRef, battleStateRef,
    allAbilities, setAllAbilities,
    uiMapping, updateUiMapping, uiMappingRef,
    getAllyTeam, getFoeTeam, getTeamIds,
    reset
  };
};
