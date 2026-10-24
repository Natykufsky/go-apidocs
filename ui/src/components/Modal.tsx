import React, { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Max width class, e.g. "max-w-lg" (default), "max-w-2xl", "max-w-4xl" */
  widthClass?: string;
  children: React.ReactNode;
  /** Hide the default header (for fully custom layouts) */
  hideHeader?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Shared modal shell: focus trap, ESC to close, body scroll lock,
 * backdrop click, and consistent enter animation.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  widthClass = "max-w-lg",
  children,
  hideHeader = false,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable =
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown, true);

    // Move focus into the modal
    const t = window.setTimeout(() => {
      const el = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (el || panelRef.current)?.focus();
    }, 30);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown, true);
      window.clearTimeout(t);
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/50 dark:bg-black/70 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Dialog"}
        tabIndex={-1}
        className={`relative w-full ${widthClass} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col outline-none animate-in fade-in-50 zoom-in-95 duration-200`}
      >
        {!hideHeader && (
          <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="min-w-0">
              {title && (
                <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};
