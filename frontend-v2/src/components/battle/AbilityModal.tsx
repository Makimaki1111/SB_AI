import React, { useState, useEffect, useRef, useMemo } from 'react';
import styles from './AbilityModal.module.css';
import { TYPE_TO_IMAGE } from '../../constants/game';
import type { AbilityData } from '../../types/battle';
import { motion } from 'framer-motion';

interface AbilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (abilityId: string) => void;
  currentAbilityId: string; // 選んでいる最中のID
  allyAbilityId: string;   // 実際に今装備しているID
  allAbilities: Record<string, AbilityData>;
  canChange: boolean;
  abilityChangeCount: number;
  isLobby?: boolean;
}

export const AbilityModal: React.FC<AbilityModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  currentAbilityId,
  allyAbilityId,
  allAbilities,
  canChange,
  abilityChangeCount,
  isLobby = false
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
      // ロビー時は現在の選択(localStorage準拠)を、バトル時は装備中を優先
      const targetId = isLobby ? currentAbilityId : allyAbilityId;
      const idx = abilitiesList.findIndex(a => a.id === targetId);
      if (idx !== -1) setCurrentIndex(idx);
    }
  }, [isOpen, allyAbilityId, currentAbilityId, abilitiesList, isLobby]);

  if (!isOpen) return null;

  const N = abilitiesList.length;
  const spacing = 95;

  const handleDrag = (_: any, info: any) => {
    setDragX(info.offset.x);
  };

  const handleDragEnd = (_: any, info: any) => {
    const moveThreshold = 30;
    const velocityThreshold = 100;
    
    if (Math.abs(info.offset.x) > moveThreshold || Math.abs(info.velocity.x) > velocityThreshold) {
      const direction = info.offset.x > 0 ? -1 : 1;
      let nextIndex = currentIndex + direction;
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
  // ロビー時は選択中のIDを「現在の特性」として表示
  const displayAllyId = isLobby ? currentAbilityId : allyAbilityId;
  const allyAbilityInfo = allAbilities[displayAllyId] || { name: '---', description: '特性がありません' };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <motion.div 
        className={styles.modalBody} 
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
      >
        {/* 現在の特性表示セクション */}
        <div className={styles.statusSection}>
          <div className={styles.sideStatus}>
            <span className={styles.sideLabel}>{isLobby ? "せんたく中のとくせい" : "現在のとくせい"}</span>
            <div className={styles.currentAbilityName}>{allyAbilityInfo.name}</div>
            <div className={styles.currentAbilityDesc}>{allyAbilityInfo.description}</div>
          </div>
        </div>

        <div className={styles.divider}>
          <span>{isLobby ? "とくせいを選ぶ" : "タップしてとくせいを変える"}</span>
          {!isLobby && <span className={styles.remainCount}>(あと{abilityChangeCount}回)</span>}
        </div>
        
        {/* 選んでいる最中の情報表示 */}
        <div className={styles.infoSection}>
          <h3 className={styles.abilityNameDisplay}>{currentInfo.name}</h3>
          <p className={styles.abilityDescDisplay}>{currentInfo.description}</p>
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
              let diff = i - currentIndex;
              diff = diff - Math.round(diff / N) * N;
              const offsetIndex = diff + (dragX / spacing);
              const absDiff = Math.abs(offsetIndex);
              
              const x = offsetIndex * spacing;
              const y = absDiff * absDiff * 5; // カーブを深くして重なりを避ける
              const scale = Math.max(0.5, 1 - absDiff * 0.22);
              const opacity = Math.max(0, 1 - absDiff * 0.25);
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
