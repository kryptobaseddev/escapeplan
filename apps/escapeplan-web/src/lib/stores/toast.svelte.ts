interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  duration?: number;
}

class ToastStore {
  toasts = $state<Toast[]>([]);

  add(toast: Omit<Toast, 'id'>) {
    const id = crypto.randomUUID();
    const newToast: Toast = { id, ...toast };
    this.toasts.push(newToast);

    const duration = toast.duration ?? 4000;
    if (duration > 0) {
      setTimeout(() => this.remove(id), duration);
    }
  }

  remove(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  success(message: string, duration?: number) {
    this.add({ type: 'success', message, duration });
  }

  error(message: string, duration?: number) {
    this.add({ type: 'error', message, duration });
  }

  info(message: string, duration?: number) {
    this.add({ type: 'info', message, duration });
  }

  warning(message: string, duration?: number) {
    this.add({ type: 'warning', message, duration });
  }
}

export const toastStore = new ToastStore();
