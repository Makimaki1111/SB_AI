import React, { useState } from 'react';
import styles from './WordInput.module.css';

interface WordInputProps {
  onSend: (word: string, targetId?: string | null) => void;
  onChange: (word: string) => void;
  disabled: boolean;
  initialChar: string;
  selectedTargetId?: string | null;
}

export const WordInput: React.FC<WordInputProps> = ({ 
  onSend, 
  onChange, 
  disabled, 
  initialChar,
  selectedTargetId = null,
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
