import React from 'react';
import styles from './GameButton.module.css';

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
  
  return (
    <button
      type={type}
      className={`${styles.baseButton} ${variantClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
