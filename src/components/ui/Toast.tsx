import React from 'react';

interface ToastProps {
  message: string;
  visible: boolean;
}

export const Toast: React.FC<ToastProps> = ({ message, visible }) => {
  if (!visible) return null;
  return <div className="toast">{message}</div>;
};
