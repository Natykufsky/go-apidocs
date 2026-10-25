import React, { useEffect, useRef, useCallback, useId } from 'react';
import { X } from 'lucide-react';

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

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  widthClass = 'max-w-lg',
  children,
  hideHeader = false,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const subtitleId = useId();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
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
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown, true);

    // Move focus into the modal after the enter animation
    const t = window.setTimeout(() => {
      const el = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (el || panelRef.current)?.focus();
    }, 30);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown, true);
      window.clearTimeout(t);
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6"
      style={{ animation: 'modal-fade 180ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop — glass, theme-aware */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'color-mix(in srgb, #000000 42%, transparent)',
          backdropFilter: 'blur(12px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={subtitle ? subtitleId : undefined}
        aria-label={!title ? 'Dialog' : undefined}
        tabIndex={-1}
        className={`relative w-full ${widthClass} flex flex-col outline-none overflow-hidden`}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          boxShadow:
            'var(--shadow-xl), 0 1px 0 rgba(255, 255, 255, 0.04) inset',
          maxHeight: '90vh',
          animation: 'modal-pop 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {!hideHeader && (
          <div
            className="flex items-start justify-between gap-4 px-5 py-4"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <div className="min-w-0 flex-1">
              {title && (
                <h2
                  id={titleId}
                  className="text-[15px] font-semibold truncate leading-tight"
                  style={{
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.015em',
                  }}
                >
                  {title}
                </h2>
              )}
              {subtitle && (
                <p
                  id={subtitleId}
                  className="text-[12.5px] mt-1 leading-relaxed"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 grid place-items-center w-7 h-7 rounded-[var(--r-sm)] transition-colors focus-visible:outline-none"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow =
                  '0 0 0 2px var(--border-focus), 0 0 0 5px var(--accent-muted)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
              aria-label="Close dialog"
            >
              <X className="w-[15px] h-[15px]" />
            </button>
          </div>
        )}

        <div className="overflow-y-auto flex-1 min-h-0">{children}</div>
      </div>

      {/* Local keyframes — scoped to Modal so they never leak */}
      <style>{`
        @keyframes modal-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modal-pop {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="modal-fade"],
          [style*="modal-pop"] {
            animation-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
};