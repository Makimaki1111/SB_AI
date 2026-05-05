import React from 'react';
import styles from './CharacterAvatar.module.css';
import { TYPE_TO_IMAGE } from '../../constants/game';
import { motion, AnimatePresence } from 'framer-motion';

interface CharacterAvatarProps {
  types: string[]; // 複数タイプに対応
  isAlly: boolean;
  isBlinking?: boolean;
  isKnockout?: boolean;
}

/**
 * キャラクターアバター (タイプ画像) コンポーネント。
 * 本家同様、複合タイプの場合は2つの画像を並べて表示する。
 */
export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({ 
  types = [], 
  isAlly, 
  isBlinking,
  isKnockout 
}) => {
  // 表示するタイプを確定 (空ならノーマル)
  const displayTypes = types.length > 0 ? types.filter(t => t) : ['ノーマル'];
  const isDual = displayTypes.length >= 2;

  return (
    <AnimatePresence>
      {!isKnockout && (
        <motion.div 
          className={`${styles.avatarGroup} ${isAlly ? styles.allyGroup : styles.foeGroup} ${isBlinking ? styles.blinking : ''}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ duration: 0.6 }}
        >
          {displayTypes.map((type, index) => {
            const iconName = TYPE_TO_IMAGE[type] || 'normal';
            const imageUrl = `/img/${iconName}.gif`;
            
            // 複合タイプ時の個別配置クラス
            const positionClass = isDual 
              ? (index === 0 ? styles.type1 : styles.type2) 
              : styles.single;

            return (
              <div key={`${type}-${index}`} className={`${styles.iconContainer} ${positionClass}`}>
                <img 
                  src={imageUrl} 
                  alt={type} 
                  className={styles.avatarImg} 
                  onError={(e) => {
                    console.error(`❌ Failed to load avatar image: ${imageUrl} for type: ${type}`);
                    e.currentTarget.src = '/img/normal.gif';
                  }}
                  onLoad={() => {
                    console.log(`✅ Loaded avatar: ${imageUrl} for ${isAlly ? 'ally' : 'foe'} (type: ${type})`);
                  }}
                />
              </div>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
