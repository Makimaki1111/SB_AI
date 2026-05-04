import React from 'react';
import styles from './CharacterAvatar.module.css';
import { TYPE_TO_IMAGE } from '../../constants/game';

interface CharacterAvatarProps {
  type: string;
  isAlly: boolean;
  isBlinking?: boolean;
}

export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({ type, isAlly, isBlinking }) => {
  const iconName = TYPE_TO_IMAGE[type] || 'normal';
  
  return (
    <div className={`${styles.avatarContainer} ${isAlly ? styles.ally : styles.foe} ${isBlinking ? styles.blinking : ''}`}>
      <img src={`/img/${iconName}.gif`} alt={type} className={styles.avatarImg} />
    </div>
  );
};
