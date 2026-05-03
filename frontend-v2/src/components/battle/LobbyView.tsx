import React, { useState } from 'react';
import styles from './LobbyView.module.css';
import { useUser } from '../../context/UserContext';

const TYPE_TO_IMAGE: Record<string, string> = {
  "ノーマル": "normal", "感情": "emote", "食べ物": "food", "植物": "plant",
  "社会": "society", "時間": "time", "工作": "work", "芸術": "art",
  "機械": "mech", "遊び": "play", "暴力": "violence", "服飾": "cloth",
  "動物": "animal", "地名": "place", "人物": "person", "人体": "body",
  "理科": "science", "暴言": "insult", "虫": "bug", "数学": "math",
  "医療": "health", "宗教": "religion", "スポーツ": "sports",
  "物語": "tale", "天気": "weather"
};

interface LobbyViewProps {
  onStartMatch: (mode: 'player' | 'cpu' | 'room', roomId?: string) => void;
  onOpenAbilityModal: () => void;
  onBackToTitle: () => void;
  selectedAbility: string;
  allAbilities: Record<string, any>;
}

export const LobbyView: React.FC<LobbyViewProps> = ({ 
  onStartMatch, 
  onOpenAbilityModal,
  onBackToTitle,
  selectedAbility,
  allAbilities
}) => {
  const { username } = useUser();
  const [roomInput, setRoomInput] = useState('');
  
  const isRandom = !selectedAbility || selectedAbility === "";
  const abilityInfo = isRandom 
    ? { name: 'ランダム', description: 'ランダムに決定されます', icon_type: 'random' }
    : (allAbilities[selectedAbility] || { name: '選択中...', description: '', icon_type: 'ノーマル' });
  
  const iconName = isRandom ? 'unaware' : (TYPE_TO_IMAGE[abilityInfo.icon_type] || 'normal');

  return (
    <div className={styles.lobbyContent}>
      <button className={styles.backButton} onClick={onBackToTitle}>
        タイトルに戻る
      </button>
      <h1 className={styles.lobbyTitle}>シングルバトル</h1>
      
      <div 
        className={styles.abilityCard} 
        onClick={onOpenAbilityModal}
      >
        <div className={styles.abilityLabel}>
          <span>とくせい</span>
          <span className={styles.tapToChange}>TAP TO CHANGE</span>
        </div>
        <div className={styles.abilityHeader}>
          <img src={`/img/${iconName}.gif`} alt="" className={styles.abilityIcon} />
          <div className={styles.abilityName}>{abilityInfo.name}</div>
        </div>
        <div className={styles.abilityDesc}>{abilityInfo.description}</div>
      </div>

      <div className={styles.buttonContainer}>
        <button 
          className={styles.lobbyButton} 
          onClick={() => onStartMatch('player')}
        >
          ランダムマッチ
        </button>
        
        <button 
          className={styles.lobbyButton} 
          onClick={() => onStartMatch('cpu')}
        >
          コンピュータ戦
        </button>

        <hr className={styles.separator} />

        <div className={styles.roomActions}>
          <button 
            className={styles.lobbyButton}
            onClick={() => onStartMatch('room')}
          >
            ルーム作成
          </button>

          <div className={styles.joinBox}>
            <input 
              type="text" 
              className={styles.roomInput} 
              placeholder="ルームID" 
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
            />
            <button 
              className={styles.joinButton}
              onClick={() => onStartMatch('room', roomInput)}
            >
              参加
            </button>
          </div>
        </div>
      </div>

      <div className={styles.playerName}>
        プレイヤー: {username || "ななし"}
      </div>
    </div>
  );
};
