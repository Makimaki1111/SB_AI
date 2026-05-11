import React from 'react';
import styles from './BattleControlPanel.module.css';
import { BattleTimer } from './BattleTimer';
import { BattleMessageOverlay } from './BattleMessageOverlay';
import { BattleToast } from './BattleToast';
import { BattlePrediction } from './BattlePrediction';
import { WordInput } from './WordInput';
import type { BattleState } from '../../types/battle';

interface BattleControlPanelProps {
  battleState: BattleState | null;
  timer: { remaining: number; total: number };
  messageLog: { text: string | null, isOpen: boolean };
  notification: string | null;
  prediction: { include: boolean, type1?: string, type2?: string, used?: boolean, prediction?: string } | null;
  waitMessage: string | null;
  isProcessing: boolean;
  onSendWord: (word: string) => void;
  onSendIncludeCheck: (word: string) => void;
}

/**
 * バトル操作パネル。
 * 元の Arena の JSX 構造と z-index 関係を 100% 維持したままコンポーネント化。
 */
export const BattleControlPanel: React.FC<BattleControlPanelProps> = ({
  battleState,
  timer,
  messageLog,
  notification,
  prediction,
  waitMessage,
  isProcessing,
  onSendWord,
  onSendIncludeCheck
}) => {
  const isMyTurn = battleState?.is_my_turn && battleState?.status !== 'finished';

  return (
    <div className={styles.controlPanel}>
      {/* 1. 実況メッセージ (タイマーを覆うために最上部に配置) */}
      <BattleMessageOverlay text={messageLog.text} isOpen={messageLog.isOpen} />

      {/* 2. タイマー */}
      {battleState && <BattleTimer remaining={timer.remaining} total={timer.total} />}

      {/* 3. 通知 (トースト) */}
      <BattleToast message={notification} />

      {/* 4. 入力・待機エリア */}
      <div className={styles.inputWrapper}>
        {!messageLog.isOpen && isMyTurn && (
          <WordInput
            onSend={onSendWord}
            onChange={onSendIncludeCheck}
            disabled={isProcessing}
            initialChar={battleState?.character || ''}
          />
        )}

        {/* 予測表示はメッセージが出ていない時だけ表示 */}
        {!messageLog.isOpen && <BattlePrediction prediction={prediction} />}

        {/* 待機メッセージ */}
        {!messageLog.isOpen && waitMessage && (
          <div className={styles.waitMessage}>{waitMessage}</div>
        )}
      </div>
    </div>
  );
};
