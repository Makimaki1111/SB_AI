import React from 'react';
import styles from './CharacterAvatar.module.css';

interface CharacterAvatarProps {
  type: string;
  isAlly: boolean;
}

import { TYPE_TO_IMAGE } from '../../constants/game';

export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({ type, isAlly }) => {
  const iconName = TYPE_TO_IMAGE[type] || 'normal';
  
  return (
    <div className={`${styles.avatarContainer} ${isAlly ? styles.ally : styles.foe}`}>
      <img src={`/img/${iconName}.gif`} alt={type} className={styles.avatarImg} />
    </div>
  );
};
