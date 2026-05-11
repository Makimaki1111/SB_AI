import React from 'react';
import styles from './GameButton.module.css';
import SoundManager from '../../utils/SoundManager';

interface GameButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'orange' | 'pink' | 'grey' | 'green';
  disabled?: boolean;
  type?: 'button' | 'submit';
}

export const GameButton: React.FC<GameButtonProps> = ({
  children,
  onClick,
  className = '',
  variant = 'orange',
  disabled = false,
  type = 'button'
}) => {
  const variantClass = styles[variant] || styles.orange;
  
  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    
    // 全てのボタン音を 'pera' に統一
    SoundManager.play('pera');
    
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
