import React, { useLayoutEffect, useRef, useState } from 'react';
import styles from './WordDisplay.module.css';

interface WordDisplayProps {
  word: string | null;
  isAlly: boolean;
}

export const WordDisplay: React.FC<WordDisplayProps> = ({ word, isAlly }) => {
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

  if (!word) return null;

  const transformStyle = isAlly 
    ? `translateX(-50%) scaleX(${scale})` 
    : `translateX(50%) scaleX(${scale})`;

  return (
    <>
      <div className={`${styles.ellipse} ${isAlly ? styles.ellipseLeft : styles.ellipseRight}`} />
      <div 
        ref={textRef}
        className={isAlly ? styles.allyWord : styles.foeWord}
        style={{ transform: transformStyle }}
      >
        {word}
      </div>
    </>
  );
};
