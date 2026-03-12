import React, { useState } from 'react';
import './LobbyForm.css';

interface LobbyFormProps {
  title: string;
  onAction: (action: 'create' | 'join' | 'cpu', roomId?: string, subMode?: string) => void;
  modes?: { id: string; name: string }[];
}

export const LobbyForm: React.FC<LobbyFormProps> = ({ title, onAction, modes }) => {
  const [roomId, setRoomId] = useState('');
  const [selectedMode, setSelectedMode] = useState(modes ? modes[0].id : '');
  const [username, setUsername] = useState(localStorage.getItem('sb_username') || '');

  const handleAction = (action: 'create' | 'join' | 'cpu') => {
    localStorage.setItem('sb_username', username || '名無し');
    onAction(action, roomId, selectedMode);
  };

  return (
    <div className="lobby-form glass">
      <h2>{title}</h2>
      
      <div className="form-group">
        <label>ユーザー名</label>
        <input 
          type="text" 
          value={username} 
          onChange={(e) => setUsername(e.target.value)} 
          placeholder="あなたの名前"
        />
      </div>

      {modes && (
        <div className="form-group">
          <label>モード</label>
          <select value={selectedMode} onChange={(e) => setSelectedMode(e.target.value)}>
            {modes.map(mode => (
              <option key={mode.id} value={mode.id}>{mode.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="button-group horizontal">
        <button className="primary-btn" onClick={() => handleAction('create')}>部屋を作る</button>
        <button className="secondary-btn" onClick={() => handleAction('cpu')}>CPUと対戦</button>
      </div>

      <div className="divider">または</div>

      <div className="form-group">
        <label>ルームIDで参加</label>
        <div className="input-with-button">
          <input 
            type="text" 
            value={roomId} 
            onChange={(e) => setRoomId(e.target.value)} 
            placeholder="Room ID"
          />
          <button className="join-btn" onClick={() => handleAction('join')}>参加</button>
        </div>
      </div>
    </div>
  );
};
