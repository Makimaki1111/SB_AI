import React, { useEffect, useRef, useState } from 'react';
import type { CharacterData } from '../../types';
import { getTypeImagePath } from '../../utils';
import './PlayerSlot.css';

interface PlayerSlotProps {
  data: CharacterData;
  isAlly: boolean;
  activeEffect?: 'damage' | 'heal' | 'stat_up' | 'stat_down' | null;
}

export const PlayerSlot: React.FC<PlayerSlotProps> = ({ data, isAlly, activeEffect }) => {
  const wordRef = useRef<HTMLDivElement>(null);
  const [wordScale, setWordScale] = useState(1);

  useEffect(() => {
    if (wordRef.current && data.currentWord) {
      const maxWidth = 110;
      const scrollWidth = wordRef.current.scrollWidth;
      if (scrollWidth > maxWidth) {
        setWordScale(maxWidth / scrollWidth);
      } else {
        setWordScale(1);
      }
    }
  }, [data.currentWord]);

  const hpRatio = data.maxHp > 0 ? (data.hp / data.maxHp) * 100 : 0;
  
  const getHPColor = () => {
    if (hpRatio > 50) return 'var(--hp-green)';
    if (hpRatio > 20) return 'var(--hp-yellow)';
    return 'var(--hp-red)';
  };

  return (
    <div className={`player-slot ${isAlly ? 'ally' : 'foe'} ${data.hp <= 0 ? 'defeated' : ''} ${data.animation || ''}`}>
      {data.currentWord && (
        <div 
          className="word-balloon"
          style={{ transform: `translateX(-50%) scaleX(${wordScale})` }}
        >
          <div ref={wordRef}>{data.currentWord}</div>
        </div>
      )}

      <div className={`sprite-container ${activeEffect === 'damage' ? 'damage-blink' : ''}`}>
        {data.types.map((type, idx) => (
          <img
            key={`${type}-${idx}`}
            src={getTypeImagePath(type)}
            alt={type}
            className={`type-gif ${idx === 1 ? 'secondary' : 'primary'}`}
          />
        ))}
      </div>

      <div className="status-box glass">
        <div className="name-line">
          <span>{data.name}</span>
          {data.isPoison && <span className="poison-tag">どく</span>}
        </div>
        <div className="hp-bar-container">
          <div 
            className="hp-bar-fill" 
            style={{ 
              width: `${Math.max(0, hpRatio)}%`, 
              backgroundColor: getHPColor() 
            }}
          />
        </div>
        <div className="hp-text">{data.hp}/{data.maxHp}</div>
      </div>
    </div>
  );
};
