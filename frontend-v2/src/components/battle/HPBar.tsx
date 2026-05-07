import React from 'react';
import styles from './HPBar.module.css';
import { motion } from 'framer-motion';

interface HPBarProps {
  hp: number;
  maxHp: number;
  name: string;
  isPoison: boolean;
  isAlly: boolean;
  isWaiting?: boolean;
  isDouble?: boolean;
}

export const HPBar: React.FC<HPBarProps> = ({
  hp,
  maxHp,
  name,
  isPoison,
  isAlly,
  isWaiting = false,
  isDouble = false
}) => {
  // マッチング待機中は100%表示
  const hpPercentage = isWaiting ? 100 : (maxHp > 0 ? (hp / maxHp) * 100 : 0);

  // Legacy color logic from UI.js (line 629)
  const getHPBarColor = (ratio: number) => {
    if (ratio > 0.5) return "#00FF00"; // 緑色
    if (ratio > 0.2) return "#FFFF00"; // 黄色
    return "#FF0000"; // 赤色
  };

  const barColor = isWaiting ? "#00FF00" : getHPBarColor(hp / (maxHp || 1));

  return (
    <div className={`${styles.balloon} ${isAlly ? styles.right : styles.left} ${isDouble ? styles.compact : ''}`}>
      <div className={isAlly ? styles.allyNameContainer : styles.foeNameContainer}>
        <div className={isAlly ? styles.allyName : styles.foeName}>
          {name}
        </div>
        {isPoison && <span className={styles.poison}>どく</span>}
      </div>

      <div className={styles.bar}>
        <motion.div
          className={isAlly ? styles.allyHpBar : styles.foeHpBar}
          animate={{ width: `${hpPercentage}%`, backgroundColor: barColor }}
          transition={{
            width: { duration: 0.6 },
            backgroundColor: { delay: 0.6, duration: 0 }
          }}
          style={{ height: '100%', borderRadius: '3px' }}
        />
      </div>

      {!isWaiting && <div className={styles.hp}>{hp}/{maxHp}</div>}
    </div>
  );
};
