import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  flat?: boolean;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const paddingMap = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

export const Card: React.FC<CardProps> = ({
  children,
  title,
  flat = false,
  className = '',
  padding = 'md',
  onClick,
}) => {
  const classes = [
    'card',
    flat ? 'card--flat' : '',
    padding !== 'md' ? paddingMap[padding] : '',
    onClick ? 'cursor-pointer' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={onClick} role={onClick ? 'button' : undefined}>
      {title && <h3 className="card__title">{title}</h3>}
      {children}
    </div>
  );
};
