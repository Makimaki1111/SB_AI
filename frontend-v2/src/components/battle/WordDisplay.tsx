import React, { useLayoutEffect, useRef, useState } from 'react';
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
 * 透明な状態で計測を完了させ、確定した倍率でフェードインを開始する。
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
  const [displayWord, setDisplayWord] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const measureRef = useRef<HTMLDivElement>(null);

  // 単語が変更された時の処理
  useLayoutEffect(() => {
    if (!word) {
      setDisplayWord(null);
      setScale(1);
      return;
    }

    // すでに同じ単語が表示されていれば何もしない
    if (word === displayWord) return;

    // 1. まず表示を消す(本家同様、新しい単語が来たら古いのは即座に消える)
    setDisplayWord(null);

    // 2. 計測用の隠し要素に内容をセットして即座に計測
    // (Reactのステート更新を待たず、DOMを直接操作して同期的に測る)
    if (measureRef.current) {
      measureRef.current.innerText = word;
      const scrollWidth = measureRef.current.scrollWidth;
      
      // スロットによる外部スケール (p1a/p2a は 0.9)
      const externalScale = (slot === 'p1a' || slot === 'p2a') ? 0.9 : 1.0;
      const maxWidth = (centered || isDouble) ? (125 / externalScale) : 180; 
      
      let newScale = 1;
      if (scrollWidth > maxWidth) {
        newScale = maxWidth / scrollWidth;
      }

      // 3. 計測済みの倍率をセットして表示を確定
      setScale(newScale);
      setDisplayWord(word);
    }
  }, [word, displayWord, centered, isDouble, slot]);

  const xPos = (centered || isDouble) ? '-50%' : (isAlly ? '-50%' : '50%');
  const baseClass = isDouble ? styles.doubleWord : (isAlly ? styles.allyWord : styles.foeWord);
  
  // スロットによる外部スケール (p1a/p2a は 0.9)
  const externalScale = (slot === 'p1a' || slot === 'p2a') ? 0.9 : 1.0;
  const finalScale = scale * externalScale;

  return (
    <>
      {/* 計測用の隠し要素 */}
      <div
        ref={measureRef}
        className={baseClass}
        style={{
          opacity: 0,
          pointerEvents: 'none',
          visibility: 'hidden',
          position: 'absolute',
          display: 'block',
          fontSize: '28px', // ダブルの基準サイズで測る
          fontWeight: 'bold'
        }}
      />

      {/* 本番用の表示要素 */}
      <AnimatePresence mode="popLayout">
        {displayWord && (
          <motion.div
            key={displayWord}
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
              ease: isKnockout ? "easeIn" : "easeOut"
            }}
            style={{ originX: 0.5, originY: 0.5 }}
          >
            {displayWord}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
