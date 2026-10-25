import React from 'react';
import { Zap, Sparkles, Layers } from 'lucide-react';
import type { RendererChoice } from '../lib/rendererPreference';

interface Props {
  value: RendererChoice;
  onChange: (r: RendererChoice) => void;
}

const OPTIONS: Array<{
  id: RendererChoice;
  label: string;
  short: string;
  Icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  {
    id: 'swagger',
    label: 'Swagger',
    short: 'Swagger',
    Icon: Zap,
    description: 'Accordion · full Try It · most features',
  },
  {
    id: 'scalar',
    label: 'Scalar',
    short: 'Scalar',
    Icon: Sparkles,
    description: 'Modern 3-column · side panel',
  }
];

export const RendererSwitcher: React.FC<Props> = ({ value, onChange }) => (
  <div
    className="inline-flex items-center p-0.5 rounded-[var(--r-sm)]"
    style={{
      background: 'var(--bg-canvas)',
      border: '1px solid var(--border-subtle)',
    }}
    role="tablist"
    aria-label="API renderer"
  >
    {OPTIONS.map((opt) => {
      const active = value === opt.id;
      return (
        <button
          key={opt.id}
          role="tab"
          aria-selected={active}
          title={opt.description}
          onClick={() => onChange(opt.id)}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[11.5px] font-medium transition-colors"
          style={
            active
              ? {
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  boxShadow: 'var(--shadow-xs)',
                }
              : { color: 'var(--text-tertiary)' }
          }
          onMouseEnter={(e) => {
            if (!active) e.currentTarget.style.color = 'var(--text-secondary)';
          }}
          onMouseLeave={(e) => {
            if (!active) e.currentTarget.style.color = 'var(--text-tertiary)';
          }}
        >
          <opt.Icon className="w-3 h-3" />
          <span className="hidden md:inline">{opt.label}</span>
          <span className="md:hidden">{opt.short}</span>
        </button>
      );
    })}
  </div>
);