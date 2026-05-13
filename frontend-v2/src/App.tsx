import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './context/UserProvider';
import { SoundProvider } from './context/SoundProvider';
import { TitleView } from './views/TitleView';
import { BattleView } from './views/BattleView';
import SoundManager from './utils/SoundManager';
import './index.css';

function App() {
  useEffect(() => {
    // 共通音源のプリロード
    SoundManager.preloadCommonSounds();

    const handleFirstInteraction = () => {
      SoundManager.unlock();
      // タイトル画面のBGMを開始 (既に再生中なら何もしない)
      SoundManager.playBGM('/resource/horizon.mp3');
      
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
      <SoundProvider>
        <Router>
          <div className="app-container">
            <Routes>
              <Route path="/" element={<TitleView />} />
              <Route path="/battle/single" element={<BattleView key="single" />} />
              <Route path="/battle/double" element={<BattleView key="double" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </Router>
      </SoundProvider>
    </UserProvider>
  );
}

export default App;
