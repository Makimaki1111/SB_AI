import React from 'react';
import styles from './DoubleBattleArena.module.css';
import { DoubleBattleSide } from './DoubleBattleSide';
import { BattleHPBar } from '../BattleHPBar';
import { BattleLayout } from '../BattleLayout';
import { BattleInteractionArea } from '../BattleInteractionArea';
import { BattleActionButtons } from '../BattleActionButtons';
import { BattleRunAwayButton } from '../BattleRunAwayButton';
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
    <BattleLayout
      mode="double"
      backgroundImage="/img/ground.jpg"
      top={
        <>
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
        prediction={prediction}
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
