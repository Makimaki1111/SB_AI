import React from 'react';
import styles from './SingleBattle.module.css';
import { SingleBattleSide } from './SingleBattleSide';
import { BattleLayout } from '../BattleLayout';
import { BattleInteractionArea } from '../BattleInteractionArea';
import { BattleActionButtons } from '../BattleActionButtons';
import { BattleRunAwayButton } from '../BattleRunAwayButton';
import type { BattleState, CharacterState } from '../../../types/battle';
import SoundManager from '../../../utils/SoundManager';


interface SingleBattleArenaProps {
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
}

export const SingleBattleArena: React.FC<SingleBattleArenaProps> = ({
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
  onRunAway
}) => {
  return (
    <BattleLayout
      mode="single"
      backgroundImage="/img/ground.jpg"
      top={
        <>
          {/* キャラクターセクション (シングル専用) */}
          <SingleBattleSide
            character={foe}
            isAlly={false}
            effect={foeEffect}
            word={foeWord}
            isKnockout={foeId ? knockoutStates[foeId] : false}
            name={foe?.name ?? "あいて"}
          />
          <SingleBattleSide
            character={ally}
            isAlly={true}
            effect={allyEffect}
            word={allyWord}
            isKnockout={allyId ? knockoutStates[allyId] : false}
            name={username || ally?.name || "じぶん"}
          />
        </>
      }
    >
      <BattleInteractionArea
        battleState={battleState}
        timer={timer}
        messageLog={messageLog}
        notification={notification}
        waitMessage={waitMessage}
        prediction={prediction}
        isProcessing={isProcessing}
        onSendWord={onSendWord}
        onSendIncludeCheck={onSendIncludeCheck}
      >
        {battleState && (
          <BattleActionButtons
            onOpenSituation={onOpenSituation}
            onOpenAbility={onOpenAbility}
          />
        )}
      </BattleInteractionArea>

      <BattleRunAwayButton onRunAway={onRunAway} />
    </BattleLayout>
  );
};
