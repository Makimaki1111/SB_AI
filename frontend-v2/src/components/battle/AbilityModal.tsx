import React, { useState, useEffect } from 'react';
import styles from './AbilityModal.module.css';
import { TYPE_TO_IMAGE } from '../../constants/gameConstants';
import { AbilityData } from '../../types/battle';

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
