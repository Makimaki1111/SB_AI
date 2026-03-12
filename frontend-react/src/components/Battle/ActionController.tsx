import React, { useState, useEffect, useRef } from 'react';
import * as wanakana from 'wanakana';
import { useBattle } from '../../context/BattleContext';
import { useAudio } from '../../context/AudioContext';
import './ActionController.css';

interface ActionControllerProps {
  onOpenAbility: () => void;
  onOpenSituation: () => void;
}

export const ActionController: React.FC<ActionControllerProps> = ({ onOpenAbility, onOpenSituation }) => {
  const { state, sendWord } = useBattle();
  const { playSound } = useAudio();
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      wanakana.bind(inputRef.current);
    }
    return () => {
      if (inputRef.current) {
        wanakana.unbind(inputRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (state.isMyTurn && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state.isMyTurn]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.isMyTurn || !inputValue.trim()) return;

    playSound('/src/assets/resource/pera.mp3');
    sendWord(inputValue.trim());
    setInputValue('');
  };


  return (
    <div className={`action-controller ${!state.isMyTurn ? 'disabled' : ''}`}>
      <div className="status-display">
        {state.isMyTurn ? (
          <div className="message">「{state.characterToStartWith}」から始まる言葉を<br />入力してください。</div>
        ) : (
          <div className="message">相手の入力を待っています...</div>
        )}
      </div>

      <div className="command-area">
        <form className="input-area" onSubmit={handleSubmit}>
          <input 
            ref={inputRef}
            type="text" 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={state.isMyTurn ? 'ことばを にゅうりょく...' : ''}
            disabled={!state.isMyTurn}
          />
          <button type="submit" disabled={!state.isMyTurn || !inputValue.trim()}>
            Go
          </button>
        </form>


        <div className="command-buttons">
          <button className="cmd-btn ability" onClick={onOpenAbility}>とくせい</button>
          <button className="cmd-btn situation" onClick={onOpenSituation}>じょうきょう</button>
          <button className="cmd-btn glass disabled">（未実装）</button>
          <button className="cmd-btn glass disabled">（未実装）</button>
        </div>
      </div>
    </div>
  );
};

