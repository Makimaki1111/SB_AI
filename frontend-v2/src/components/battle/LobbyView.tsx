import React from 'react';
import styles from './LobbyView.module.css';

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
  onStartMatch: (mode: 'player' | 'cpu' | 'room') => void;
  onOpenAbilityModal: () => void;
  onBackToTitle: () => void;
  selectedAbility: string;
  allAbilities: Record<string, any>;
  mode?: 'stock' | 'normal';
}

export const LobbyView: React.FC<LobbyViewProps> = ({ 
  onStartMatch, 
  onOpenAbilityModal, 
  onBackToTitle,
  selectedAbility,
  allAbilities,
  mode = 'normal'
}) => {
  const [showBalloon, setShowBalloon] = React.useState(false);

  // 本家仕様: 選択中の特性データを取得。
  const selectedAbilityData = allAbilities[selectedAbility] || { 
    name: 'ランダム', 
    description: 'ランダムに決定されます',
    icon_type: 'ノーマル' 
  };

  // 本家仕様: 特性アイコンのパス。タイプ名からGIF名を導出
  const getIconPath = (data: any) => {
    if (selectedAbility === 'random' || !allAbilities[selectedAbility]) {
      return '/img/unaware.gif'; // 本家の「ランダム」アイコン
    }
    const gifName = TYPE_TO_IMAGE[data.icon_type] || 'normal';
    return `/img/${gifName}.gif`;
  };

  return (
    <div className={styles.lobbyContent}>
      <button className={styles.backButton} onClick={onBackToTitle}>
        ← タイトルへ
      </button>

      <div className={styles.titleContainer}>
        <h1 className={styles.lobbyTitle}>
          {mode === 'stock' ? '特殊ルール(ストック制)' : 'シングルバトル'}
        </h1>
        <button className={styles.helpBtn} onClick={() => setShowBalloon(!showBalloon)}>?</button>
      </div>

      {showBalloon && (
        <div className={styles.helpBalloon} onClick={() => setShowBalloon(false)}>
          <div>HPがなくなるとストックを消費して復活します。先に相手のストックをすべてなくした方の勝ちです！</div>
          <div className={styles.balloonTail}></div>
        </div>
      )}

      {/* 本家風のとくせいカード */}
      <div className={styles.abilityCard} onClick={onOpenAbilityModal}>
        <div className={styles.abilityIconWrapper}>
          <img src={getIconPath(selectedAbilityData)} alt="" className={styles.abilityIcon} />
        </div>
        <div className={styles.abilityInfo}>
          <div className={styles.abilityName}>{selectedAbilityData.name}</div>
          <div className={styles.abilityDesc}>{selectedAbilityData.desc || selectedAbilityData.description}</div>
        </div>
      </div>

      <div className={styles.buttonContainer}>
        <button className={styles.lobbyButton} onClick={() => onStartMatch('player')}>
          対人戦 (ランダム)
        </button>

        <button className={styles.lobbyButton} onClick={() => onStartMatch('cpu')}>
          コンピュータ戦
        </button>

        <hr className={styles.separator} />

        <button className={styles.lobbyButton} onClick={() => onStartMatch('room')}>
          ルームを作成する
        </button>

        <div className={styles.joinBox}>
          <input type="text" placeholder="ルームID" className={styles.roomInput} />
          <button className={styles.joinButton}>参加する</button>
        </div>
      </div>
    </div>
  );
};
