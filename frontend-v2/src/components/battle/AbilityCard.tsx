import React from 'react';
import styles from './AbilityCard.module.css';
import { TYPE_TO_IMAGE } from '../../constants/gameConstants';
import { AbilityData } from '../../types/battle';

interface AbilityCardProps {
  ability: AbilityData;
  onClick?: () => void;
  className?: string;
  label?: string;
}

export const AbilityCard: React.FC<AbilityCardProps> = ({ ability, onClick, className = '', label }) => {
  const getIconPath = (data: AbilityData) => {
    const typeKey = data.icon_type || 'ノーマル';
    const filename = TYPE_TO_IMAGE[typeKey] || 'normal';
    return `/img/${filename}.gif`;
  };

  return (
    <div className={`${styles.abilityCard} ${className}`} onClick={onClick}>
      <div className={styles.iconWrapper}>
        <img src={getIconPath(ability)} alt="" className={styles.icon} />
      </div>
      <div className={styles.info}>
        {label && <div className={styles.label}>{label}</div>}
        <div className={styles.name}>{ability.name}</div>
        <div className={styles.desc}>{ability.desc || ability.description}</div>
      </div>
    </div>
  );
};
