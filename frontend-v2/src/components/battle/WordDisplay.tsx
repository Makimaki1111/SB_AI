import React, { useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './WordDisplay.module.css';

interface WordDisplayProps {
  word: string | null;
  isAlly: boolean;
  isBlinking?: boolean;
  isKnockout?: boolean;
}

export const WordDisplay: React.FC<WordDisplayProps> = ({ 
  word, 
  isAlly, 
  isBlinking,
  isKnockout 
}) => {
  const textRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    if (textRef.current) {
      const maxWidth = 180;
      const scrollWidth = textRef.current.scrollWidth;
      if (scrollWidth > maxWidth) {
        setScale(maxWidth / scrollWidth);
      } else {
        setScale(1);
      }
    }
  }, [word]);

  const xPos = isAlly ? '-50%' : '50%';

  return (
    <AnimatePresence>
      {word && (
        <motion.div 
          key={word}
          ref={textRef}
          className={`${isAlly ? styles.allyWord : styles.foeWord} ${isBlinking ? styles.blinking : ''}`}
          initial={{ opacity: 0, x: xPos, scaleX: scale, y: 0 }}
          animate={isKnockout ? { 
            opacity: 0, 
            y: 100,
            x: xPos,
            scaleX: scale
          } : { 
            opacity: 1, 
            y: 0,
            x: xPos,
            scaleX: scale
          }}
          transition={{ 
            duration: isKnockout ? 0.8 : 0.3,
            ease: isKnockout ? "easeIn" : "easeOut"
          }}
        >
          {word}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
