import React, { useState, useEffect } from 'react';
import styles from './LobbyView.module.css';
import { useUser } from '../../context/UserContext';
import { useLocation } from 'react-router-dom';

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
  const location = useLocation();
  const [roomInput, setRoomInput] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  
  const queryParams = new URLSearchParams(location.search);
  const isStockMode = queryParams.get('mode') === 'stock';
  
  const isRandom = !selectedAbility || selectedAbility === "";
  const abilityInfo = isRandom 
    ? { name: 'ランダム', description: '対戦開始時にランダムに特性が決定されます。', icon_type: 'random' }
    : (allAbilities[selectedAbility] || { name: '選択中...', description: '', icon_type: 'ノーマル' });
  
  const iconName = isRandom ? 'unaware' : (TYPE_TO_IMAGE[abilityInfo.icon_type] || 'normal');

  return (
    <div className={styles.lobbyContent} onClick={() => setShowHelp(false)}>
      <button className={styles.backButton} onClick={onBackToTitle}>
        ←もどる
      </button>

      <div className={styles.titleContainer}>
        <h1 className={styles.lobbyTitle}>
          {isStockMode ? '特殊ルール' : 'シングルバトル'}
        </h1>
        {isStockMode && (
          <span 
            className={styles.helpBtn}
            onClick={(e) => {
              e.stopPropagation();
              setShowHelp(!showHelp);
            }}
          >
            ?
          </span>
        )}
      </div>

      {showHelp && (
        <div className={styles.helpBalloon} onClick={(e) => e.stopPropagation()}>
          <div className={styles.helpTitle}>特殊ルールの説明</div>
          相手のHPを<span style={{ color: '#ff4d4d', fontWeight: 800, fontSize: '1.1rem' }}>複数回</span>0にしたら<br />プレイヤーの勝ちとなります。
          <div style={{ marginTop: 12, fontSize: '0.75rem', color: '#999', fontWeight: 'bold' }}>(タップして閉じる)</div>
        </div>
      )}
      
      <div 
        className={styles.abilityCard} 
        onClick={onOpenAbilityModal}
      >
        <div className={styles.abilityIconWrapper}>
          <img src={`/img/${iconName}.gif`} alt="" className={styles.abilityIcon} />
        </div>
        <div className={styles.abilityInfo}>
          <div className={styles.abilityName}>{abilityInfo.name}</div>
          <div className={styles.abilityDesc}>{abilityInfo.description}</div>
        </div>
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
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              className={styles.joinButton}
              onClick={(e) => {
                e.stopPropagation();
                onStartMatch('room', roomInput);
              }}
            >
              参加する
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
