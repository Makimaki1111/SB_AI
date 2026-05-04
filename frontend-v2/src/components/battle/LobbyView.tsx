import React from 'react';
import styles from './LobbyView.module.css';
import { GameButton } from '../common/GameButton';
import { AbilityCard } from './AbilityCard';

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
      <AbilityCard 
        ability={selectedAbilityData} 
        onClick={onOpenAbilityModal} 
      />

      <div className={styles.buttonContainer}>
        <GameButton 
          onClick={() => onStartMatch('player')}
        >
          対人戦 (ランダム)
        </GameButton>

        <GameButton onClick={() => onStartMatch('cpu')}>
          コンピュータ戦
        </GameButton>

        <hr className={styles.separator} />

        <GameButton onClick={() => onStartMatch('room')}>
          ルームを作成する
        </GameButton>

        <div className={styles.joinBox}>
          <input 
            type="text" 
            placeholder="ルームID" 
            className={styles.roomInput} 
          />
          <GameButton 
            className={styles.joinButton} 
            variant="green"
            onClick={() => onStartMatch('room')}
          >
            参加する
          </GameButton>
        </div>
      </div>
    </div>
  );
};
