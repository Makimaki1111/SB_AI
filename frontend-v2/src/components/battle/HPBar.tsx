import React from 'react';
import styles from './HPBar.module.css';
import { StatusRow } from './StatusRow';

interface HPBarProps {
  hp: number;
  maxHp: number;
  name: string;
  isPoison: boolean;
  isAlly: boolean;
  isWaiting?: boolean;
}

export const HPBar: React.FC<HPBarProps> = ({
  hp,
  maxHp,
  name,
  isPoison,
  isAlly,
  isWaiting = false
}) => {
  return (
    <div className={`${styles.balloon} ${isAlly ? styles.right : styles.left}`}>
      <StatusRow
        name={name}
        hp={hp}
        maxHp={maxHp}
        isPoison={isPoison}
        isAlly={isAlly}
        isWaiting={isWaiting}
      />
    </div>
  );
};
