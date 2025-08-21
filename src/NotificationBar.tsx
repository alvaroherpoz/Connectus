import React from 'react';
import './NotificationBar.css';

interface NotificationBarProps {
  notification: {
    message: string;
    type: 'success' | 'error' | 'info';
  } | null;
}

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