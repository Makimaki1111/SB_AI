import React from 'react';
import { CharacterAvatar } from './CharacterAvatar';
import { WordDisplay } from './WordDisplay';
import { BattleEffects } from './BattleEffects';
import styles from './BattleCharacter.module.css';
import { motion } from 'framer-motion';

interface BattleCharacterProps {
  id: string;
  name: string;
  types: string[];
  isAlly: boolean;
  isBlinking: boolean;
  isKnockout: boolean;
  activeEffect?: string | null;
  slot?: 'p1a' | 'p1b' | 'p2a' | 'p2b';
  word?: string | null;
  scale?: number;
  className?: string;
}

/**
 * 役者（キャラクター）一人の表示を司るコンポーネント
 */
export const BattleCharacter: React.FC<BattleCharacterProps> = ({
  types,
  isAlly,
  isBlinking,
  isKnockout,
  activeEffect,
  slot,
  word,
  scale = 1,
  className = ''
}) => {
  return (
    <motion.div 
      className={`${styles.characterContainer} ${isBlinking ? styles.blinking : ''} ${className}`}
      data-ally={isAlly}
      data-double={!!slot}
      style={{ 
        transform: `scale(${scale})`,
        transformOrigin: 'bottom center'
      }}
      initial="alive"
      animate={isKnockout ? "knockout" : "alive"}
      variants={{
        alive: { opacity: 1, y: 0 },
        knockout: { opacity: 0, y: 100 }
      }}
      transition={{
        duration: isKnockout ? 0.8 : 0.3,
        ease: isKnockout ? "easeInOut" : "easeOut"
      }}
    >
      <CharacterAvatar
        types={types}
        isAlly={isAlly}
        isDouble={!!slot}
        className={styles.avatar}
      />

      <div className={styles.wordWrapper}>
        <WordDisplay
          word={word}
          isAlly={isAlly}
          isDouble={!!slot}
        />
      </div>

      <div className={styles.effectsContainer}>
        <BattleEffects trigger={activeEffect || null} />
      </div>
    </motion.div>
  );
};
