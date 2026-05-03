import React, { useState, useEffect } from 'react';
import styles from './AbilityModal.module.css';

const TYPE_TO_IMAGE: Record<string, string> = {
  "ノーマル": "normal", "感情": "emote", "食べ物": "food", "植物": "plant",
  "社会": "society", "時間": "time", "工作": "work", "芸術": "art",
  "機械": "mech", "遊び": "play", "暴力": "violence", "服飾": "cloth",
  "動物": "animal", "地名": "place", "人物": "person", "人体": "body",
  "理科": "science", "暴言": "insult", "虫": "bug", "数学": "math",
  "医療": "health", "宗教": "religion", "スポーツ": "sports",
  "物語": "tale", "天気": "weather"
};

interface AbilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (abilityId: string) => void;
  currentAbilityId: string;
  allAbilities: Record<string, any>;
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
  const [localSelectedId, setLocalSelectedId] = useState(currentAbilityId);
  const [displayDesc, setDisplayDesc] = useState("");

  useEffect(() => {
    if (isOpen) {
      setLocalSelectedId(currentAbilityId);
      const info = allAbilities[currentAbilityId];
      setDisplayDesc(info ? info.desc || info.description : "ランダムに決定されます");
    }
  }, [isOpen, currentAbilityId, allAbilities]);

  if (!isOpen) return null;

  const handleSelect = (id: string, desc: string) => {
    if (!canChange) return;
    setLocalSelectedId(id);
    setDisplayDesc(desc);
  };

  const handleConfirm = () => {
    onSelect(localSelectedId);
    onClose();
  };

  const getIconPath = (id: string, info: any) => {
    if (id === 'random' || id === '') return '/img/unaware.gif';
    const gifName = TYPE_TO_IMAGE[info.icon_type] || 'normal';
    return `/img/${gifName}.gif`;
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalBody} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>とくせいを選択</h2>
        
        <div className={styles.descriptionArea}>
          <div className={styles.descriptionBox}>
            {displayDesc}
          </div>
        </div>

        <div className={styles.abilityGrid}>
          {/* ランダム */}
          <div 
            className={`${styles.gridItem} ${localSelectedId === 'random' || localSelectedId === '' ? styles.selected : ""}`}
            onClick={() => handleSelect('random', 'ランダムに決定されます')}
          >
            <img src="/img/unaware.gif" className={styles.abilityIcon} alt="" />
            <div className={styles.abilityName}>
              <span>ランダム</span>
            </div>
          </div>

          {/* 各特性 */}
          {Object.entries(allAbilities).map(([id, info]: [string, any]) => (
            <div 
              key={id}
              className={`${styles.gridItem} ${localSelectedId === id ? styles.selected : ""}`}
              onClick={() => handleSelect(id, info.desc || info.description)}
            >
              <img src={getIconPath(id, info)} className={styles.abilityIcon} alt="" />
              <div className={styles.abilityName}>
                <span>{info.name}</span>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <button 
            className={styles.decideBtn}
            onClick={handleConfirm}
          >
            決定
          </button>
        </div>
      </div>
    </div>
  );
};
