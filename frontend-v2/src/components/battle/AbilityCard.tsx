import React from 'react';
import styles from './AbilityCard.module.css';

const TYPE_TO_IMAGE: Record<string, string> = {
  "ノーマル": "normal", "感情": "emote", "食べ物": "food", "植物": "plant",
  "社会": "society", "時間": "time", "工作": "work", "芸術": "art",
  "機械": "mech", "遊び": "play", "暴力": "violence", "服飾": "cloth",
  "動物": "animal", "地名": "place", "人物": "person", "人体": "body",
  "理科": "science", "暴言": "insult", "虫": "bug", "数学": "math",
  "医療": "health", "宗教": "religion", "スポーツ": "sports",
  "物語": "tale", "天気": "weather"
};

interface AbilityData {
  name: string;
  description?: string;
  desc?: string;
  icon_type?: string;
}

interface AbilityCardProps {
  ability: AbilityData;
  onClick?: () => void;
  className?: string;
}

export const AbilityCard: React.FC<AbilityCardProps> = ({ ability, onClick, className = '' }) => {
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
        <div className={styles.name}>{ability.name}</div>
        <div className={styles.desc}>{ability.desc || ability.description}</div>
      </div>
    </div>
  );
};
