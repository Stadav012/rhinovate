import React, { useState } from 'react';
import Toast, { ToastType } from './Toast';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Function to add a new toast
  const addToast = (message: string, type: ToastType = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    return id;
  };

  // Function to remove a toast by id
  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Expose the functions to the window for global access
  React.useEffect(() => {
    (window as any).toast = {
      success: (message: string) => addToast(message, 'success'),
      error: (message: string) => addToast(message, 'error'),
      info: (message: string) => addToast(message, 'info'),
      warning: (message: string) => addToast(message, 'warning'),
    };
  }, []);

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

export default ToastContainer;