import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastKind = "success" | "error" | "info" | "warning";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Auto-dismiss after ms (0 = sticky). Default 4500. */
  duration?: number;
}

interface ToastContextValue {
  toast: (kind: ToastKind, message: string, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
};

const KIND_STYLES: Record<ToastKind, { icon: React.ReactNode; ring: string }> =
  {
    success: {
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
      ring: "border-emerald-200 dark:border-emerald-800/70",
    },
    error: {
      icon: <XCircle className="w-4 h-4 text-rose-500 shrink-0" />,
      ring: "border-rose-200 dark:border-rose-800/70",
    },
    info: {
      icon: <Info className="w-4 h-4 text-sky-500 shrink-0" />,
      ring: "border-sky-200 dark:border-sky-800/70",
    },
    warning: {
      icon: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
      ring: "border-amber-200 dark:border-amber-800/70",
    },
  };

let nextId = 1;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (kind: ToastKind, message: string, duration = 4500) => {
      const id = nextId++;
      setToasts((prev) => [...prev.slice(-4), { id, kind, message, duration }]);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (m) => toast("success", m),
      error: (m) => toast("error", m, 7000),
      info: (m) => toast("info", m),
      warning: (m) => toast("warning", m),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast viewport — top-right, accessible */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,380px)] pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2.5 rounded-xl bg-white dark:bg-slate-900 border ${KIND_STYLES[t.kind].ring} shadow-lg px-3.5 py-3 text-sm animate-in fade-in-50 slide-in-from-top-2 duration-200`}
          >
            {KIND_STYLES[t.kind].icon}
            <div className="flex-1 min-w-0 text-slate-800 dark:text-slate-100 break-words leading-snug">
              {t.message}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 p-0.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
