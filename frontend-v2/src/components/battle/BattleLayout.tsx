import React from 'react';
import styles from './BattleLayout.module.css';

interface BattleLayoutProps {
  mode: 'single' | 'double';
  backgroundImage?: string;
  top: React.ReactNode;
  children: React.ReactNode;
}

/**
 * バトルの共通レイアウト（背景、画面分割、基本構造）を管理するコンポーネント
 */
export const BattleLayout: React.FC<BattleLayoutProps> = ({
  mode,
  backgroundImage = "/img/background_normal.png",
  top,
  children
}) => {
  return (
    <div className={styles.battleContainer} data-mode={mode}>
      {/* 上部エリア：背景とキャラクター */}
      <div className={styles.topImage}>
        <img 
          src={backgroundImage} 
          className={styles.bgImage} 
          alt="Battle Background" 
        />
        
        {/* シングルバトルの時のみ、足元の影を表示（UI維持のため） */}
        {mode === 'single' && (
          <>
            <div className={`${styles.ellipse} ${styles.ellipseLeft}`} />
            <div className={`${styles.ellipse} ${styles.ellipseRight}`} />
          </>
        )}

        {top}
      </div>

      {/* 下部エリア：操作パネルなど */}
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
};
