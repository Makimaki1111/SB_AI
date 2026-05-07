import React from 'react';
import styles from './DoubleBattleArena.module.css';
import { DoubleHPBar } from './DoubleHPBar';
import type { CharacterState } from '../../types/battle';

interface DoubleTeamStatusProps {
  characters: CharacterState[];
  isAlly: boolean;
  side: 'left' | 'right';
  playerNames?: Record<string, string>;
}

export const DoubleTeamStatus: React.FC<DoubleTeamStatusProps> = ({
  characters,
  isAlly,
  side,
  playerNames = {}
}) => {
  // 吹き出しのクラス (legacy: balloon right/left)
  const balloonClass = side === 'left' ? "balloon left" : "balloon right";
  
  return (
    <div className={`${balloonClass} ${styles.doubleBalloon}`} style={{ 
      position: 'absolute',
      top: side === 'right' ? '5%' : 'auto',
      bottom: side === 'left' ? '25%' : 'auto',
      [side === 'right' ? 'left' : 'right']: '5%',
      zIndex: 20
    }}>
      <div className={styles.teamInfo}>
        {characters.map((char, index) => {
          const charId = char.id || (isAlly ? `p1${index === 0 ? 'a' : 'b'}` : `p2${index === 0 ? 'a' : 'b'}`);
          const name = playerNames[charId] || char.name;
          
          return (
            <div key={charId} className={styles.memberInfo}>
              <div className={styles.memberName}>
                {name}
                {char.is_poison && <span style={{ color: '#e91e63', marginLeft: '4px', fontSize: '0.8em' }}>[毒]</span>}
              </div>
              <div className={styles.doubleHpBox}>
                <DoubleHPBar 
                  hp={char.hp} 
                  maxHp={char.max_hp} 
                  isPoison={char.is_poison}
                  isAlly={isAlly}
                />
              </div>
              <div className={styles.doubleHpText}>
                {char.hp}/{char.max_hp}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
