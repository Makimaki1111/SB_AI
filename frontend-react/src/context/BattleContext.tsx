import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BattleState, CharacterData, BattleMode } from '../types';
import { useAudio } from './AudioContext';


const TYPE_SOUND_MAP: Record<string, string> = {
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
};

const EVENT_SOUND_MAP: Record<string, string> = {
  "cure": "/src/assets/resource/heal.mp3",
  "stat_down": "/src/assets/resource/down.mp3",
  "drain": "/src/assets/resource/seed_damage.mp3",
  "stat_up": "/src/assets/resource/up.mp3"
};

const DAMAGE_MSG_MAP: Record<string, string> = {
  "効果はばつぐんだ！": "/src/assets/resource/effective.mp3",
  "ふつうのダメージだ": "/src/assets/resource/middmg.mp3",
  "効果はいまひとつのようだ…": "/src/assets/resource/noneffective.mp3"
};

interface BattleContextType {
  state: BattleState;
  connect: (type: 'single' | 'double', action: 'create' | 'join' | 'cpu', roomId?: string, mode?: string) => void;
  sendWord: (word: string, targetId?: string) => void;
  startBattle: (mode: BattleMode, subMode: 'player' | 'cpu' | 'room', name: string) => void;
  changeAbility: (abilityId: string) => void;
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
  currentTargetId: null
};


export const BattleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const audio = useAudio();
  const [state, setState] = useState<BattleState>(INITIAL_STATE);
  const socketRef = useRef<WebSocket | null>(null);

  const connect = useCallback((type: BattleMode, action: 'create' | 'join' | 'cpu', roomId?: string, subMode?: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    const endpoint = type === 'single' ? '/ws' : '/ws/double';
    const socket = new WebSocket(`${protocol}//${host}${endpoint}`);
    socketRef.current = socket;

    socket.onopen = () => {
      const player_id = localStorage.getItem('sb_player_id') || `p_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem('sb_player_id', player_id);

      const name = localStorage.getItem('sb_username') || '名無し';
      const ability = localStorage.getItem('sb_ability') || '';
      
      socket.send(JSON.stringify({
        type: 'update_user_info',
        info: { player_id, name, ability }
      }));

      const msgType = type === 'single' 
        ? (action === 'create' ? 'create_room' : action === 'join' ? 'join_room' : 'join_cpu_room')
        : (action === 'create' ? 'create_double_room' : action === 'join' ? 'join_double_room' : 'join_double_cpu_room');

      socket.send(JSON.stringify({
        type: msgType,
        info: { player_id, room_id: roomId, mode: subMode }
      }));
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
    // Initial state setup or other effects
  }, []);

  const handleSocketMessage = (data: any) => {
    console.log('Received:', data);
    
    switch (data.type) {
      case 'room_created':
      case 'double_room_created':
        setState(prev => ({ ...prev, roomId: data.room_id }));
        break;

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
          isVsCpu: true,
          allAbilities: data.all_abilities
        }));
        navigate('/battle');
        break;

      case 'init_double_battle':
        const doubleChars: Record<string, CharacterData> = {};
        Object.entries(data.characters).forEach(([id, char]: [string, any]) => {
          doubleChars[id] = {
            id,
            name: char.name,
            hp: char.hp,
            maxHp: char.maxHp,
            atkRank: char.attack_rank || 0,
            defRank: char.defense_rank || 0,
            ability: char.ability,
            abilityChangeCount: char.ability_change_count,
            isPoison: char.is_poison,
            isDefeated: char.is_defeated,
            types: char.types || [],
            currentWord: ''
          };
        });
        setState(prev => ({
          ...prev,
          mode: 'double',
          roomId: data.room_id,
          isVsCpu: data.is_cpu,
          characters: doubleChars,
          characterToStartWith: data.character,
          isMyTurn: data.current_owner_id === localStorage.getItem('sb_player_id'),
          currentTurnActorId: data.current_actor_id
        }));
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
      if (char && char.types[0]) {
        playSound(TYPE_SOUND_MAP[char.types[0]]);
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    for (const event of data.sequence) {
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

  const startBattle = (mode: BattleMode, subMode: 'player' | 'cpu' | 'room', name: string) => {
    // This will trigger the socket connection and room creation
    // For now, let's call connect with appropriate params
    const action = subMode === 'cpu' ? 'cpu' : 'create';
    connect(mode, action, undefined, subMode === 'cpu' ? 'cpu' : undefined);
    
    // In a real implementation, we would send the trainer name as well
  };

  const changeAbility = (abilityId: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: state.mode === 'single' ? 'change_ability' : 'change_ability_double',
        info: {
          room_id: state.roomId,
          player_id: localStorage.getItem('sb_player_id'),
          ability: abilityId,
          char_id: state.characterToStartWith // Assuming characterToStartWith is the current active character
        }
      }));
    }
  };

  return (
    <BattleContext.Provider value={{ 
      state, 
      connect,    
      sendWord,
      startBattle,
      changeAbility
    }}>
      {children}
    </BattleContext.Provider>
  );
};
