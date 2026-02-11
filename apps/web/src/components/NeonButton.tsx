import React, { ButtonHTMLAttributes, ReactNode } from 'react';

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'outline' | 'solid' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function NeonButton({
  children,
  variant = 'outline',
  size = 'md',
  className = '',
  ...props
}: NeonButtonProps) {
  const sizeClasses = {
    sm: 'px-3 py-1 text-xs',
    md: 'px-5 py-2 text-sm',
    lg: 'px-8 py-3 text-base',
  };

  const variantClass = {
    outline: 'neon-btn',
    solid: 'neon-btn neon-btn-solid',
    danger: 'neon-btn border-danger text-danger hover:bg-danger/15',
  };

  return (
    <button
      className={`${variantClass[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
