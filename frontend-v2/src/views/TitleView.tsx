import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import styles from './TitleView.module.css';
import { GameButton } from '../components/common/GameButton';
import { GameLayout } from '../components/layout/GameLayout';
import { SettingsModal } from '../components/battle/SettingsModal';

const CAROUSEL_IMAGES = [
  'animal.gif', 'art.gif', 'body.gif', 'bug.gif', 'cloth.gif', 
  'emote.gif', 'food.gif', 'health.gif', 'insult.gif', 'math.gif', 
  'mech.gif', 'normal.gif', 'person.gif', 'place.gif', 'plant.gif', 
  'play.gif', 'religion.gif', 'science.gif', 'society.gif', 'sports.gif', 
  'tale.gif', 'time.gif', 'violence.gif', 'weather.gif', 'work.gif'
];

export const TitleView: React.FC = () => {
  const navigate = useNavigate();
  const { username } = useUser();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // カルーセルのアイテムをシャッフルした状態で生成 (無限ループのために2倍にする)
  const shuffledRows = useMemo(() => {
    return [0, 1, 2].map(() => {
      const shuffled = [...CAROUSEL_IMAGES].sort(() => Math.random() - 0.5);
      return [...shuffled, ...shuffled, ...shuffled]; // 途切れ防止に3セット
    });
  }, []);

  const handleStartBattle = (path: string) => {
    if (!username.trim()) {
      setIsSettingsOpen(true);
      return;
    }
    navigate(path);
  };

  const renderRow = (rowIndex: number, reverse = false) => (
    <div className={`${styles.track} ${reverse ? styles.reverse : ''}`}>
      {shuffledRows[rowIndex].map((img, i) => (
        <div key={`${rowIndex}-${i}`} className={styles.item}>
          <img src={`/img/${img}`} alt="" />
        </div>
      ))}
    </div>
  );

  return (
    <GameLayout id="phone-box">
      <div className={styles.content}>
        <p className={styles.subtitle}>機能を色々追加したい</p>
        <h1 className={styles.title}>しりとりの対戦バトル</h1>

        <div className={styles.carouselContainer}>
          <div className={styles.carouselRow}>{renderRow(0, false)}</div>
          <div className={styles.carouselRow}>{renderRow(1, true)}</div>
          <div className={styles.carouselRow}>{renderRow(2, false)}</div>
        </div>

        <div className={styles.menuButtons}>
          <GameButton 
            onClick={() => handleStartBattle('/battle/single?mode=stock')}
          >
            特殊ルール
          </GameButton>
          
          <GameButton 
            variant="pink"
            onClick={() => handleStartBattle('/battle/double')}
          >
            ダブルバトル
          </GameButton>

          <GameButton 
            variant="grey"
            onClick={() => setIsSettingsOpen(true)}
          >
            設定
          </GameButton>
        </div>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </GameLayout>
  );
};
