type ToastAction = {
  label: string;
  onClick: () => void;
};

export interface ToastProps {
  title: string;
  description?: string;
  action?: ToastAction;
  _duration?: number;
}

export function useToast() {
  let toastId = 0;

  const dismiss = (id: number) => {
    const element = document.getElementById(`toast-${id}`);
    if (element) {
      element.style.transition = 'opacity 0.3s ease-out';
      element.style.opacity = '0';
      setTimeout(() => element?.remove(), 300);
    }
  };

  return (props: ToastProps) => {
    toastId++;
    const id = toastId;
    const element = document.createElement('div');
    element.id = `toast-${id}`;
    element.className = `
      fixed bottom-4 right-4 flex items-center gap-3 rounded-md border p-3 shadow-lg
      transition-all duration-300 transform translate-y-6
      bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5
    `;
    element.innerHTML = `
      <div className="flex items-center">
        <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-brand text-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
        <div className="ml-3">
          <p className="font-medium text-gray-900 dark:text-gray-100">{props.title}</p>
          {props.description && <p className="text-sm text-gray-500 dark:text-gray-400">{props.description}</p>}
        </div>
      </div>
    `;
    document.body.appendChild(element);

    // Auto dismiss
    setTimeout(() => dismiss(id), props._duration ?? 5000);

    return () => dismiss(id);
  };
}
