import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BattleState, CharacterData, BattleMode } from '../types';
import { useAudio } from './AudioContext';


const getAssetUrl = (path: string) => {
  // src/assets/ からの相対パスを受け取って動的に解決する
  const cleanPath = path.replace('/src/assets/', './assets/');
  return new URL(cleanPath, import.meta.url).href;
};

const TYPE_SOUND_MAP: Record<string, string> = Object.fromEntries(
  Object.entries({
    "ノーマル": "/src/assets/resource/normal.mp3",
    "動物": "/src/assets/resource/animal.mp3",
    "植物": "/src/assets/resource/plant.mp3",
    "地名": "/src/assets/resource/place.mp3",
    "感情": "/src/assets/resource/emote.mp3",
    "芸術": "/src/assets/resource/art.mp3",
    "食べ物": "/src/assets/resource/food.mp3",
    "暴力": "/src/assets/resource/violence.mp3",
    "医療": "/src/assets/resource/health.mp3",
    "人体": "/src/assets/resource/body.mp3",
    "機械": "/src/assets/resource/mech.mp3",
    "理科": "/src/assets/resource/science.mp3",
    "時間": "/src/assets/resource/time.mp3",
    "人物": "/src/assets/resource/person.mp3",
    "工作": "/src/assets/resource/work.mp3",
    "服飾": "/src/assets/resource/cloth.mp3",
    "社会": "/src/assets/resource/society.mp3",
    "遊び": "/src/assets/resource/play.mp3",
    "虫": "/src/assets/resource/bug.mp3",
    "数学": "/src/assets/resource/math.mp3",
    "暴言": "/src/assets/resource/insult.mp3",
    "宗教": "/src/assets/resource/religion.mp3",
    "スポーツ": "/src/assets/resource/sports.mp3",
    "天気": "/src/assets/resource/weather.mp3",
    "物語": "/src/assets/resource/tale.mp3"
  }).map(([k, v]) => [k, getAssetUrl(v)])
);

const EVENT_SOUND_MAP: Record<string, string> = Object.fromEntries(
  Object.entries({
    "cure": "/src/assets/resource/heal.mp3",
    "stat_down": "/src/assets/resource/down.mp3",
    "drain": "/src/assets/resource/seed_damage.mp3",
    "stat_up": "/src/assets/resource/up.mp3"
  }).map(([k, v]) => [k, getAssetUrl(v)])
);

const DAMAGE_MSG_MAP: Record<string, string> = Object.fromEntries(
  Object.entries({
    "効果はばつぐんだ！": "/src/assets/resource/effective.mp3",
    "ふつうのダメージだ": "/src/assets/resource/middmg.mp3",
    "効果はいまひとつのようだ…": "/src/assets/resource/noneffective.mp3"
  }).map(([k, v]) => [k, getAssetUrl(v)])
);

interface BattleContextType {
  state: BattleState;
  connect: (type: 'single' | 'double', action: 'create' | 'join' | 'cpu', roomId?: string, mode?: string) => void;
  sendWord: (word: string, targetId?: string) => void;
  sendIncludeCheck: (word: string) => void;
  startBattle: (mode: BattleMode, subMode: 'player' | 'cpu' | 'room') => void;
  changeAbility: (abilityId: string, charId: string) => void;
  setCurrentTargetId: (targetId: string) => void;
}

const BattleContext = createContext<BattleContextType | null>(null);

export const useBattle = () => {
  const context = useContext(BattleContext);
  if (!context) throw new Error('useBattle must be used within BattleProvider');
  return context;
};

const INITIAL_STATE: BattleState = {
  roomId: null,
  mode: 'single',
  isVsCpu: false,
  characters: {},
  myTeam: null,
  isMyTurn: false,
  characterToStartWith: '',
  allAbilities: {},
  currentTargetId: null,
  preCheckResult: null
};


export const BattleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const audio = useAudio();
  const [state, setState] = useState<BattleState>(INITIAL_STATE);
  const socketRef = useRef<WebSocket | null>(null);

  const connect = useCallback((type: BattleMode, action: 'create' | 'join' | 'cpu', roomId?: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    const endpoint = type === 'single' ? '/ws' : '/ws/double';
    
    // 既存の接続があれば閉じる
    if (socketRef.current) {
      console.log('Closing existing socket connection...');
      socketRef.current.close();
    }

    const socket = new WebSocket(`${protocol}//${host}${endpoint}`);
    socketRef.current = socket;

    socket.onopen = () => {
      const player_id = localStorage.getItem('sb_player_id') || `p_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem('sb_player_id', player_id);

      const name = localStorage.getItem('sb_username') || '名無し';
      const ability = localStorage.getItem('sb_ability') || '';
      const ability_2 = localStorage.getItem('sb_ability_2') || '';
      
      // Update user info
      socket.send(JSON.stringify({
        type: 'update_user_info',
        info: { 
          player_id, 
          name, 
          ability,
          ...(type === 'double' ? { ability_2 } : {})
        }
      }));

      // Single Battle Messages
      if (type === 'single') {
        if (action === 'create') {
          socket.send(JSON.stringify({ type: 'join_private_room', info: { player_id, room_id: '' } }));
        } else if (action === 'join') {
          socket.send(JSON.stringify({ type: 'join_private_room', info: { player_id, room_id: roomId } }));
        } else if (action === 'cpu') {
          socket.send(JSON.stringify({ type: 'make_new_battle', info: { player1_id: player_id, player2_id: 'cpu' } }));
        } else if ((action as string) === 'find_match') {
          socket.send(JSON.stringify({ type: 'find_match', info: { player_id } }));
        }
      } 
      // Double Battle Messages
      else {
        if (action === 'create') {
          socket.send(JSON.stringify({ type: 'create_double_room', info: { player_id, mode: '1v1_double' } }));
        } else if (action === 'join') {
          socket.send(JSON.stringify({ type: 'join_double_room', info: { player_id, room_id: roomId } }));
        } else if (action === 'cpu') {
          socket.send(JSON.stringify({ type: 'join_double_cpu_room', info: { player_id } }));
        }
      }
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleSocketMessage(data);
    };

    socket.onclose = () => {
      console.log('Socket closed');
    };
  }, []);

  useEffect(() => {
    return () => {
      // コンポーネントのアンマウント時にソケットを確実に閉じる
      if (socketRef.current) {
        console.log('Cleaning up BattleContext: Closing socket');
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  const handleSocketMessage = (data: any) => {
    console.log('Received:', data);
    
    switch (data.type) {
      case 'made_room':
      case 'init_battle':
        const initialCharacters: Record<string, CharacterData> = {
          p1a: {
            id: 'p1a',
            name: data.ally.name,
            hp: data.ally.max_hp,
            maxHp: data.ally.max_hp,
            atkRank: 0,
            defRank: 0,
            ability: data.ally.ability,
            abilityChangeCount: data.ally.ability_change_count,
            isPoison: data.ally.is_poison,
            isDefeated: false,
            types: [],
            currentWord: ''
          },
          p2a: {
            id: 'p2a',
            name: data.foe.name,
            hp: data.foe.max_hp,
            maxHp: data.foe.max_hp,
            atkRank: 0,
            defRank: 0,
            ability: data.foe.ability || 'secret',
            abilityChangeCount: data.foe.ability_change_count ?? 3,
            isPoison: data.foe.is_poison,
            isDefeated: false,
            types: [],
            currentWord: ''
          }
        };
        setState(prev => ({
          ...prev,
          mode: 'single',
          roomId: data.room_id,
          characters: initialCharacters,
          isMyTurn: data.state.is_my_turn,
          characterToStartWith: data.state.character,
          myTeam: 'p1',
          isVsCpu: data.is_cpu || (data.foe && data.foe.name === 'CPU') || true,
          allAbilities: data.all_abilities
        }));
        navigate('/battle');
        break;

      case 'pre_check':
        setState(prev => ({
          ...prev,
          preCheckResult: {
            isPossible: data.is_possible,
            word: data.word,
            damage: data.damage,
            type: data.type,
            message: data.message,
          }
        }));
        break;

      case 'init_double_battle':
        const doubleChars: Record<string, CharacterData> = {};
        const charsData = data.characters || data.chars || {};
        Object.entries(charsData).forEach(([id, char]: [string, any]) => {
          doubleChars[id] = {
            id,
            name: char.name,
            hp: char.hp,
            maxHp: char.max_hp,
            atkRank: char.attack_rank || 0,
            defRank: char.defense_rank || 0,
            ability: char.ability,
            abilityChangeCount: char.ability_change_count ?? 3,
            isPoison: char.is_poison,
            isDefeated: char.is_defeated,
            types: char.types || [],
            currentWord: ''
          };
        });
        const playerId = localStorage.getItem('player_id');
        let myTeam: 'p1' | 'p2' = 'p1';
        Object.entries(charsData).forEach(([id, char]: [string, any]) => {
          if (char.owner_id === playerId) {
            myTeam = id.startsWith('p1') ? 'p1' : 'p2';
          }
        });

        setState(prev => ({
          ...prev,
          mode: 'double',
          roomId: data.room_id,
          isVsCpu: data.is_cpu,
          characters: doubleChars,
          characterToStartWith: data.state?.character || data.character,
          myTeam: myTeam,
          isMyTurn: data.state?.is_my_turn ?? (data.current_owner_id === playerId),
          allAbilities: data.all_abilities || {},
          currentTargetId: myTeam === 'p1' ? 'p2a' : 'p1a'
        }));
        navigate('/battle');
        break;
      
      case 'turn_result':
        processTurnResult(data);
        break;
    }
  };

  const processTurnResult = async (data: any) => {
    const { playSound } = audio;
    
    // Initial word display
    if (data.word && data.charId) {
      setState(prev => ({
        ...prev,
        characters: {
          ...prev.characters,
          [data.charId]: { ...prev.characters[data.charId], currentWord: data.word }
        }
      }));
      
      const char = state.characters[data.charId];
      if (char && char.types && char.types[0]) {
        playSound(TYPE_SOUND_MAP[char.types[0]]);
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    // Update character stats if provided (Double Battle style)
    if (data.characters) {
      const updatedChars: Record<string, CharacterData> = { ...state.characters };
      Object.entries(data.characters).forEach(([id, char]: [string, any]) => {
        if (updatedChars[id]) {
          updatedChars[id] = {
            ...updatedChars[id],
            hp: char.hp,
            maxHp: char.maxHp,
            atkRank: char.attack_rank || 0,
            defRank: char.defense_rank || 0,
            ability: char.ability,
            abilityChangeCount: char.ability_change_count,
            isPoison: char.is_poison,
            isDefeated: char.is_defeated,
            types: char.types || updatedChars[id].types
          };
        }
      });
      setState(prev => ({ ...prev, characters: updatedChars }));
    }

    // Single battle style updates
    if (data.ally || data.foe) {
      setState(prev => {
        const newCharacters = { ...prev.characters };
        if (data.ally && newCharacters['p1a']) {
          newCharacters['p1a'] = {
            ...newCharacters['p1a'],
            hp: data.ally.hp,
            maxHp: data.ally.max_hp,
            atkRank: data.ally.atk_rank || 0,
            defRank: data.ally.def_rank || 0,
            ability: data.ally.ability,
            abilityChangeCount: data.ally.ability_change_count,
            isPoison: data.ally.is_poison,
            isDefeated: data.ally.hp <= 0
          };
        }
        if (data.foe && newCharacters['p2a']) {
          newCharacters['p2a'] = {
            ...newCharacters['p2a'],
            hp: data.foe.hp,
            maxHp: data.foe.max_hp,
            atkRank: data.foe.atk_rank || 0,
            defRank: data.foe.def_rank || 0,
            ability: data.foe.ability,
            abilityChangeCount: data.foe.ability_change_count,
            isPoison: data.foe.is_poison,
            isDefeated: data.foe.hp <= 0
          };
        }
        return { ...prev, characters: newCharacters };
      });
    }

    // Sequence processing
    for (const event of data.sequence || []) {
      if (event.message) {
        // TODO: Update a global battle log if we add one
      }

      // Audio handling
      if (EVENT_SOUND_MAP[event.type]) {
        playSound(EVENT_SOUND_MAP[event.type]);
      }
      if (event.type === 'damage' && DAMAGE_MSG_MAP[event.message]) {
        playSound(DAMAGE_MSG_MAP[event.message]);
      }

      switch (event.type) {
        case 'damage':
          setState(prev => {
            const nextChars = { ...prev.characters };
            Object.keys(event.changes).forEach(id => {
              if (nextChars[id]) {
                nextChars[id] = { 
                  ...nextChars[id], 
                  hp: event.changes[id].newHp,
                  isPoison: event.changes[id].isPoison ?? nextChars[id].isPoison,
                  animation: 'damage'
                };
              }
            });
            return { ...prev, characters: nextChars };
          });
          break;

        case 'cure':
          setState(prev => {
            const nextChars = { ...prev.characters };
            Object.keys(event.changes).forEach(id => {
              if (nextChars[id]) {
                nextChars[id] = { 
                  ...nextChars[id], 
                  hp: event.changes[id].newHp,
                  animation: 'heal'
                };
              }
            });
            return { ...prev, characters: nextChars };
          });
          break;

        case 'stat':
          setState(prev => {
            const nextChars = { ...prev.characters };
            const anim = event.message.includes('上がった') ? 'stat-up' : 'stat-down';
            Object.keys(event.changes).forEach(id => {
              if (nextChars[id]) {
                nextChars[id] = { 
                  ...nextChars[id], 
                  atkRank: event.changes[id].atkRank ?? nextChars[id].atkRank,
                  defRank: event.changes[id].defRank ?? nextChars[id].defRank,
                  animation: anim
                };
              }
            });
            return { ...prev, characters: nextChars };
          });
          break;
      }
      
      await new Promise(r => setTimeout(r, 1000));
      
      // Clear animation
      setState(prev => {
        const nextChars = { ...prev.characters };
        Object.keys(nextChars).forEach(id => {
          nextChars[id] = { ...nextChars[id], animation: null };
        });
        return { ...prev, characters: nextChars };
      });
    }

    // End of turn updates
    setState(prev => ({ 
      ...prev, 
      isMyTurn: data.next_turn_is_mine,
      characterToStartWith: data.next_character_to_start_with || prev.characterToStartWith
    }));
  };

  const sendWord = (word: string, targetId?: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: state.mode === 'single' ? 'submit_word' : 'submit_word_double',
        info: {
          room_id: state.roomId,
          player_id: localStorage.getItem('sb_player_id'),
          word,
          target_id: targetId
        }
      }));
    }
  };

  const sendIncludeCheck = (word: string) => {
    if (socketRef.current && state.roomId) {
      socketRef.current.send(JSON.stringify({
        type: state.mode === 'single' ? 'include_check' : 'include_check_double',
        info: {
          room_id: state.roomId,
          player_id: localStorage.getItem('sb_player_id'),
          word: word
        }
      }));
    }
  };

  const startBattle = (mode: BattleMode, subMode: 'player' | 'cpu' | 'room', roomId?: string) => {
    let action: 'create' | 'join' | 'cpu' | 'find_match' = 'create';
    if (subMode === 'cpu') action = 'cpu';
    else if (subMode === 'player') action = 'find_match';
    else if (subMode === 'room' && roomId) action = 'join';
    else if (subMode === 'room') action = 'create';

    connect(mode, action as any, roomId);
  };

  const changeAbility = (abilityId: string, charId: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: state.mode === 'single' ? 'change_ability' : 'change_ability_double',
        info: {
          room_id: state.roomId,
          player_id: localStorage.getItem('sb_player_id'),
          ability: abilityId,
          char_id: charId
        }
      }));
    }
  };

  return (
    <BattleContext.Provider value={{ 
      state, 
      connect,    
      sendWord,
      sendIncludeCheck,
      startBattle,
      changeAbility,
      setCurrentTargetId: (targetId: string) => setState(prev => ({ ...prev, currentTargetId: targetId }))
    }}>
      {children}
    </BattleContext.Provider>
  );
};
