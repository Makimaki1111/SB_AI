import React from 'react';
import styles from './BattleArena.module.css';

export const GroundShadow: React.FC = () => {
  return (
    <>
      <div className={`${styles.ellipse} ${styles.ellipseRight}`} />
      <div className={`${styles.ellipse} ${styles.ellipseLeft}`} />
    </>
  );
};
