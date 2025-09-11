/**
 * @fileoverview Barra de notificaciones para mostrar mensajes de estado y errores al usuario.
 */

import React from 'react';
import '../types/NotificationBar.css';

/**
 * Props para el componente NotificationBar.
 * @interface NotificationBarProps
 */
interface NotificationBarProps {
  /** El objeto de notificación a mostrar, o `null` para no mostrar nada. */
  notification: {
    message: string;
    type: 'success' | 'error' | 'info';
  } | null;
}

/**
 * Componente que renderiza una barra de notificación flotante.
 * @param {NotificationBarProps} props - Las props del componente.
 * @returns {React.ReactElement | null} La barra de notificación o `null`.
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