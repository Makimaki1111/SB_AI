import React from 'react';
import styles from './CharacterAvatar.module.css';
import { TYPE_TO_IMAGE } from '../../constants/game';
import { motion, AnimatePresence } from 'framer-motion';

interface CharacterAvatarProps {
  type: string;
  isAlly: boolean;
  isBlinking?: boolean;
  isKnockout?: boolean;
}

export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({ 
  type, 
  isAlly, 
  isBlinking,
  isKnockout 
}) => {
  const iconName = TYPE_TO_IMAGE[type] || 'normal';
  const imageUrl = `/img/${iconName}.gif`;
  
  return (
    <AnimatePresence>
      {!isKnockout && (
        <motion.div 
          className={`${styles.avatarContainer} ${isAlly ? styles.ally : styles.foe} ${isBlinking ? styles.blinking : ''}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ duration: 0.6 }}
        >
          {/* 画像を確実に表示するためのimgタグ。エラー時は非表示にする */}
          <img 
            src={imageUrl} 
            alt={type} 
            className={styles.avatarImg} 
            onError={(e) => {
              console.error(`❌ Failed to load avatar image: ${imageUrl} for type: ${type}`);
              e.currentTarget.src = '/img/normal.gif';
            }}
            onLoad={() => {
              console.log(`✅ Loaded avatar: ${imageUrl} for ${isAlly ? 'ally' : 'foe'} (type: ${type})`);
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
