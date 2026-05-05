import React, { useState, useEffect, useRef, useMemo } from 'react';
import styles from './AbilityModal.module.css';
import { TYPE_TO_IMAGE } from '../../constants/game';
import type { AbilityData } from '../../types/battle';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

interface AbilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (abilityId: string) => void;
  currentAbilityId: string;
  allAbilities: Record<string, AbilityData>;
  canChange: boolean;
}

export const AbilityModal: React.FC<AbilityModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  currentAbilityId,
  allAbilities,
  canChange
}) => {
  const abilitiesList = useMemo(() => {
    return Object.entries(allAbilities)
      .filter(([id]) => id !== 'secret')
      .map(([id, info]) => ({ id, ...info }));
  }, [allAbilities]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 初期位置の設定
  useEffect(() => {
    if (isOpen) {
      const idx = abilitiesList.findIndex(a => a.id === currentAbilityId);
      if (idx !== -1) setCurrentIndex(idx);
    }
  }, [isOpen, currentAbilityId, abilitiesList]);

  if (!isOpen) return null;

  const N = abilitiesList.length;
  const spacing = 90; // 本家の85より少し広めに

  const handleDrag = (_: any, info: any) => {
    setDragX(info.offset.x);
  };

  const handleDragEnd = (_: any, info: any) => {
    const moveThreshold = 30;
    const velocityThreshold = 100;
    
    if (Math.abs(info.offset.x) > moveThreshold || Math.abs(info.velocity.x) > velocityThreshold) {
      const direction = info.offset.x > 0 ? -1 : 1;
      let nextIndex = currentIndex + direction;
      // ループ対応
      if (nextIndex < 0) nextIndex = N - 1;
      if (nextIndex >= N) nextIndex = 0;
      setCurrentIndex(nextIndex);
    }
    setDragX(0);
  };

  const handleItemClick = (index: number) => {
    if (!canChange) return;
    setCurrentIndex(index);
  };

  const handleConfirm = () => {
    if (canChange) {
      onSelect(abilitiesList[currentIndex].id);
    }
    onClose();
  };

  const currentInfo = abilitiesList[currentIndex] || { name: '---', description: '' };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <motion.div 
        className={styles.modalBody} 
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
      >
        <h2 className={styles.modalTitle}>とくせいを選択</h2>
        
        {/* 現在/選択中の情報表示 */}
        <div className={styles.infoSection}>
          <span className={styles.sectionLabel}>選択中のとくせい</span>
          <h3 className={styles.abilityNameDisplay}>{currentInfo.name}</h3>
          <p className={styles.abilityDescDisplay}>{currentInfo.desc || currentInfo.description}</p>
        </div>

        {/* 円弧状カルーセル */}
        <div className={styles.carouselContainer} ref={containerRef}>
          <motion.div 
            className={styles.carouselTrack}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
          >
            {abilitiesList.map((ab, i) => {
              // 最短距離での差分計算 (ループ対応)
              let diff = i - currentIndex;
              diff = diff - Math.round(diff / N) * N;
              
              // ドラッグ量を加味 (ピクセルからインデックスへの変換)
              const offsetIndex = diff + (dragX / spacing);
              const absDiff = Math.abs(offsetIndex);
              
              const x = offsetIndex * spacing;
              const y = absDiff * absDiff * 4; // 円弧の深さ
              const scale = Math.max(0.6, 1 - absDiff * 0.2);
              const opacity = Math.max(0, 1 - absDiff * 0.35);
              const zIndex = Math.round(100 - absDiff * 10);

              const iconName = TYPE_TO_IMAGE[ab.icon_type] || 'normal';

              return (
                <motion.div
                  key={ab.id}
                  className={`${styles.carouselItem} ${i === currentIndex ? styles.selected : ''}`}
                  animate={{
                    x: `calc(-50% + ${x}px)`,
                    y: `calc(-50% + ${y}px)`,
                    scale,
                    opacity,
                    zIndex
                  }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  onClick={() => handleItemClick(i)}
                >
                  <img src={`/img/${iconName}.gif`} alt={ab.name} />
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        <div className={styles.footer}>
          <button className={styles.closeBtn} onClick={onClose}>とじる</button>
          <button 
            className={`${styles.decideBtn} ${!canChange ? styles.disabled : ''}`}
            onClick={handleConfirm}
            disabled={!canChange}
          >
            {canChange ? '決定' : '変更不可'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
