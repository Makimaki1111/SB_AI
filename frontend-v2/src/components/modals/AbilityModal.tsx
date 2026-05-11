import React, { useState, useRef, useMemo } from 'react';
import styles from './AbilityModal.module.css';
import { TYPE_TO_IMAGE } from '../../constants/game';
import type { AbilityData, CharacterState } from '../../types/battle';
import { motion, type PanInfo } from 'framer-motion';
import SoundManager from '../../utils/SoundManager';


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
  allies?: CharacterState[];
  targetAbilityIndex?: number;
  setTargetAbilityIndex?: (index: number) => void;
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
  isLobby = false,
  allies = [],
  targetAbilityIndex = 0,
  setTargetAbilityIndex
}) => {
  const abilitiesList = useMemo(() => {
    return Object.entries(allAbilities)
      .filter(([id]) => id !== 'secret')
      .map(([id, info]) => ({ id, ...info }));
  }, [allAbilities]);

  const isDouble = allies.length > 1;

  const initialIndex = Math.max(
    0,
    abilitiesList.findIndex(a => a.id === (isLobby ? currentAbilityId : allyAbilityId))
  );
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  // タブが切り替わったりモーダルが開かれた時に currentIndex をリセットする
  React.useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line
      setCurrentIndex(Math.max(0, abilitiesList.findIndex(a => a.id === (isLobby ? currentAbilityId : allyAbilityId))));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, targetAbilityIndex, currentAbilityId, allyAbilityId, abilitiesList, isLobby]);

  const [dragX, setDragX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const N = abilitiesList.length;
  const spacing = 95;

  const handleDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setDragX(info.offset.x);
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const moveThreshold = 20;
    const velocityThreshold = 100;
    
    // ドラッグ距離に応じて移動するインデックス数を計算 (1つ以上飛ばせるように)
    const dragDistance = info.offset.x;
    const velocity = info.velocity.x;

    if (Math.abs(dragDistance) > moveThreshold || Math.abs(velocity) > velocityThreshold) {
      // 距離を spacing で割って何個分移動するか決める
      const itemsToMove = Math.round(dragDistance / spacing);
      
      let nextIndex: number;
      if (itemsToMove !== 0) {
        nextIndex = currentIndex - itemsToMove;
      } else {
        // 距離が足りなくても速度があれば1つ動かす
        const direction = velocity > 0 ? -1 : 1;
        nextIndex = currentIndex + direction;
      }

      // 範囲内に収める (循環)
      if (N > 0) {
        nextIndex = ((nextIndex % N) + N) % N;
        setCurrentIndex(nextIndex);
      }
    }
    setDragX(0);
  };

  const handleItemClick = (index: number) => {
    if (!canChange || N === 0) return;
    if (index !== currentIndex) SoundManager.play('pera');
    setCurrentIndex(index);
  };

  const handleConfirm = () => {
    SoundManager.play('pera');
    if (canChange && N > 0) {
      onSelect(abilitiesList[currentIndex].id);
    }
    onClose();
  };

  const handleClose = () => {
    SoundManager.play('pera');
    onClose();
  };

  const currentInfo = useMemo(() => {
    if (N === 0) return { id: '', name: '---', description: '', icon_type: 'normal' };
    // ドラッグ中も含めた「現在一番前に来ている」インデックスを計算
    const shift = Math.round(dragX / spacing);
    const idx = currentIndex - shift;
    const activeIdx = ((idx % N) + N) % N;
    return abilitiesList[activeIdx] || { id: '', name: '---', description: '', icon_type: 'normal' };
  }, [dragX, currentIndex, N, spacing, abilitiesList]);

  // ロビー時は選択中のIDを「現在の特性」として表示
  const displayAllyId = isLobby ? currentAbilityId : allyAbilityId;
  const allyAbilityInfo = allAbilities[displayAllyId] || { name: '---', description: '特性がありません' };

  // 同じ特性を選んでいるかどうか
  const isSameAbility = currentInfo.id === displayAllyId;

  // 本家再現の色設定
  const modalBgColor = useMemo(() => {
    if (!isDouble) return 'rgba(255, 255, 255, 0.95)';
    // 本家 double_UI.js 848-850行目の仕様
    return targetAbilityIndex === 0 
      ? 'rgba(255, 220, 220, 0.95)' // 味方A (薄い赤)
      : 'rgba(220, 235, 255, 0.95)'; // 味方B (薄い青)
  }, [isDouble, targetAbilityIndex]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <motion.div 
        className={styles.modalBody} 
        style={{ background: modalBgColor }} // ここで本家の色を適用
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
      >
        {isDouble && (
          <div className={styles.tabsContainer}>
            {allies.map((a, idx) => (
              <button
                key={a.id || a.name || idx}
                className={`${styles.tabBtn} ${idx === targetAbilityIndex ? styles.activeTab : ''}`}
                onClick={() => {
                  SoundManager.play('pera');
                  if (setTargetAbilityIndex) setTargetAbilityIndex(idx);
                }}
              >
                {a.name || `味方${idx + 1}`}
              </button>
            ))}
          </div>
        )}

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
            onPan={handleDrag}
            onPanEnd={handleDragEnd}
          >
            {abilitiesList.map((ab, i) => {
              let diff = i - currentIndex;
              diff = diff - Math.round(diff / N) * N;
              const offsetIndex = diff + (dragX / spacing);
              const absDiff = Math.abs(offsetIndex);
              
              const x = offsetIndex * spacing;
              const y = absDiff * absDiff * 2.5; // 5から2.5に減らして高さを安定させる
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
          <button className={styles.closeBtn} onClick={handleClose}>とじる</button>
          <button 
            className={`${styles.decideBtn} ${!canChange ? styles.disabled : ''}`}
            onClick={handleConfirm}
            disabled={!canChange}
          >
            {!canChange ? '変更不可' : isSameAbility ? 'そのまま' : '決定'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
