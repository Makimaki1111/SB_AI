import React from 'react';
import styles from './HPBar.module.css';
import { motion } from 'framer-motion';

interface DoubleHPBarProps {
  hp: number;
  maxHp: number;
  isPoison: boolean;
  isAlly: boolean;
}

export const DoubleHPBar: React.FC<DoubleHPBarProps> = ({
  hp,
  maxHp,
  isPoison,
  isAlly
}) => {
  const hpPercentage = maxHp > 0 ? (hp / maxHp) * 100 : 0;

  const getHPBarColor = (ratio: number) => {
    if (ratio > 0.5) return "#00FF00";
    if (ratio > 0.2) return "#FFFF00";
    return "#FF0000";
  };

  const barColor = getHPBarColor(hp / (maxHp || 1));

  return (
    <div className={styles.bar} style={{ marginTop: '4px', marginBottom: '4px' }}>
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
  );
};
