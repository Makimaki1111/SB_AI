import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './WordDisplay.module.css';

interface WordDisplayProps {
  word: string | null;
  isAlly: boolean;
  isBlinking?: boolean;
  isKnockout?: boolean;
  centered?: boolean;
  isDouble?: boolean;
}

/**
 * 単語表示コンポーネント。
 * React state にコピーせず、受け取った単語をそのまま表示して本家同様に即時更新する。
 */
export const WordDisplay: React.FC<WordDisplayProps> = ({
  word,
  isAlly,
  isBlinking,
  isKnockout,
  centered = false,
  isDouble = false
}) => {
  const xPos = '-50%';
  const baseClass = isDouble ? styles.doubleWord : (isAlly ? styles.allyWord : styles.foeWord);

  // 本家の「長い単語を枠内に収める」挙動を再現する。
  const textScaleX = useMemo(() => {
    if (!word) return 1;
    const maxWidth = (centered || isDouble) ? 125 : 180;
    // 本家の font-size に近い 32px を1文字あたりの概算幅とする
    const estimatedWidth = Math.max(word.length * 32, 1);
    return Math.min(1, maxWidth / estimatedWidth);
  }, [centered, isDouble, word]);
  
  const finalScaleX = textScaleX;
  const finalScaleY = 1.0;

  return (
    <AnimatePresence mode="popLayout">
      {word && (
        <motion.div
          key={word}
          className={`${baseClass} ${isBlinking ? styles.blinking : ''} word-display-text`}
          initial={{
            opacity: 0,
            x: xPos,
            scaleX: finalScaleX,
            scaleY: finalScaleY,
            y: 0
          }}
          animate={isKnockout ? {
            opacity: 0,
            y: 100,
            x: xPos,
            scaleX: finalScaleX,
            scaleY: finalScaleY
          } : {
            opacity: 1,
            y: 0,
            x: xPos,
            scaleX: finalScaleX,
            scaleY: finalScaleY
          }}
          transition={{
            duration: isKnockout ? 0.8 : 0.3,
            // 本家の jQuery のデフォルトイージング (swing) は easeInOut に近い
            ease: isKnockout ? 'easeInOut' : 'easeOut'
          }}
          style={{ originX: 0.5, originY: 0.5 }}
        >
          {word}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
