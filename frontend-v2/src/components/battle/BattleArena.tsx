import React from 'react';
import styles from './BattleArena.module.css';
import { WordInput } from './WordInput';
import { GroundShadow } from './GroundShadow';
import { BattleSide } from './BattleSide';
import { TYPE_TO_IMAGE } from '../../constants/game';
import type { BattleState, CharacterState } from '../../types/battle';
import SoundManager from '../../utils/SoundManager';


interface BattleArenaProps {
  battleState: BattleState | null;
  ally: CharacterState | null;
  foe: CharacterState | null;
  prediction: { include: boolean, type1?: string, type2?: string, used?: boolean, prediction?: string } | null;
  messageLog: { text: string | null, isOpen: boolean };
  notification: string | null;
  waitMessage: string | null;
  isProcessing: boolean;
  allyEffect: string | null;
  foeEffect: string | null;
  timer: { remaining: number; total: number };
  allyWord: string | null;
  foeWord: string | null;
  knockoutStates: Record<string, boolean>;
  allyId: string | null;
  foeId: string | null;
  username: string;
  onSendWord: (word: string) => void;
  onSendIncludeCheck: (word: string) => void;
  onOpenSituation: () => void;
  onOpenAbility: () => void;
  onRunAway: () => void;
  selectedTargetId?: string | null;
  onSelectTarget?: (id: string | null) => void;
}

export const BattleArena: React.FC<BattleArenaProps> = ({
  battleState,
  ally,
  foe,
  prediction,
  messageLog,
  notification,
  waitMessage,
  isProcessing,
  allyEffect,
  foeEffect,
  timer,
  allyWord,
  foeWord,
  knockoutStates,
  allyId,
  foeId,
  username,
  onSendWord,
  onSendIncludeCheck,
  onOpenSituation,
  onOpenAbility,
  onRunAway,
  selectedTargetId,
  onSelectTarget
}) => {
  const characters = battleState?.characters || {};
  
  // シングルバトルのキャラ
  const p1 = characters['p1'] || (allyId === 'p1' ? ally : null);
  const p2 = characters['p2'] || (foeId === 'p2' ? foe : null);
  
  // ダブルバトルのキャラ
  const p1a = characters['p1a'];
  const p1b = characters['p1b'];
  const p2a = characters['p2a'];
  const p2b = characters['p2b'];

  const isDouble = !!(p1a || p1b || p2a || p2b);

  const renderSide = (id: string | null, char: CharacterState | null, isAlly: boolean, positionClass: string) => {
    if (!id && !char) return null;
    const isCurrent = battleState?.current_actor_id === id;
    const isSelected = selectedTargetId === id;
    const word = isAlly ? allyWord : foeWord;
    const effect = isAlly ? allyEffect : foeEffect;

    return (
      <div key={id || positionClass} className={`${styles.sideWrapper} ${styles[positionClass]}`}>
        <BattleSide 
          character={char}
          isAlly={isAlly}
          effect={effect}
          word={isCurrent ? word : null} // 行動中のキャラのみワードを表示
          isKnockout={id ? knockoutStates[id] : false}
          name={char?.name ?? (isAlly ? username : (isDouble ? `あいて(${id?.slice(-1).toUpperCase()})` : "あいて"))}
          isSelected={isSelected}
          isCurrentTurn={isCurrent}
          isDouble={isDouble}
          onSelectTarget={() => onSelectTarget?.(id)}
        />
      </div>
    );
  };

  return (
    <div className={`${styles.battleContainer} ${isDouble ? styles.doubleMode : styles.singleMode}`}>
      <div className={styles.topImage}>
        <img src="/img/ground.jpg" className={styles.bgImage} alt="背景画像" />
        
        <GroundShadow />
        
        <div className={styles.arenaGrid}>
          {/* 相手側 */}
          <div className={styles.foeSide}>
            {isDouble ? (
              <>
                {renderSide('p2a', p2a || null, false, 'p2a')}
                {renderSide('p2b', p2b || null, false, 'p2b')}
              </>
            ) : (
              renderSide('p2', p2 || foe, false, 'p2')
            )}
          </div>

          {/* 自分側 */}
          <div className={styles.allySide}>
            {isDouble ? (
              <>
                {renderSide('p1a', p1a || null, true, 'p1a')}
                {renderSide('p1b', p1b || null, true, 'p1b')}
              </>
            ) : (
              renderSide('p1', p1 || ally, true, 'p1')
            )}
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.actionArea}>
          {/* メッセージボックスがタイマーを覆うように配置 */}
          {messageLog.isOpen && (
            <div className={styles.messageOverlay}>
              {messageLog.text}
            </div>
          )}

          {/* タイマーを最上部に配置 */}
          {battleState && (
            <div className={styles.timerContainer}>
              <div 
                className={styles.timerBar} 
                style={{ 
                  width: `${(timer.remaining / (timer.total || 1)) * 100}%`,
                  backgroundColor: timer.remaining > 10 ? '#00FF00' : timer.remaining > 5 ? '#FFFF00' : '#FF0000'
                }} 
              />
            </div>
          )}

          {/* 特性変更などの通知 */}
          {notification && (
            <div className={styles.toastNotification}>
              {notification}
            </div>
          )}

          <div className={styles.inputWrapper}>
            {(!messageLog.isOpen && battleState?.is_my_turn && battleState?.status !== 'finished') && (
              <WordInput 
                onSend={onSendWord} 
                onChange={onSendIncludeCheck}
                disabled={isProcessing}
                initialChar={battleState?.character || ''}
              />
            )}
            {prediction && prediction.include && !messageLog.isOpen && (
              <div className={styles.predictionContainer}>
                <div className={styles.predictionImages}>
                  {prediction.used ? (
                    <img src="/img/god.gif" alt="Used" className={styles.predictionImg} />
                  ) : (
                    <>
                      {prediction.type1 && !prediction.type2 && (
                        <img 
                          src={`/img/${TYPE_TO_IMAGE[prediction.type1] || 'normal'}.gif`} 
                          alt="Type 1" 
                          className={styles.predictionImg} 
                        />
                      )}
                      {prediction.type1 && prediction.type2 && (
                        <>
                          <img 
                            src={`/img/${TYPE_TO_IMAGE[prediction.type1] || 'normal'}.gif`} 
                            alt="Type 1" 
                            className={`${styles.predictionImg} ${styles.type1}`} 
                          />
                          <img 
                            src={`/img/${TYPE_TO_IMAGE[prediction.type2] || 'normal'}.gif`} 
                            alt="Type 2" 
                            className={`${styles.predictionImg} ${styles.type2}`} 
                          />
                        </>
                      )}
                    </>
                  )}
                </div>
                {prediction.prediction && <div className={styles.predictionMsg}>{prediction.prediction}</div>}
              </div>
            )}
            {waitMessage && (
              <div className={styles.waitMessage}>
                {waitMessage}
              </div>
            )}
          </div>

          {battleState && (
            <div className={styles.actionsWrapper}>
              <div 
                className={`${styles.actionBtn} ${styles.situationBtn}`} 
                onClick={() => { SoundManager.play('pera'); onOpenSituation(); }}
              >
                <svg className={styles.actionBtnIcon} viewBox="0 0 24 24">
                  <path d="M3 13.125C3 12.5037 3.50368 12 4.125 12H6.75C7.37132 12 7.875 12.5037 7.875 13.125V18.375C7.875 18.9963 7.37132 19.5 6.75 19.5H4.125C3.50368 19.5 3 18.9963 3 18.375V13.125ZM10.125 7.125C10.125 6.50368 10.6287 6 11.25 6H13.875C14.4963 6 15 6.50368 15 7.125V18.375C15 18.9963 14.4963 19.5 13.875 19.5H11.25C10.6287 19.5 10.125 18.9963 10.125 18.375V7.125ZM17.25 3.375C17.25 2.75368 17.7537 2.25 18.375 2.25H21C21.6213 2.25 22.125 2.75368 22.125 3.375V18.375C22.125 18.9963 21.6213 19.5 21 19.5H18.375C17.7537 19.5 17.25 18.9963 17.25 18.375V3.375Z" />
                </svg>
                <span className={styles.actionBtnText}>状況</span>
              </div>
              <div 
                className={`${styles.actionBtn} ${styles.abilityBtn}`}
                onClick={onOpenAbility}
              >
                <svg className={styles.actionBtnIcon} viewBox="0 0 24 24">
                  <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
                <span className={styles.actionBtnText}>特性</span>
              </div>
            </div>
          )}
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
