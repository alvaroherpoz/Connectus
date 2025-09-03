/**
 * NotificationBar.tsx
 * Barra de notificaciones para mostrar mensajes de estado y errores al usuario.
 */

import React from 'react';
import '../types/NotificationBar.css';

/**
 * Props del componente NotificationBar.
 */
interface NotificationBarProps {
  notification: {
    message: string;
    type: 'success' | 'error' | 'info';
  } | null;
}

/**
 * Componente visual para mostrar notificaciones al usuario.
 */
const NotificationBar: React.FC<NotificationBarProps> = ({ notification }) => {
  if (!notification) {
    return null;
  }

  return (
    <div className={`notification-bar ${notification.type}`}>
      {notification.message}
    </div>
  );
};

export default NotificationBar;