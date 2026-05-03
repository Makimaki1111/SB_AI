import React from 'react';
import styles from './HPBar.module.css';

interface HPBarProps {
  hp: number;
  maxHp: number;
  name: string;
  isPoison: boolean;
  lives: number;
  maxLives: number;
  isAlly: boolean;
}

import { motion } from 'framer-motion';

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
  const barColor = hpPercentage > 50 ? '#00FF00' : hpPercentage > 20 ? '#FFFF00' : '#FF0000';

  return (
    <div className={`${styles.balloon} ${isAlly ? styles.left : styles.right}`}>
      <div className={styles.header}>
        <span className={styles.name}>{name}</span>
        {isPoison && <span className={styles.poison}>どく</span>}
        <span className={styles.hpText}>{hp}/{maxHp}</span>
      </div>
      
      <div className={styles.barContainer}>
        <div className={styles.barBackground}>
          <motion.div 
            className={styles.hpBar} 
            initial={{ width: `${hpPercentage}%`, backgroundColor: barColor }}
            animate={{ width: `${hpPercentage}%`, backgroundColor: barColor }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          />
        </div>
      </div>

      <div className={styles.livesContainer}>
        {Array.from({ length: maxLives }).map((_, i) => (
          <div 
            key={i} 
            className={`${styles.lifeDot} ${i >= lives ? styles.lost : ''}`} 
          />
        ))}
      </div>
    </div>
  );
};
