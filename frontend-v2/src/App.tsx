import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import { TitleView } from './views/TitleView';
import { BattleView } from './views/BattleView';
import SoundManager from './utils/SoundManager';
import './index.css';

function App() {
  useEffect(() => {
    const handleFirstInteraction = () => {
      SoundManager.unlock().then(() => {
        // タイトル画面のBGMを開始
        SoundManager.playBGM('/resource/horizon.mp3');
      });
      // 一度だけ実行
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  return (
    <UserProvider>
      <Router>
        <div className="app-container">
          <Routes>
            <Route path="/" element={<TitleView />} />
            <Route path="/battle/single" element={<BattleView />} />
            <Route path="/battle/double" element={<BattleView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </UserProvider>
  );
}

export default App;
