import React from 'react';
import { motion } from 'framer-motion';
import styles from './StatusRow.module.css';

interface StatusRowProps {
  name: string;
  hp: number;
  maxHp: number;
  isPoison: boolean;
  isWaiting?: boolean;
}

/**
 * シングルバトルとダブルバトルで共通して使用される、
 * 1キャラクター分のステータス表示（名前、毒、HPバー、数値）
 */
export const StatusRow: React.FC<StatusRowProps> = ({
  name,
  hp,
  maxHp,
  isPoison,
  isWaiting = false
}) => {
  // マッチング待機中やデータがない場合は100%表示
  const safeMaxHp = maxHp || 1;
  const hpPercentage = isWaiting ? 100 : (hp / safeMaxHp) * 100;

  // Legacy color logic
  const getHPBarColor = (ratio: number) => {
    if (ratio > 0.5) return "#00FF00"; // 緑色
    if (ratio > 0.2) return "#FFFF00"; // 黄色
    return "#FF0000"; // 赤色
  };

  const barColor = isWaiting ? "#00FF00" : getHPBarColor(hp / safeMaxHp);

  return (
    <div className={styles.rowContainer}>
      <div className={styles.nameRow}>
        <span className={styles.memberName}>{name}</span>
        {isPoison && <span className={styles.poisonBadge}>どく</span>}
      </div>

      <div className={styles.hpBarContainer}>
        <motion.div
          className={styles.hpBar}
          animate={{ 
            width: `${Math.max(0, hpPercentage)}%`, 
            backgroundColor: barColor 
          }}
          transition={{
            width: { duration: 0.6 },
            backgroundColor: { delay: 0.6, duration: 0 }
          }}
        />
      </div>

      {!isWaiting && (
        <div className={styles.hpText}>
          {Math.max(0, Math.floor(hp))}/{safeMaxHp}
        </div>
      )}
    </div>
  );
};
