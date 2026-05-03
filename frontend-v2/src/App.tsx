import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import { TitleView } from './views/TitleView';
import { BattleView } from './views/BattleView';
import './index.css';

function App() {
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
