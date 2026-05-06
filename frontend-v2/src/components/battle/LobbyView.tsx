import React from 'react';
import { GameButton } from '../common/GameButton';
import { AbilityCard } from './AbilityCard';
import type { AbilityData } from '../../types/battle';
import styles from './LobbyView.module.css';

interface LobbyViewProps {
  onStartMatch: (mode: 'player' | 'cpu' | 'room', options?: Record<string, string | number | boolean>) => void;
  onOpenAbilityModal: (index?: number) => void;
  onBackToTitle: () => void;
  selectedAbilities: string[];
  allAbilities: Record<string, AbilityData>;
  mode?: 'single' | 'stock' | 'double';
}

export const LobbyView: React.FC<LobbyViewProps> = ({ 
  onStartMatch, 
  onOpenAbilityModal, 
  onBackToTitle,
  selectedAbilities,
  allAbilities,
  mode = 'single'
}) => {
  const [showBalloon, setShowBalloon] = React.useState(false);
  const [roomId, setRoomId] = React.useState('');
  const isDouble = mode === 'double';
  const isStock = mode === 'stock';

  // 本家仕様: 選択中の特性データを取得。
  const getAbilityData = (index: number) => {
    const id = selectedAbilities[index];
    return allAbilities[id] || { 
      name: 'ランダム', 
      description: 'ランダムに決定されます',
      icon_type: 'ノーマル' 
    };
  };

  return (
    <div className={styles.lobbyContent}>
      <button className={styles.backButton} onClick={onBackToTitle}>
        ← もどる
      </button>

      <div className={styles.titleContainer}>
        <h1 className={styles.lobbyTitle}>
          {isStock ? '特殊ルール' : isDouble ? 'ダブルバトル' : 'シングルバトル'}
        </h1>
        {isStock && (
          <button 
            className={styles.helpBtn} 
            onClick={(e) => { e.stopPropagation(); setShowBalloon(!showBalloon); }}
          >
            ?
          </button>
        )}
      </div>

      {showBalloon && isStock && (
        <div className={styles.helpBalloon} onClick={() => setShowBalloon(false)}>
          <div className={styles.balloonTitle}>特殊ルールの説明</div>
          <div>相手のHPを<span className={styles.highlight}>複数回</span>0にしたらプレイヤーの勝ちとなります。</div>
          <div className={styles.balloonHint}>(タップして閉じる)</div>
          <div className={styles.balloonTail}></div>
        </div>
      )}

      {isDouble && (
        <div className={styles.modeSelector}>
          <div className={`${styles.modeTab} ${styles.active}`}>1人2役</div>
          <div className={`${styles.modeTab} ${styles.disabled}`}>4人対戦 (未開発)</div>
        </div>
      )}

      <div className={isDouble ? styles.abilityCardsDouble : styles.abilityCardsSingle}>
        <AbilityCard 
          ability={getAbilityData(0)} 
          onClick={() => onOpenAbilityModal(0)} 
          className={isDouble ? styles.doubleCard : ''}
          label={isDouble ? "1人目" : undefined}
        />
        {isDouble && (
          <AbilityCard 
            ability={getAbilityData(1)} 
            onClick={() => onOpenAbilityModal(1)} 
            className={styles.doubleCard}
            label="2人目"
          />
        )}
      </div>

      <div className={styles.buttonContainer}>
        <GameButton onClick={() => onStartMatch('player')}>
          ランダムマッチ
        </GameButton>

        <GameButton onClick={() => onStartMatch('cpu')}>
          コンピュータ戦
        </GameButton>

        <hr className={styles.separator} />

        <GameButton onClick={() => onStartMatch('room')}>
          ルーム作成
        </GameButton>

        <div className={styles.joinBox}>
          <input 
            type="text" 
            placeholder="ルームID" 
            className={styles.roomInput} 
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <GameButton 
            className={styles.joinButton} 
            variant="green"
            onClick={() => onStartMatch('room', { roomId })}
          >
            参加
          </GameButton>
        </div>
      </div>
    </div>
  );
};
