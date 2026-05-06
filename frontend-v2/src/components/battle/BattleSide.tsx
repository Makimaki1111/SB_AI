import React from 'react';
import { HPBar } from './HPBar';
import { CharacterAvatar } from './CharacterAvatar';
import { WordDisplay } from './WordDisplay';
import { BattleEffects } from './BattleEffects';
import type { CharacterState } from '../../types/battle';

interface BattleSideProps {
  character: CharacterState | null;
  isAlly: boolean;
  effect: string | null;
  word: string | null;
  isKnockout: boolean;
  name: string;
}

export const BattleSide: React.FC<BattleSideProps> = ({
  character,
  isAlly,
  effect,
  word,
  isKnockout,
  name
}) => {
  const hpBar = (
    <HPBar 
      hp={character?.hp ?? 0} 
      maxHp={character?.max_hp ?? 100} 
      name={name} 
      isPoison={character?.is_poison ?? false}
      isAlly={isAlly}
    />
  );

  const avatar = (
    <CharacterAvatar 
      types={character?.types || []} 
      isAlly={isAlly} 
      isBlinking={effect === 'blink'}
      isKnockout={isKnockout}
    />
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
