import React, { useState } from 'react';
import styles from './WordInput.module.css';

interface WordInputProps {
  onSend: (word: string) => void;
  disabled: boolean;
  initialChar: string;
}

export const WordInput: React.FC<WordInputProps> = ({ onSend, disabled, initialChar }) => {
  const [word, setWord] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (word.trim()) {
      onSend(word);
      setWord('');
    }
  };

  return (
    <form className={styles.inputArea} onSubmit={handleSubmit}>
      <div className={styles.inputWrapper}>
        <input
          id="input"
          type="text"
          className={styles.input}
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder={initialChar ? `${initialChar}から始まる言葉` : '入力...'}
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
