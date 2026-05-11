import React, { useState } from 'react';
import { GameModal } from '../common/GameModal';
import { useSound } from '../../context/useSound';
import { useUser } from '../../context/useUser';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { bgmVolume, seVolume, setBgmVolume, setSeVolume, play } = useSound();
  const { username, setUsername } = useUser();
  const [tempName, setTempName] = useState(username);

  const handleBgmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBgmVolume(parseFloat(e.target.value));
  };

  const handleSeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSeVolume(val);
  };

  const handleSeMouseUp = () => {
    // スライダーを離した時に音を鳴らして確認 (ご要望により middmg)
    play('middmg');
  };

  const handleClose = () => {
    play('pera');
    // 名前の保存
    const trimmed = tempName.trim().substring(0, 8);
    if (trimmed) {
      setUsername(trimmed);
      localStorage.setItem("sb_username", trimmed);
    }
    onClose();
  };

  return (
    <GameModal
      isOpen={isOpen}
      onClose={onClose}
      title="せってい"
      footer={
        <button className={styles.closeButton} onClick={handleClose}>とじる</button>
      }
    >
      <div className={styles.settingsContent}>
        <div className={styles.settingItem}>
          <div className={styles.labelRow}>
            <label>名前 (8文字以内)</label>
          </div>
          <input 
            type="text" 
            className={styles.nameInput}
            value={tempName} 
            onChange={(e) => setTempName(e.target.value)}
            placeholder="ななし"
            maxLength={8}
          />
        </div>

        <div className={styles.settingItem}>
          <div className={styles.labelRow}>
            <label>BGM 音量</label>
            <span className={styles.valueText}>{Math.round(bgmVolume * 100)}%</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={bgmVolume} 
            onChange={handleBgmChange}
            onMouseUp={handleSeMouseUp}
            onTouchEnd={handleSeMouseUp}
            className={styles.slider}
          />
        </div>
        <div className={styles.settingItem}>
          <div className={styles.labelRow}>
            <label>SE 音量</label>
            <span className={styles.valueText}>{Math.round(seVolume * 100)}%</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={seVolume} 
            onChange={handleSeChange}
            onMouseUp={handleSeMouseUp}
            onTouchEnd={handleSeMouseUp}
            className={styles.slider}
          />
        </div>
      </div>
    </GameModal>
  );
};
