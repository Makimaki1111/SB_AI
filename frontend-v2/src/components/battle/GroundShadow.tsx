import React from 'react';
import styles from './BattleArena.module.css';

interface GroundShadowProps {
  isDouble?: boolean;
}

export const GroundShadow: React.FC<GroundShadowProps> = ({ isDouble = false }) => {
  if (isDouble) {
    return (
      <>
        <div className={`${styles.ellipse} ${styles.ellipseFoe}`} />
        <div className={`${styles.ellipse} ${styles.ellipseAlly}`} />
      </>
    );
  }

  return (
    <>
      <div className={`${styles.ellipse} ${styles.ellipseRight}`} />
      <div className={`${styles.ellipse} ${styles.ellipseLeft}`} />
    </>
  );
};
