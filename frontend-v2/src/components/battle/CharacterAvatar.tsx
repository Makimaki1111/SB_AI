import React, { useRef } from 'react';
import styles from './CharacterAvatar.module.css';
import { TYPE_TO_IMAGE } from '../../constants/game';
import { motion } from 'framer-motion';

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
  const lastValidTypesRef = useRef<string[]>([]);
  const currentValidTypes = (types || []).filter(t => t && t.trim() !== '');
  
  if (currentValidTypes.length > 0) {
    lastValidTypesRef.current = currentValidTypes;
  }

  const displayTypes = (isKnockout || currentValidTypes.length === 0) 
    ? lastValidTypesRef.current 
    : currentValidTypes;

  if (displayTypes.length === 0) return null;

  const isDual = displayTypes.length >= 2;

  // variants を使用してアニメーションの状態を定義
  const containerVariants = {
    alive: {
      opacity: 1,
      y: 0,
    },
    knockout: {
      opacity: 0,
      y: 100,
    }
  };

  return (
    <motion.div 
      className={`${styles.avatarGroup} ${isAlly ? styles.allyGroup : styles.foeGroup} ${isBlinking ? styles.blinking : ''}`}
      initial="alive"
      animate={isKnockout ? "knockout" : "alive"}
      variants={containerVariants}
      transition={{ 
        duration: isKnockout ? 0.8 : 0.3,
        ease: isKnockout ? "easeIn" : "easeOut"
      }}
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
  );
};
