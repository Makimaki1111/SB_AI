import React from 'react';
import styles from './CharacterAvatar.module.css';
import { TYPE_TO_IMAGE } from '../../constants/game';
import { motion, AnimatePresence } from 'framer-motion';

interface CharacterAvatarProps {
  types: string[]; // 複数タイプに対応
  isAlly: boolean;
  isBlinking?: boolean;
  isKnockout?: boolean;
}

/**
 * キャラクターアバター (タイプ画像) コンポーネント。
 */
export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({ 
  types = [], 
  isAlly, 
  isBlinking,
  isKnockout 
}) => {
  // 初期状態(タイプなし)は何も表示しない
  if (!types || types.length === 0) return null;

  const displayTypes = types.filter(t => t);
  if (displayTypes.length === 0) return null;

  const isDual = displayTypes.length >= 2;

  return (
    <AnimatePresence>
      <motion.div 
        key={isKnockout ? 'knockout' : 'alive'}
        className={`${styles.avatarGroup} ${isAlly ? styles.allyGroup : styles.foeGroup} ${isBlinking ? styles.blinking : ''}`}
        initial={{ opacity: 1, y: 0 }}
        animate={isKnockout ? { opacity: 0, y: 100 } : { opacity: 1, y: 0 }}
        transition={{ duration: isKnockout ? 0.8 : 0.3 }}
      >
        {displayTypes.map((type, index) => {
          const iconName = TYPE_TO_IMAGE[type] || 'normal';
          const imageUrl = `/img/${iconName}.gif`;
          
          const positionClass = isDual 
            ? (index === 0 ? styles.type1 : styles.type2) 
            : styles.single;

          return (
            <motion.div 
              key={`${index}-${imageUrl}`}
              className={`${styles.iconContainer} ${positionClass}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <img 
                src={imageUrl} 
                alt={type} 
                className={styles.avatarImg} 
                onError={(e) => {
                  e.currentTarget.src = '/img/normal.gif';
                }}
              />
            </motion.div>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
};
