import React from 'react';
import { WordDisplay } from '../WordDisplay';
import { BattleEffects } from '../BattleEffects';
import styles from './DoubleBattleSide.module.css';
import type { CharacterState } from '../../../types/battle';

// 既存の TYPE_TO_IMAGE 定数
const TYPE_TO_IMAGE: Record<string, string> = {
  "ノーマル": "normal", "感情": "emote", "食べ物": "food", "植物": "plant",
  "社会": "society", "時間": "time", "工作": "work", "芸術": "art",
  "機械": "mech", "遊び": "play", "暴力": "violence", "服飾": "cloth",
  "動物": "animal", "地名": "place", "人物": "person", "人体": "body",
  "理科": "science", "暴言": "insult", "虫": "bug", "数学": "math",
  "医療": "health", "宗教": "religion", "スポーツ": "sports", "物語": "tale",
  "天気": "weather"
};

interface DoubleBattleSideProps {
  characters: CharacterState[];
  isAlly: boolean;
  effect: string | null;
  knockoutStates: Record<string, boolean>;
}

/**
 * 既存のデザインを維持したダブルバトル用キャラクター配置
 */
export const DoubleBattleSide: React.FC<DoubleBattleSideProps> = ({
  characters,
  isAlly,
  effect,
  knockoutStates
}) => {
  return (
    <div className={`${styles.teamContainer} ${isAlly ? styles.ally : styles.foe}`}>
      {/* チーム全体の足元の影 */}
      <div className={styles.doubleEllipse} />
      
      {characters.map((char, index) => {
        const isKnockout = char.id ? knockoutStates[char.id] : false;
        
        return (
          <div key={char.id || index} className={styles.charWrapper}>
            {char.types?.map((type, tIndex) => (
              <img 
                key={tIndex}
                src={`/img/${TYPE_TO_IMAGE[type] || 'normal'}.gif`}
                className={`${styles.sprite} ${tIndex > 0 ? styles.type2 : ''}`}
                style={{ opacity: isKnockout ? 0.3 : 1 }}
                alt={char.name}
              />
            ))}

            <div className={styles.effectsContainer}>
              <BattleEffects 
                trigger={effect} 
                side={isAlly ? "ally" : "foe"} 
              />
            </div>

            <div className={styles.wordWrapper}>
              <WordDisplay 
                word={char.word || null} 
                isAlly={isAlly}
                isBlinking={effect === 'blink'} 
                isKnockout={isKnockout}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
