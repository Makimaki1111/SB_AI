import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import styles from './TitleView.module.css';

const CAROUSEL_IMAGES = [
  'animal.gif', 'art.gif', 'body.gif', 'bug.gif', 'cloth.gif', 
  'emote.gif', 'food.gif', 'health.gif', 'insult.gif', 'math.gif', 
  'mech.gif', 'normal.gif', 'person.gif', 'place.gif', 'plant.gif', 
  'play.gif', 'religion.gif', 'science.gif', 'society.gif', 'sports.gif', 
  'tale.gif', 'time.gif', 'violence.gif', 'weather.gif', 'work.gif'
];

export const TitleView: React.FC = () => {
  const navigate = useNavigate();
  const { username, setUsername } = useUser();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempName, setTempName] = useState(username);

  // レガシー版の adjustWindowScale を再現
  React.useEffect(() => {
    const adjustScale = () => {
      const el = document.getElementById('phone-box');
      if (!el) return;
      const originalWidth = 450;
      const originalHeight = 720;
      const scaleX = (window.innerWidth * 0.96) / originalWidth;
      const scaleY = (window.innerHeight * 0.96) / originalHeight;
      const scale = Math.min(scaleX, scaleY, 1.0);
      el.style.transform = scale < 1 ? `scale(${scale})` : 'none';
    };
    window.addEventListener('resize', adjustScale);
    adjustScale();
    return () => window.removeEventListener('resize', adjustScale);
  }, []);

  const handleStartBattle = (path: string) => {
    if (!username.trim()) {
      setIsSettingsOpen(true);
      return;
    }
    navigate(path);
  };

  const handleSaveSettings = () => {
    setUsername(tempName);
    setIsSettingsOpen(false);
  };

  // カルーセルのアイテムを生成 (無限ループのために2倍にする)
  const renderRow = (reverse = false) => (
    <div className={`${styles.track} ${reverse ? styles.reverse : ''}`}>
      {[...CAROUSEL_IMAGES, ...CAROUSEL_IMAGES].map((img, i) => (
        <div key={i} className={styles.item}>
          <img src={`/img/${img}`} alt="" />
        </div>
      ))}
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.phoneBox} id="phone-box">
        <div className={styles.content}>
          <p className={styles.subtitle}>機能を色々追加したい</p>
          <h1 className={styles.title}>しりとりの対戦バトル</h1>

          <div className={styles.carouselContainer}>
            <div className={styles.carouselRow}>{renderRow(false)}</div>
            <div className={styles.carouselRow}>{renderRow(true)}</div>
            <div className={styles.carouselRow}>{renderRow(false)}</div>
          </div>

          <div className={styles.menuButtons}>
            <button 
              className={styles.menuButton} 
              onClick={() => handleStartBattle('/battle/single?mode=stock')}
            >
              <span>特殊ルール</span>
            </button>
            
            <button 
              className={styles.menuButton}
              onClick={() => handleStartBattle('/battle/double')}
            >
              <span>ダブルバトル</span>
            </button>

            <button 
              className={styles.menuButton}
              onClick={() => setIsSettingsOpen(true)}
            >
              <span>設定</span>
            </button>
          </div>
        </div>

        {isSettingsOpen && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <h2 className={styles.modalTitle}>設定</h2>
              <div className={styles.field}>
                <label>名前</label>
                <input 
                  type="text" 
                  value={tempName} 
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="名無し"
                />
              </div>
              <button className={styles.closeButton} onClick={handleSaveSettings}>
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
