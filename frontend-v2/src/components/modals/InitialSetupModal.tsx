import React, { useState } from 'react';
import styles from './InitialSetupModal.module.css';
import { GameButton } from '../common/GameButton';
import SoundManager from '../../utils/SoundManager';
import { motion, AnimatePresence } from 'framer-motion';

interface InitialSetupModalProps {
  isOpen: boolean;
  onConfirm: (name: string) => void;
}

export const InitialSetupModal: React.FC<InitialSetupModalProps> = ({ isOpen, onConfirm }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) return;
    
    SoundManager.play('pera');
    onConfirm(name.trim());
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={styles.overlay}>
          <motion.div 
            className={styles.modal}
            initial={{ opacity: 0, scale: 0.9, x: "-50%", y: "-50%" }}
            animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
            exit={{ opacity: 0, scale: 0.9, x: "-50%", y: "-50%" }}
            style={{ position: 'absolute', top: '50%', left: '50%' }}
          >
            <div className={styles.content}>
              <h2 className={styles.title}>しりとりバトルへようこそ！</h2>
              <p className={styles.description}>
                ユーザー名を入力してください<br />
                <span className={styles.subtext}>(設定で後から変更できます)</span>
              </p>
              
              <form onSubmit={handleSubmit} className={styles.form}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="プレイヤー"
                  maxLength={10}
                  autoFocus
                  className={styles.input}
                />
                
                <div className={styles.buttonWrapper}>
                  <GameButton 
                    type="submit"
                    disabled={!name.trim()}
                    variant="orange"
                    className={styles.confirmButton}
                  >
                    はじめる！
                  </GameButton>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
