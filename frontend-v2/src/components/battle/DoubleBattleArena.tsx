import React from 'react';
import styles from './DoubleBattleArena.module.css';
import { WordInput } from './WordInput';
import { CharacterAvatar } from './CharacterAvatar';
import { WordDisplay } from './WordDisplay';
import { BattleEffects } from './BattleEffects';
import { DoubleTeamStatus } from './DoubleTeamStatus';
import type { BattleState, CharacterState } from '../../types/battle';

interface DoubleBattleArenaProps {
  battleState: BattleState | null;
  allyTeam: CharacterState[];
  foeTeam: CharacterState[];
  prediction: { include: boolean, type1?: string, type2?: string, used?: boolean, prediction?: string, predictions?: Record<string, string> } | null;
  messageLog: { text: string | null, isOpen: boolean };
  notification: string | null;
  waitMessage: string | null;
  isProcessing: boolean;
  characterEffects: Record<string, string | null>;
  characterWords: Record<string, string | null>;
  knockoutStates: Record<string, boolean>;
  timer: { remaining: number; total: number };
  username: string;
  selectedTargetId: string | null;
  onTargetSelect: (id: string) => void;
  onSendWord: (word: string) => void;
  onSendIncludeCheck: (word: string) => void;
  onOpenSituation: () => void;
  onOpenAbility: () => void;
  onRunAway: () => void;
}

export const DoubleBattleArena: React.FC<DoubleBattleArenaProps> = ({
  battleState,
  allyTeam,
  foeTeam,
  prediction,
  messageLog,
  notification,
  waitMessage,
  isProcessing,
  characterEffects,
  characterWords,
  knockoutStates,
  timer,
  selectedTargetId,
  onTargetSelect,
  onSendWord,
  onSendIncludeCheck,
  onOpenSituation,
  onOpenAbility,
  onRunAway
}) => {

  const renderCharacter = (char: CharacterState, isAlly: boolean) => {
    const uiId = char.id || "";
    const isTargeted = uiId === selectedTargetId;
    const effect = characterEffects[uiId] || null;
    const word = characterWords[uiId] || null;
    const isKnockout = knockoutStates[uiId] || false;
    
    // 位置用のクラス決定
    let posClass = "";
    if (uiId === 'p1a') posClass = styles.p1aWrapper;
    else if (uiId === 'p1b') posClass = styles.p1bWrapper;
    else if (uiId === 'p2a') posClass = styles.p2aWrapper;
    else if (uiId === 'p2b') posClass = styles.p2bWrapper;

    return (
      <div 
        key={uiId} 
        className={`${styles.charWrapper} ${posClass} ${isTargeted ? styles.targeted : ''}`}
        onClick={() => !isAlly && onTargetSelect(uiId)}
        style={{ cursor: isAlly ? 'default' : 'pointer' }}
      >
        <CharacterAvatar 
          types={char.types} 
          isAlly={isAlly} 
          isBlinking={effect === 'blink'}
          isKnockout={isKnockout}
        />
        <BattleEffects trigger={effect} side={isAlly ? "ally" : "foe"} />
        <WordDisplay word={word} isAlly={isAlly} isBlinking={effect === 'blink'} isKnockout={isKnockout} />
      </div>
    );
  };

  return (
    <div className={styles.battleContainer}>
      <div className={styles.topImage}>
        <img src="/img/ground.jpg" className={styles.bgImage} alt="背景画像" />
        
        {/* 相手サイド */}
        <div className={`${styles.doubleCharContainer} ${styles.topRight}`}>
          <div className={`${styles.doubleEllipse} ${styles.ellipseEnemy}`}></div>
          {foeTeam.map(char => renderCharacter(char, false))}
        </div>
        <DoubleTeamStatus characters={foeTeam} isAlly={false} side="right" />

        {/* 自分サイド */}
        <div className={`${styles.doubleCharContainer} ${styles.bottomLeft}`}>
          <div className={`${styles.doubleEllipse} ${styles.ellipseAlly}`}></div>
          {allyTeam.map(char => renderCharacter(char, true))}
        </div>
        <DoubleTeamStatus characters={allyTeam} isAlly={true} side="left" />

        {notification && (
          <div className={styles.toastNotification}>
            {notification}
          </div>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.actionArea}>
          {messageLog.isOpen && (
            <div className={styles.messageOverlay}>
              {messageLog.text}
            </div>
          )}

          {battleState && (
            <div className={styles.timerContainer}>
              <div 
                className={styles.timerBar} 
                style={{ 
                  width: `${(timer.remaining / timer.total) * 100}%`,
                  backgroundColor: timer.remaining / timer.total < 0.3 ? '#ff4757' : timer.remaining / timer.total < 0.6 ? '#ffa502' : '#2ed573'
                }} 
              />
            </div>
          )}

          <div className={styles.inputWrapper}>
            {battleState?.is_my_turn && (
              <WordInput 
                onSend={onSendWord} 
                onChange={onSendIncludeCheck}
                disabled={isProcessing}
                initialChar={battleState.character || ""}
              />
            )}
            {prediction?.include && (
              <div className={styles.predictionContainer}>
                <div className={styles.predictionImages}>
                  {prediction.used ? (
                    <img src="/img/god.gif" className={styles.predictionImg} alt="既出" />
                  ) : (
                    <>
                      {prediction.type1 && (
                        <img 
                          src={`/img/${prediction.type1}.gif`} 
                          className={`${styles.predictionImg} ${styles.type1}`} 
                          alt={prediction.type1} 
                        />
                      )}
                      {prediction.type2 && (
                        <img 
                          src={`/img/${prediction.type2}.gif`} 
                          className={`${styles.predictionImg} ${styles.type2}`} 
                          alt={prediction.type2} 
                        />
                      )}
                      {!prediction.type1 && !prediction.type2 && (
                        <img src="/img/unaware.gif" className={styles.predictionImg} alt="不明" />
                      )}
                    </>
                  )}
                </div>
                {/* ターゲット別の予測メッセージ表示 */}
                {selectedTargetId && prediction.predictions?.[selectedTargetId] && (
                  <div className={styles.predictionMsg}>
                    {prediction.predictions[selectedTargetId]}
                  </div>
                )}
              </div>
            )}
            {waitMessage && <p className={styles.waitMessage}>{waitMessage}</p>}
          </div>

          {/* ターゲット選択UI */}
          {battleState?.is_my_turn && (
            <div className={styles.targetSelectionUi}>
              <span className={styles.targetLabel}>ターゲット:</span>
              {foeTeam.map((char, index) => {
                const uiId = char.id || `p2${index === 0 ? 'a' : 'b'}`;
                const isSelected = uiId === selectedTargetId;
                const isAlive = char.hp > 0;
                return (
                  <button 
                    key={uiId}
                    className={`${styles.targetBtn} ${isSelected ? styles.selected : ''}`}
                    onClick={() => onTargetSelect(uiId)}
                    disabled={!isAlive}
                  >
                    あいて{index === 0 ? 'A' : 'B'}
                  </button>
                );
              })}
            </div>
          )}

          <div className={styles.actionsWrapper}>
            <button className={`${styles.actionBtn} ${styles.situationBtn}`} onClick={onOpenSituation}>
              <span className={styles.actionBtnText}>状況</span>
            </button>
            <button className={`${styles.actionBtn} ${styles.abilityBtn}`} onClick={onOpenAbility}>
              <span className={styles.actionBtnText}>特性</span>
            </button>
          </div>
        </div>

        <div className={styles.footerArea}>
          <button className={styles.cancelBattleBtn} onClick={onRunAway}>
            にげる
          </button>
        </div>
      </div>
    </div>
  );
};
