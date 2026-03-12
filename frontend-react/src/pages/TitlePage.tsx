import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAudio } from '../context/AudioContext';
import './TitlePage.css';

const TYPES = [
  "animal", "plant", "place", "emote", "art", "food", "violence", "health",
  "body", "mech", "science", "time", "person", "work", "cloth", "society",
  "play", "bug", "math", "insult", "religion", "sports", "weather", "tale", "normal"
];

export const TitlePage: React.FC = () => {
  const navigate = useNavigate();
  const { unlockAudio, playSound, setBGMVolume, setSEVolume } = useAudio();
  const [showSettings, setShowSettings] = React.useState(false);
  const [username, setUsername] = React.useState(localStorage.getItem('sb_username') || '');

  const handleStart = (path: string) => {
    unlockAudio();
    playSound('/src/assets/resource/pera.mp3');
    navigate(path);
  };

  const handleOpenSettings = () => {
    playSound('/src/assets/resource/pera.mp3');
    setShowSettings(true);
  };

  const handleCloseSettings = () => {
    playSound('/src/assets/resource/pera.mp3');
    localStorage.setItem('sb_username', username);
    setShowSettings(false);
  };

  // Generate shuffled images for each row
  const renderCarouselRow = (rowIndex: number) => {
    const shuffled = [...TYPES].sort(() => Math.random() - 0.5);
    // Repeat for seamless scrolling
    const items = [...shuffled, ...shuffled, ...shuffled, ...shuffled];
    return (
      <div className={`carousel-row row-${rowIndex}`} key={rowIndex}>
        {items.map((type, i) => (
          <img
            key={i}
            src={`/src/assets/img/${type}.gif`}
            alt={type}
            className="carousel-item"
          />
        ))}
      </div>
    );
  };

  return (
    <div className="title-page">
      <div id="title-carousel-container">
        {renderCarouselRow(1)}
        {renderCarouselRow(2)}
        {renderCarouselRow(3)}
      </div>

      <p className="subtitle">機能を色々追加したい</p>
      <h1>しりとりの対戦バトル (β版)</h1>

      <div className="title-buttons-container">
        <button className="menu-btn" onClick={() => handleStart('/lobby/single')}>
          シングルバトル
        </button>
        <button className="menu-btn double-battle-btn" onClick={() => handleStart('/lobby/double')}>
          ダブルバトル
        </button>
        <button className="menu-btn settings-btn" onClick={handleOpenSettings}>
          設定
        </button>
      </div>

      {showSettings && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-content">
            <h2>設定</h2>
            <div className="settings-item">
              <label>名前</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.slice(0, 8))}
                placeholder="名前を入力(8文字以内)"
              />
            </div>
            <div className="settings-item">
              <label>BGM音量</label>
              <input
                type="range"
                min="0" max="1" step="0.05"
                onChange={(e) => setBGMVolume(parseFloat(e.target.value))}
              />
            </div>
            <div className="settings-item">
              <label>SE音量</label>
              <input
                type="range"
                min="0" max="1" step="0.05"
                onChange={(e) => {
                  setSEVolume(parseFloat(e.target.value));
                  playSound('/src/assets/resource/concent.mp3');
                }}
              />
            </div>
            <div className="settings-actions">
              <button className="close-btn" onClick={handleCloseSettings}>閉じる</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
