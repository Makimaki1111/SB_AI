import React from 'react';
import styles from './DoubleBattleArena.module.css';
import { BattleTeamDisplay } from '../BattleTeamDisplay';
import { BattleLayout } from '../BattleLayout';
import { BattleInteractionArea } from '../BattleInteractionArea';
import { BattleActionButtons } from '../BattleActionButtons';
import { BattleRunAwayButton } from '../BattleRunAwayButton';
import type { BattleState, CharacterState } from '../../../types/battle';
import type { NotificationData } from '../../../hooks/battle/useBattleDisplay';
import SoundManager from '../../../utils/SoundManager';

interface DoubleBattleArenaProps {
  battleState: BattleState | null;
  allies: CharacterState[];
  foes: CharacterState[];
  prediction: { 
    include: boolean, 
    type1?: string, 
    type2?: string, 
    used?: boolean, 
    prediction?: string,
    predictions?: Record<string, string>
  } | null;
  messageLog: { text: string | null, isOpen: boolean };
  notification: NotificationData | null;
  waitMessage: string | null;
  isProcessing: boolean;
  timer: { remaining: number; total: number };
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
  
  // ダブルバトルではターゲットごとに予測メッセージが異なるため、選択中のターゲットに合わせる
  const effectivePrediction = React.useMemo(() => {
    if (!prediction) return null;
    if (prediction.prediction) return prediction;
    if (prediction.predictions && effectiveTargetId) {
      return {
        ...prediction,
        prediction: prediction.predictions[effectiveTargetId]
      };
    }
    return prediction;
  }, [prediction, effectiveTargetId]);

  return (
    <BattleLayout
      mode="double"
      backgroundImage="/img/ground.jpg"
      top={
        <>
          <BattleTeamDisplay
            mode="double"
            side="foe"
            characters={foes}
            knockoutStates={knockoutStates}
            activeEffects={activeEffects}
            isWaiting={foes.length === 0}
          />
          <BattleTeamDisplay
            mode="double"
            side="ally"
            characters={allies}
            knockoutStates={knockoutStates}
            activeEffects={activeEffects}
            isWaiting={allies.length === 0}
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
        extraMessage={targetWarning}
        prediction={effectivePrediction}
        isProcessing={isProcessing}
        onSendWord={handleSendWord}
        onSendIncludeCheck={onSendIncludeCheck}
      >
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
          <BattleActionButtons
            onOpenSituation={onOpenSituation}
            onOpenAbility={handleOpenAbility}
          />
        )}
      </BattleInteractionArea>

      <BattleRunAwayButton onRunAway={onRunAway} />
    </BattleLayout>
  );
};
