import React from 'react';
import { BattleTeamDisplay } from '../BattleTeamDisplay';
import { BattleLayout } from '../BattleLayout';
import { BattleInteractionArea } from '../BattleInteractionArea';
import { BattleActionButtons } from '../BattleActionButtons';
import { BattleRunAwayButton } from '../BattleRunAwayButton';
import type { BattleState } from '../../../types/battle';


interface SingleBattleArenaProps {
  battleState: BattleState | null;
  prediction: { include: boolean, type1?: string, type2?: string, used?: boolean, prediction?: string } | null;
  messageLog: { text: string | null, isOpen: boolean };
  notification: string | null;
  waitMessage: string | null;
  isProcessing: boolean;
  allyEffect: string | null;
  foeEffect: string | null;
  timer: { remaining: number; total: number };
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

/**
 * シングルバトル専用アリーナ。
 * BattleLayout と共通コンポーネントを使用して構成されています。
 */
export const SingleBattleArena: React.FC<SingleBattleArenaProps> = ({
  battleState,
  prediction,
  messageLog,
  notification,
  waitMessage,
  isProcessing,
  allyEffect,
  foeEffect,
  timer,
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
  const { ally, foe } = React.useMemo(() => {
    if (!battleState) return { ally: null, foe: null };
    return {
      ally: allyId ? battleState.characters[allyId] || null : null,
      foe: foeId ? battleState.characters[foeId] || null : null
    };
  }, [battleState, allyId, foeId]);

  return (
    <BattleLayout
      mode="single"
      backgroundImage="/img/ground.jpg"
      top={
        <>
          <BattleTeamDisplay
            mode="single"
            side="foe"
            characters={foe ? [foe] : []}
            knockoutStates={knockoutStates}
            activeEffects={foeEffect ? { [foeId || 'foe']: foeEffect } : {}}
            isWaiting={!foe}
          />
          <BattleTeamDisplay
            mode="single"
            side="ally"
            characters={ally ? [ally] : []}
            knockoutStates={knockoutStates}
            activeEffects={allyEffect ? { [allyId || 'ally']: allyEffect } : {}}
            username={username || ally?.name || "じぶん"}
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
      />

      {battleState && (
        <BattleActionButtons
          onOpenSituation={onOpenSituation}
          onOpenAbility={onOpenAbility}
        />
      )}

      <BattleRunAwayButton onRunAway={onRunAway} />
    </BattleLayout>
  );
};
