import React from 'react';
import styles from './CharacterAvatar.module.css';
import { TYPE_TO_IMAGE } from '../../constants/game';
import { motion } from 'framer-motion';

interface CharacterAvatarProps {
  types: string[];
  isAlly: boolean;
  isDouble?: boolean;
  className?: string;
}

/**
 * キャラクターアバター (タイプ画像) コンポーネント。
 */
export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  types,
  isAlly,
  isDouble = false,
  className = ''
}) => {
  const currentValidTypes = (types || []).filter(t => t && t.trim() !== '');
  const displayTypes = currentValidTypes;

  if (displayTypes.length === 0) return null;

  const isDual = displayTypes.length >= 2;

  return (
    <motion.div
      className={`${styles.avatarGroup} ${isDouble ? styles.doubleMode : styles.singleMode} ${isAlly ? styles.ally : styles.foe} ${className}`}
      initial="alive"
      animate="alive"
      variants={{
        alive: { opacity: 1, y: 0 }
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
