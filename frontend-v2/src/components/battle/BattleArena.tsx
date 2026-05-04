import React from 'react';
import styles from './BattleArena.module.css';
import { HPBar } from './HPBar';
import { CharacterAvatar } from './CharacterAvatar';
import { WordDisplay } from './WordDisplay';
import { WordInput } from './WordInput';
import { BattleEffects } from './BattleEffects';
import { TYPE_TO_IMAGE } from '../../constants/game';
import type { BattleState, CharacterState } from '../../types/battle';

interface BattleArenaProps {
  battleState: BattleState | null;
  ally: CharacterState | null;
  foe: CharacterState | null;
  prediction: { include: boolean, type1?: string, type2?: string, used?: boolean, prediction?: string } | null;
  displayMessage: string | null;
  isProcessing: boolean;
  allyEffect: string | null;
  foeEffect: string | null;
  timer: { remaining: number; total: number };
  allyWord: string | null;
  foeWord: string | null;
  username: string;
  onSendWord: (word: string) => void;
  onSendIncludeCheck: (word: string) => void;
  onOpenSituation: () => void;
  onOpenAbility: () => void;
  onRunAway: () => void;
}

export const BattleArena: React.FC<BattleArenaProps> = ({
  battleState,
  ally,
  foe,
  prediction,
  displayMessage,
  isProcessing,
  allyEffect,
  foeEffect,
  timer,
  allyWord,
  foeWord,
  username,
  onSendWord,
  onSendIncludeCheck,
  onOpenSituation,
  onOpenAbility,
  onRunAway
}) => {
  return (
    <div className={styles.battleContainer}>
      <div className={styles.topImage}>
        <img src="/img/ground.jpg" className={styles.bgImage} alt="背景画像" />
        
        {/* 背景要素 (地面) */}
        <div className={`${styles.ellipse} ${styles.ellipseRight}`} />
        <div className={`${styles.ellipse} ${styles.ellipseLeft}`} />

        {/* 相手セクション */}
        <HPBar 
          hp={foe?.hp ?? 0} 
          maxHp={foe?.max_hp ?? 100} 
          name={foe?.name ?? "あいて"} 
          isPoison={foe?.is_poison ?? false}
          lives={foe?.lives ?? 0}
          maxLives={battleState?.foe_max_lives ?? 2}
          isAlly={false}
        />
        <CharacterAvatar 
          type={foe?.types[0] ?? "ノーマル"} 
          isAlly={false} 
          isBlinking={foeEffect === 'blink'}
        />
        <BattleEffects trigger={foeEffect} side="foe" />
        <WordDisplay word={foeWord} isAlly={false} />

        {/* 自分セクション */}
        <CharacterAvatar 
          type={ally?.types[0] ?? "ノーマル"} 
          isAlly={true} 
          isBlinking={allyEffect === 'blink'}
        />
        <BattleEffects trigger={allyEffect} side="ally" />
        <WordDisplay word={allyWord} isAlly={true} />
        <HPBar 
          hp={ally?.hp ?? 0} 
          maxHp={ally?.max_hp ?? 100} 
          name={username || ally?.name || "じぶん"} 
          isPoison={ally?.is_poison ?? false}
          lives={ally?.lives ?? 0}
          maxLives={battleState?.ally_max_lives ?? 2}
          isAlly={true}
        />
      </div>

      <div className={styles.content}>
        <div className={styles.actionArea}>
          <div className={styles.inputWrapper}>
            <div className={styles.timerContainer}>
              <div 
                className={styles.timerBar} 
                style={{ 
                  width: `${(timer.remaining / (timer.total || 1)) * 100}%`,
                  backgroundColor: timer.remaining > 10 ? '#00FF00' : timer.remaining > 5 ? '#FFFF00' : '#FF0000'
                }} 
              />
            </div>
            <WordInput 
              onSend={onSendWord} 
              onChange={onSendIncludeCheck}
              disabled={(battleState?.is_my_turn === false) || isProcessing || battleState?.status === 'finished'}
              initialChar={battleState?.character || ''}
            />
            {prediction && prediction.include && (
              <div className={styles.predictionContainer}>
                <div className={styles.predictionImages}>
                  {prediction.used ? (
                    <img src="/img/god.gif" alt="Used" className={styles.predictionImg} />
                  ) : (
                    <>
                      {prediction.type1 && <img src={`/img/${TYPE_TO_IMAGE[prediction.type1] || 'normal'}.gif`} alt="Type 1" className={styles.predictionImg} />}
                      {prediction.type2 && <img src={`/img/${TYPE_TO_IMAGE[prediction.type2] || 'normal'}.gif`} alt="Type 2" className={styles.predictionImg} />}
                    </>
                  )}
                </div>
                {prediction.prediction && <div className={styles.predictionMsg}>{prediction.prediction}</div>}
              </div>
            )}
            {displayMessage && (
              <div className={styles.messageOverlay}>
                {displayMessage}
              </div>
            )}
          </div>
        </div>

        <div className={styles.actionsWrapper}>
            <div 
              className={`${styles.actionBtn} ${styles.situationBtn}`} 
              onClick={onOpenSituation}
            >
              <svg className={styles.actionBtnIcon} viewBox="0 0 24 24">
                <path d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10,0,0,0,2,12A10,10,0,0,0,12,22A10,10,0,0,0,22,12A10,10,0,0,0,12,2Z" />
              </svg>
              <span className={styles.actionBtnText}>状況</span>
            </div>
            <div 
              className={`${styles.actionBtn} ${styles.abilityBtn}`}
              onClick={onOpenAbility}
            >
              <svg className={styles.actionBtnIcon} viewBox="0 0 24 24">
                <path d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z" />
              </svg>
              <span className={styles.actionBtnText}>特性</span>
            </div>
        </div>

        <div className={styles.footerArea}>
          <button 
            className={styles.cancelBattleBtn}
            onClick={onRunAway}
          >
            にげる
          </button>
        </div>
      </div>
    </div>
  );
};
