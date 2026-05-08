import { CharacterAvatar } from './CharacterAvatar';
import { WordDisplay } from './WordDisplay';
import { BattleEffects } from './BattleEffects';
import type { CharacterState } from '../../types/battle';
import styles from './DoubleBattleSide.module.css';

interface DoubleBattleSideProps {
  characters: CharacterState[];
  isAlly: boolean;
  effect: string | null;
  knockoutStates: Record<string, boolean>;
}

/**
 * ダブルバトル専用の表示コンポーネント
 * 2体のキャラクターを奥行き（前後）を持たせて配置します。
 */
export const DoubleBattleSide: React.FC<DoubleBattleSideProps> = ({
  characters,
  isAlly,
  effect,
  knockoutStates
}) => {
  if (characters.length === 0) return null;

  // 奥のキャラ (A) と 手前のキャラ (B)
  const charA = characters[0];
  const charB = characters[1];

  const renderCharacter = (char: CharacterState | undefined, isFront: boolean) => {
    if (!char) return null;
    const isKO = knockoutStates[char.id || ''] || char.hp <= 0;

    return (
      <div className={`${styles.charWrapper} ${isFront ? styles.front : styles.back}`}>
        <CharacterAvatar
          types={char.types || []}
          isAlly={isAlly}
          isBlinking={effect === 'blink'}
          isKnockout={isKO}
        />
      </div>
    );
  };

  return (
    <div className={`${styles.teamContainer} ${isAlly ? styles.ally : styles.foe}`}>
      {/* 影 (エリップス) をコンテナ内に配置 */}
      <div className={styles.doubleEllipse} id={isAlly ? "ellipse-ally" : "ellipse-enemy"} />

      {/* 奥のキャラを先に描画 */}
      {renderCharacter(charA, false)}
      {/* 手前のキャラを後に描画 (z-index) */}
      {renderCharacter(charB, true)}

      <div className={styles.effectsContainer}>
        <BattleEffects trigger={effect} side={isAlly ? "ally" : "foe"} />
      </div>

      {/* 単語表示 (各キャラクターごとに描画) */}
      {characters.map((char, index) => (
        <div
          key={`word-${char?.id || index}`}
          className={`${styles.wordContainer} ${index === 1 ? styles.front : styles.back}`}
        >
          {char?.lastWord && (
            <WordDisplay word={char.lastWord} isAlly={isAlly} isBlinking={effect === 'blink'} isKnockout={false} />
          )}
        </div>
      ))}
    </div>
  );
};
