import React, { useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './WordDisplay.module.css';

interface WordDisplayProps {
  word: string | null;
  isAlly: boolean;
  isBlinking?: boolean;
  isKnockout?: boolean;
}

/**
 * 単語表示コンポーネント。
 * 透明な状態で計測を完了させ、確定した倍率でフェードインを開始する。
 */
export const WordDisplay: React.FC<WordDisplayProps> = ({
  word,
  isAlly,
  isBlinking,
  isKnockout
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
      const maxWidth = 180;
      let newScale = 1;
      if (scrollWidth > maxWidth) {
        newScale = maxWidth / scrollWidth;
      }

      // 3. 計測済みの倍率をセットして表示を確定
      setScale(newScale);
      setDisplayWord(word);
    }
  }, [word, displayWord]);

  const xPos = isAlly ? '-50%' : '50%';

  return (
    <>
      {/* 計測用の隠し要素 (常に存在し、スタイルを本番に合わせる) */}
      <div
        ref={measureRef}
        className={isAlly ? styles.allyWord : styles.foeWord}
        style={{
          opacity: 0,
          pointerEvents: 'none',
          visibility: 'hidden',
          position: 'absolute',
          display: 'block'
        }}
      />

      {/* 本番用の表示要素 */}
      <AnimatePresence mode="popLayout">
        {displayWord && (
          <motion.div
            key={displayWord}
            className={`${isAlly ? styles.allyWord : styles.foeWord} ${isBlinking ? styles.blinking : ''}`}
            initial={{
              opacity: 0,
              x: xPos,
              scaleX: scale, // 計測済みの倍率
              y: 0
            }}
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
            style={{ originX: 0.5 }}
          >
            {displayWord}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
