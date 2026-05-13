import React from 'react';
import styles from './BattleInteractionArea.module.css';
import { BattleOverlay } from './BattleOverlay';
import { BattleNotification } from './BattleNotification';
import { BattleTimer } from './BattleTimer';
import { BattleWaitMessage } from './BattleWaitMessage';
import { WordInput } from './WordInput';
import { TYPE_TO_IMAGE } from '../../constants/game';
import type { BattleState } from '../../types/battle';
import type { NotificationData } from '../../hooks/battle/useBattleDisplay';

interface BattleInteractionAreaProps {
  battleState: BattleState | null;
  timer: { remaining: number; total: number };
  messageLog: { text: string | null; isOpen: boolean };
  notification: NotificationData | null;
  waitMessage: string | null;
  extraMessage?: string | null; // 追加: targetWarning などの表示用
  prediction: { 
    include: boolean, 
    type1?: string, 
    type2?: string, 
    used?: boolean, 
    prediction?: string 
  } | null;
  isProcessing: boolean;
  onSendWord: (word: string) => void;
  onSendIncludeCheck: (word: string) => void;
  children?: React.ReactNode;
}

export const BattleInteractionArea: React.FC<BattleInteractionAreaProps> = ({
  battleState,
  timer,
  messageLog,
  notification,
  waitMessage,
  extraMessage,
  prediction,
  isProcessing,
  onSendWord,
  onSendIncludeCheck,
  children
}) => {
  const showInput = !messageLog.isOpen && 
                    battleState?.is_my_turn && 
                    battleState?.status !== 'finished';

  return (
    <div className={styles.actionArea}>
      {/* オーバーレイ (ログ、通知) */}
      <BattleOverlay
        messageLog={messageLog}
      />
      <BattleNotification notification={notification} />

      {/* タイマー */}
      {battleState && (
        <BattleTimer remaining={timer.remaining} total={timer.total} />
      )}

      {/* 入力エリア */}
      <div className={styles.inputWrapper}>
        {showInput && (
          <WordInput
            onSend={onSendWord}
            onChange={onSendIncludeCheck}
            disabled={isProcessing}
            initialChar={battleState?.character || ''}
          />
        )}

        {/* タイプ予測表示 */}
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
            {prediction.prediction && (
              <div className={styles.predictionMsg}>{prediction.prediction}</div>
            )}
          </div>
        )}

        {/* 待機メッセージ / 警告メッセージ */}
        <BattleWaitMessage message={waitMessage} />
        <BattleWaitMessage message={extraMessage} />
      </div>

      {/* モード固有の要素（ターゲット選択ボタンなど） */}
      {children}
    </div>
  );
};
