import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

  const abilities = Object.entries(allAbilities)
    .filter(([id]) => id !== 'secret')
    .map(([id, info]) => ({ id, ...info }));

  useEffect(() => {
    if (isOpen) {
      setLocalSelectedId(currentAbilityId);
      const info = allAbilities[currentAbilityId];
      setDisplayDesc(info ? info.description : "ランダムに決定されます");
    }
  }, [isOpen, currentAbilityId, allAbilities]);

  if (!isOpen) return null;

  const handleSelect = (id: string, desc: string) => {
    setLocalSelectedId(id);
    setDisplayDesc(desc);
    // 音声再生（オプション）
  };

  return (
    <AnimatePresence>
      <div className={styles.overlay}>
        <motion.div 
          className={styles.modalWrapper}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
        >
          <h3 className={styles.modalTitle}>とくせいを選択</h3>
          
          <div className={styles.descriptionBox}>
            {displayDesc}
          </div>

          <div className={styles.abilitiesList}>
            {/* ランダム */}
            <div 
              className={`${styles.skillItem} ${localSelectedId === "" ? styles.selected : ""}`}
              onClick={() => handleSelect("", "ランダムに決定されます")}
            >
              <img src="/img/unaware.gif" className={styles.skillIcon} alt="" />
              <br />
              <span className={styles.skillName}>ランダム</span>
            </div>

            {/* 各特性 */}
            {abilities.map((ab) => {
              const iconName = TYPE_TO_IMAGE[ab.icon_type] || 'normal';
              return (
                <div 
                  key={ab.id}
                  className={`${styles.skillItem} ${localSelectedId === ab.id ? styles.selected : ""}`}
                  onClick={() => handleSelect(ab.id, ab.description)}
                >
                  <img src={`/img/${iconName}.gif`} className={styles.skillIcon} alt="" />
                  <br />
                  <span className={styles.skillName}>{ab.name}</span>
                </div>
              );
            })}
          </div>

          <button 
            className={styles.decideBtn}
            onClick={() => {
              onSelect(localSelectedId);
              onClose();
            }}
          >
            決定
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
