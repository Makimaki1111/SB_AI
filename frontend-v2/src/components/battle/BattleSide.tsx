import React from 'react';
import { HPBar } from './HPBar';
import { CharacterAvatar } from './CharacterAvatar';
import { WordDisplay } from './WordDisplay';
import { BattleEffects } from './BattleEffects';
import type { CharacterState } from '../../types/battle';

import styles from './BattleSide.module.css';

interface BattleSideProps {
  character: CharacterState | null;
  isAlly: boolean;
  effect: string | null;
  word: string | null;
  isKnockout: boolean;
  name: string;
  isSelected?: boolean;
  isCurrentTurn?: boolean;
  isDouble?: boolean;
  onSelectTarget?: () => void;
}

export const BattleSide: React.FC<BattleSideProps> = ({
  character,
  isAlly,
  effect,
  word,
  isKnockout,
  name,
  isSelected,
  isCurrentTurn,
  isDouble,
  onSelectTarget
}) => {
  const hpBar = (
    <HPBar 
      hp={character?.hp ?? 0} 
      maxHp={character?.max_hp ?? 100} 
      name={name} 
      isPoison={character?.is_poison ?? false}
      isAlly={isAlly}
      isWaiting={!character}
      isDouble={isDouble}
    />
  );

  const avatar = (
    <div 
      className={`${styles.avatarWrapper} ${isSelected ? styles.selected : ''} ${isCurrentTurn ? styles.activeTurn : ''}`}
      onClick={!isAlly && !isKnockout ? onSelectTarget : undefined}
      style={{ cursor: (!isAlly && !isKnockout) ? 'pointer' : 'default' }}
    >
      <CharacterAvatar 
        types={character?.types || []} 
        isAlly={isAlly} 
        isBlinking={effect === 'blink'}
        isKnockout={isKnockout}
      />
      {isSelected && <div className={styles.targetMarker} />}
    </div>
  );

  const effects = <BattleEffects trigger={effect} side={isAlly ? "ally" : "foe"} />;
  const wordDisplay = <WordDisplay word={word} isAlly={isAlly} isBlinking={effect === 'blink'} isKnockout={isKnockout} />;

  return (
    <>
      {isAlly ? (
        <>
          {avatar}
          {effects}
          {wordDisplay}
          {hpBar}
        </>
      ) : (
        <>
          {hpBar}
          {avatar}
          {effects}
          {wordDisplay}
        </>
      )}
    </>
  );
};
