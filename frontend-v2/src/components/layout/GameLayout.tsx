import React from 'react';
import styles from './GameLayout.module.css';

interface GameLayoutProps {
  children: React.ReactNode;
  id?: string;
}

/**
 * アプリ全体の共通の外枠 (phone-box) を提供するレイアウトコンポーネント。
 * タイトル、ロビー、バトル画面など、すべての主要なビューをこれで包む。
 */
export const GameLayout: React.FC<GameLayoutProps> = ({ children, id }) => {
  return (
    <div className={styles.container}>
      <div className={styles.phoneBox} id={id}>
        {children}
      </div>
    </div>
  );
};
