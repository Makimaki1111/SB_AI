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
  slot?: string; // p1a, p1b, p2a, p2b
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
  isDouble = false,
  slot
}) => {
  const xPos = (centered || isDouble) ? '-50%' : (isAlly ? '-50%' : '50%');
  const baseClass = isDouble ? styles.doubleWord : (isAlly ? styles.allyWord : styles.foeWord);

  // 本家の「長い単語を枠内に収める」挙動を、DOM計測なしの概算で再現する。
  const externalScale = (slot === 'p1a' || slot === 'p2a') ? 0.9 : 1.0;
  const textScale = useMemo(() => {
    if (!word) return 1;
    const maxWidth = (centered || isDouble) ? 125 / externalScale : 180;
    const estimatedWidth = Math.max(word.length * 28, 1);
    return Math.min(1, maxWidth / estimatedWidth);
  }, [centered, externalScale, isDouble, word]);
  const finalScale = textScale * externalScale;

  return (
    <AnimatePresence mode="popLayout">
      {word && (
        <motion.div
          key={word}
          className={`${baseClass} ${isBlinking ? styles.blinking : ''} word-display-text`}
          initial={{
            opacity: 0,
            x: xPos,
            scale: finalScale,
            y: 0
          }}
          animate={isKnockout ? {
            opacity: 0,
            y: 100,
            x: xPos,
            scale: finalScale
          } : {
            opacity: 1,
            y: 0,
            x: xPos,
            scale: finalScale
          }}
          transition={{
            duration: isKnockout ? 0.8 : 0.3,
            ease: isKnockout ? 'easeIn' : 'easeOut'
          }}
          style={{ originX: 0.5, originY: 0.5 }}
        >
          {word}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
