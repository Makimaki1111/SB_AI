import React from 'react';
import styles from './DoubleBattleArena.module.css';
import { WordInput } from '../WordInput';
import { DoubleBattleSide } from './DoubleBattleSide';
import { BattleHPBar } from '../BattleHPBar';
import { BattleTimer } from '../BattleTimer';
import { BattleOverlay } from '../BattleOverlay';
import { BattleWaitMessage } from '../BattleWaitMessage';
import { TYPE_TO_IMAGE } from '../../../constants/game';
import type { BattleState, CharacterState } from '../../../types/battle';
import SoundManager from '../../../utils/SoundManager';

interface DoubleBattleArenaProps {
  battleState: BattleState | null;
  allies: CharacterState[];
  foes: CharacterState[];
  prediction: { include: boolean, type1?: string, type2?: string, used?: boolean, prediction?: string } | null;
  messageLog: { text: string | null, isOpen: boolean };
  notification: string | null;
  waitMessage: string | null;
  isProcessing: boolean;
  timer: { remaining: number; total: number };
  allyWord: string | null;
  foeWord: string | null;
  knockoutStates: Record<string, boolean>;
  activeEffects?: Record<string, string>;
  onSendWord: (word: string, targetId?: string) => void;
  onSendIncludeCheck: (word: string) => void;
  onOpenSituation: () => void;
  onOpenAbility: (index?: number) => void;
  onRunAway: () => void;
}

/**
 * 既存の BattleArena.tsx をベースにした、ダブルバトル専用アリーナ。
 * デザインや配置は一切変更せず、シングル用の分岐のみを取り除いています。
 */
export const DoubleBattleArena: React.FC<DoubleBattleArenaProps> = ({
  battleState,
  allies,
  foes,
  prediction,
  messageLog,
  notification,
  waitMessage,
  isProcessing,
  timer,
  knockoutStates,
  activeEffects = {},
  onSendWord,
  onSendIncludeCheck,
  onOpenSituation,
  onOpenAbility,
  onRunAway
}) => {
  const [selectedTargetId, setSelectedTargetId] = React.useState<string | null>(null);
  const [targetWarning, setTargetWarning] = React.useState<string | null>(null);

  const aliveFoes = foes.filter(f => f.hp > 0 && !f.is_defeated);
  const selectedTargetIsAlive = aliveFoes.some(f => (f.id || f.name) === selectedTargetId);
  const effectiveTargetId = selectedTargetIsAlive
    ? selectedTargetId
    : aliveFoes.length === 1
      ? aliveFoes[0].id || aliveFoes[0].name || null
      : null;

  const handleSendWord = (word: string) => {
    if (aliveFoes.length > 1 && !effectiveTargetId) {
      setTargetWarning('ターゲットを選択してください');
      return;
    }
    setTargetWarning(null);
    onSendWord(word, effectiveTargetId || undefined);
  };

  const handleOpenAbility = () => {
    const actorIndex = allies.findIndex(ally => ally.id === battleState?.current_actor_id);
    onOpenAbility(actorIndex >= 0 ? actorIndex : 0);
  };

  return (
    <div className={styles.battleContainer} data-battle-mode="double">
      <div className={styles.topImage}>
        <img src="/img/ground.jpg" className={styles.bgImage} alt="背景画像" />

        <DoubleBattleSide
          characters={foes}
          isAlly={false}
          knockoutStates={knockoutStates}
          activeEffects={activeEffects}
        />
        <DoubleBattleSide
          characters={allies}
          isAlly={true}
          knockoutStates={knockoutStates}
          activeEffects={activeEffects}
        />

        <BattleHPBar
          characters={foes}
          isAlly={false}
          mode="double"
        />
        <BattleHPBar
          characters={allies}
          isAlly={true}
          mode="double"
        />
      </div>

      <div className={styles.content}>
        <div className={styles.actionArea}>
          {/* メッセージボックス、通知、待機メッセージを一括管理 */}
          <BattleOverlay
            messageLog={messageLog}
            notification={notification}
          />

          {/* タイマーを表示 */}
          {battleState && (
            <BattleTimer remaining={timer.remaining} total={timer.total} />
          )}

          <div className={styles.inputWrapper}>
            {(!messageLog.isOpen && battleState?.is_my_turn && battleState?.status !== 'finished') && (
              <WordInput
                onSend={handleSendWord}
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
            <BattleWaitMessage message={waitMessage} />
            <BattleWaitMessage message={targetWarning} />
          </div>

          {/* ターゲット選択ボタン (既存の UI を 100% 維持) */}
          {foes.length > 0 && battleState?.status !== 'finished' && (
            <div className={styles.targetBar}>
              {foes.map((foe, index) => {
                const targetKey = foe.id || foe.name;
                const isActive = effectiveTargetId === targetKey;

                return (
                  <button
                    key={targetKey || index}
                    type="button"
                    className={`${styles.targetBtn} ${isActive ? styles.targetActive : ''} ${foe.hp <= 0 ? styles.targetDisabled : ''}`}
                    onClick={() => {
                      if (foe.hp > 0) {
                        SoundManager.play('pera');
                        setSelectedTargetId(targetKey);
                        setTargetWarning(null);
                      }
                    }}
                    disabled={foe.hp <= 0}
                  >
                    {foe.name}
                  </button>
                );
              })}
            </div>
          )}

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
                onClick={handleOpenAbility}
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
