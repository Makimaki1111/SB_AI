import React from 'react';
import styles from './GameButton.module.css';
import SoundManager from '../../utils/SoundManager';

interface GameButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'orange' | 'pink' | 'grey' | 'green';
  disabled?: boolean;
  silent?: boolean;
  type?: 'button' | 'submit';
}

export const GameButton: React.FC<GameButtonProps> = ({
  children,
  onClick,
  className = '',
  variant = 'orange',
  disabled = false,
  silent = false,
  type = 'button'
}) => {
  const variantClass = styles[variant] || styles.orange;
  
  const handleClick = () => {
    if (disabled) return;
    
    // 全てのボタン音を 'pera' に統一 (silentでない場合のみ)
    if (!silent) {
      SoundManager.play('pera');
    }
    
    if (onClick) onClick();
  };
  
  return (
    <button
      type={type}
      className={`${styles.baseButton} ${variantClass} ${className}`}
      onClick={handleClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
