import React, { useState, useRef, useMemo } from 'react';
import styles from './AbilityModal.module.css';
import { TYPE_TO_IMAGE } from '../../constants/game';
import type { AbilityData, CharacterState } from '../../types/battle';
import { motion, type PanInfo, useMotionValue, useSpring, useMotionValueEvent } from 'framer-motion';
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

  // 表示上の「現在の位置（インデックス単位）」を管理
  // useSpring を使うことで、インデックスの切り替えが滑らか（円周状）になる
  const scrollIndex = useMotionValue(initialIndex);
  const smoothIndex = useSpring(scrollIndex, { stiffness: 400, damping: 40 });

  // タブが切り替わったりモーダルが開かれた時に位置をリセット
  React.useEffect(() => {
    if (isOpen) {
      const idx = Math.max(0, abilitiesList.findIndex(a => a.id === (isLobby ? currentAbilityId : allyAbilityId)));
      setCurrentIndex(idx);
      scrollIndex.set(idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, targetAbilityIndex, currentAbilityId, allyAbilityId, abilitiesList, isLobby]);

  const containerRef = useRef<HTMLDivElement>(null);

  const N = abilitiesList.length;
  const spacing = 85;

  const handleDrag = (_: any, info: PanInfo) => {
    // 現在のターゲットインデックスから、ドラッグ分を引いた位置をリアルタイムにセット
    scrollIndex.set(currentIndex - info.offset.x / spacing);
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    const { velocity, offset } = info;
    const power = 0.15;
    const projectedDistance = offset.x + velocity.x * power;
    const itemsToMove = Math.round(projectedDistance / spacing);

    // 目標の「相対的な」インデックス
    const targetIndex = currentIndex - itemsToMove;

    if (N > 0) {
      // 音声フィードバック用の判定
      const nextIndexNormalized = ((targetIndex % N) + N) % N;
      if (nextIndexNormalized !== currentIndex) SoundManager.play('pera');

      // 内部的なターゲットを更新
      setCurrentIndex(targetIndex);
      // スプリングの目標値をセット（正規化しないことで、逆戻りを防ぐ）
      scrollIndex.set(targetIndex);
    }
  };

  const handleItemClick = (index: number) => {
    if (N === 0) return;

    // 現在の scrollIndex に最も近い「表示上の index」を探してセットする
    const currentScroll = scrollIndex.get();
    // JavaScript の % は負の数で負を返すため、正規化する
    const normalizedCurrent = ((currentScroll % N) + N) % N;

    let diff = index - normalizedCurrent;
    if (diff > N / 2) diff -= N;
    if (diff < -N / 2) diff += N;

    const target = currentScroll + diff;

    SoundManager.play('pera');
    setCurrentIndex(target);
    scrollIndex.set(target);

  };



  const handleConfirm = () => {
    SoundManager.play('concent');
    if (canChange && N > 0) {
      const normalizedIndex = ((currentIndex % N) + N) % N;
      onSelect(abilitiesList[normalizedIndex].id);
    }
    onClose();
  };

  const handleClose = () => {
    SoundManager.play('pera');
    onClose();
  };

  // 表示上の現在のインデックス（実数）を管理し、毎フレームの更新を検知して再描画させる
  const [displayIndex, setDisplayIndex] = useState(initialIndex);
  useMotionValueEvent(smoothIndex, "change", (latest: number) => {
    setDisplayIndex(latest);
  });

  const currentInfo = useMemo(() => {
    if (N === 0) return { id: '', name: '---', description: '', icon_type: 'normal' };
    // 現在一番前に来ているインデックスを計算（四捨五入）
    const idx = Math.round(displayIndex);
    const activeIdx = ((idx % N) + N) % N;
    return abilitiesList[activeIdx] || { id: '', name: '---', description: '', icon_type: 'normal' };
  }, [displayIndex, N, abilitiesList]);

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
          <span className={styles.sideLabel}>{isLobby ? "せんたく中のとくせい" : "現在のとくせい"}</span>
          <div className={styles.sideStatus}>
            <h3 className={styles.currentAbilityName}>{allyAbilityInfo.name}</h3>
            <p className={styles.currentAbilityDesc}>{allyAbilityInfo.description}</p>
          </div>
        </div>

        <div className={styles.countBanner}>
          {!isLobby && (
            <span className={styles.remainCount}>残り変更可能回数: {abilityChangeCount}回</span>
          )}
        </div>

        {/* 円弧状カルーセル */}
        <div className={styles.carouselContainer} ref={containerRef}>
          <motion.div
            className={styles.carouselTrack}
            onPan={handleDrag}
            onPanEnd={handleDragEnd}
          >
            {abilitiesList.map((ab, i) => {
              // smoothIndex (表示上の現在地) と i の差から、円周上の位置を計算
              let diff = i - displayIndex;
              diff = diff - Math.round(diff / N) * N;

              // 円周軌道の計算 (半径 1500px で以前のゆるやかさを再現)
              const radius = 1500;
              const anglePerItem = 85 / radius; // 間隔を 85px に保つための角度
              const angle = diff * anglePerItem;

              const x = radius * Math.sin(angle);
              const y = radius * (1 - Math.cos(angle));

              const absDiff = Math.abs(diff);
              const scale = Math.max(0.6, 1 - absDiff * 0.15);
              const opacity = Math.max(0, 1 - absDiff * 0.2);
              const zIndex = Math.round(100 - absDiff);

              const iconName = TYPE_TO_IMAGE[ab.icon_type] || 'normal';

              const normalizedCurrent = ((currentIndex % N) + N) % N;

              return (
                <motion.div
                  key={ab.id}
                  className={`${styles.carouselItem} ${i === normalizedCurrent ? styles.selected : ''}`}
                  style={{
                    x: `calc(-50% + ${x}px)`,
                    y: `calc(-50% + ${y}px)`,
                    scale,
                    opacity,
                    zIndex
                  }}
                  onClick={() => handleItemClick(i)}
                >
                  <img src={`/img/${iconName}.gif`} alt={ab.name} draggable="false" />
                </motion.div>
              );
            })}

          </motion.div>
        </div>

        {/* 変更後の特性表示セクション */}
        <div className={styles.infoSection}>
          <span className={styles.sideLabel} style={{ color: '#ff9800' }}>変更後のとくせい</span>
          <div className={styles.sideStatus}>
            <h3 className={styles.abilityNameDisplay}>{currentInfo.name}</h3>
            <p className={styles.abilityDescDisplay}>{currentInfo.description}</p>
          </div>
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
