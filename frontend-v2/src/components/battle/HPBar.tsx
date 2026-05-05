import React from 'react';
import styles from './HPBar.module.css';
import { motion } from 'framer-motion';

interface HPBarProps {
  hp: number;
  maxHp: number;
  name: string;
  isPoison: boolean;
  lives: number;
  maxLives: number;
  isAlly: boolean;
}

export const HPBar: React.FC<HPBarProps> = ({ 
  hp, 
  maxHp, 
  name, 
  isPoison, 
  lives, 
  maxLives, 
  isAlly 
}) => {
  const hpPercentage = maxHp > 0 ? (hp / maxHp) * 100 : 0;
  const barColor = hpPercentage > 50 ? '#00FF00' : hpPercentage > 20 ? '#FFCC00' : '#FF0000';

  return (
    <div className={`${styles.balloon} ${isAlly ? styles.right : styles.left}`}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span className={styles.name}>{name}</span>
          {isPoison && <span className={styles.poison}>どく</span>}
        </div>
        <span className={styles.hpText}>{hp}/{maxHp}</span>
      </div>
      
      <div className={styles.barContainer}>
        {/* ダメージ演出用の白い残像バー */}
        <motion.div 
          className={styles.whiteBar}
          initial={{ width: `${hpPercentage}%` }}
          animate={{ width: `${hpPercentage}%` }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
        />
        {/* メインのHPバー */}
        <motion.div 
          className={styles.hpBar} 
          initial={{ width: `${hpPercentage}%`, backgroundColor: barColor }}
          animate={{ width: `${hpPercentage}%`, backgroundColor: barColor }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
};
