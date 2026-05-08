import React, { useState } from 'react';
import styles from './WordInput.module.css';

import type { CharacterState } from '../../types/battle';

interface WordInputProps {
  onSend: (word: string, targetId?: string | null) => void;
  onChange: (word: string) => void;
  disabled: boolean;
  initialChar: string;
  isDouble?: boolean;
  foes?: CharacterState[];
  selectedTargetId?: string | null;
  onTargetChange?: (id: string) => void;
}

export const WordInput: React.FC<WordInputProps> = ({ 
  onSend, 
  onChange, 
  disabled, 
  initialChar,
  isDouble = false,
  foes = [],
  selectedTargetId = null,
  onTargetChange
}) => {
  const [word, setWord] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (word.trim()) {
      onSend(word, selectedTargetId);
      setWord('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setWord(val);
    onChange(val);
  };

  return (
    <form className={styles.inputArea} onSubmit={handleSubmit}>
      {isDouble && foes.length > 0 && (
        <div className={styles.targetBar}>
          {foes.map((foe, index) => (
            <button
              key={foe.id || index}
              type="button"
              className={`${styles.targetBtn} ${selectedTargetId === foe.id ? styles.targetActive : ''} ${foe.hp <= 0 ? styles.targetDisabled : ''}`}
              onClick={() => foe.hp > 0 && onTargetChange?.(foe.id || '')}
              disabled={foe.hp <= 0}
            >
              {foe.name}
            </button>
          ))}
        </div>
      )}
      <div className={styles.inputWrapper}>
        <input
          id="input"
          type="text"
          className={styles.input}
          value={word}
          onChange={handleChange}
          placeholder={initialChar ? `「${initialChar}」からはじまることば` : '入力...'}
          disabled={disabled}
          autoComplete="off"
        />
        <button id="submit" type="submit" className={styles.submitBtn} disabled={disabled || !word.trim()}>
          <img src="/img/paper_plane.svg" alt="送信" />
        </button>
      </div>
    </form>
  );
};
