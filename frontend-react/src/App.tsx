import { useLayoutEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AudioProvider } from './context/AudioContext';
import { BattleProvider } from './context/BattleContext';
import { BattlePage } from './pages/BattlePage';
import { TitlePage } from './pages/TitlePage';
import { LobbyPage } from './pages/LobbyPage';
import './App.css';

function App() {
  const phoneBoxRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const adjustScale = () => {
      if (!phoneBoxRef.current) return;
      
      const originalWidth = 450;
      const originalHeight = 720;

      const scaleX = (window.innerWidth * 0.95) / originalWidth;
      const scaleY = (window.innerHeight * 0.95) / originalHeight;
      const scale = Math.min(scaleX, scaleY, 1.0);

      phoneBoxRef.current.style.transform = `translate(-50%, -50%) scale(${scale})`;
    };

    window.addEventListener('resize', adjustScale);
    adjustScale();
    return () => window.removeEventListener('resize', adjustScale);
  }, []);

  return (
    <Router>
      <AudioProvider>
        <BattleProvider>
          <div className="phone-box" ref={phoneBoxRef}>
            <Routes>
              <Route path="/" element={<TitlePage />} />
              <Route path="/lobby/:mode" element={<LobbyPage />} />
              <Route path="/battle" element={<BattlePage />} />
            </Routes>
          </div>
        </BattleProvider>
      </AudioProvider>
    </Router>
  );
}

export default App;
