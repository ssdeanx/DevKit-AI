import React, { useEffect, useState } from 'react';
import { ToastMessage } from '../../context/ToastContext';
import { CheckCircleIcon, CloseIcon, XCircleIcon } from '../icons';
import { cn } from '../../lib/utils';

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ toast, onDismiss, duration = 5000 }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(toast.id), 120); // allow exit animation
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, duration, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 120);
  };

  const Icon = toast.variant === 'destructive' ? XCircleIcon : CheckCircleIcon;

  return (
    <div
      className={cn(
        "toast-root animate-toast-slide-in-right",
        isExiting && "animate-toast-hide"
      )}
      data-variant={toast.variant}
    >
        <div className="flex items-start gap-3">
            <Icon className={cn(
                "w-5 h-5 mt-0.5",
                toast.variant === 'destructive' ? 'text-destructive' : 'text-success'
            )}/>
            <div className="flex-1">
                <p className="font-semibold">{toast.title}</p>
                {toast.description && <p className="text-sm text-muted-foreground mt-1">{toast.description}</p>}
            </div>
            <button onClick={handleDismiss} className="p-1 rounded-md hover:bg-accent -mr-1 -mt-1">
                <CloseIcon className="w-4 h-4 text-muted-foreground"/>
            </button>
        </div>
    </div>
  );
};

export default Toast;
