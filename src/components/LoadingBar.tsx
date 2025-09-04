/**
 * A reusable theme-aware loading bar component.
 * Supports determinate (0..1) and indeterminate modes.
 */
import React, { FC, useMemo } from 'react';

interface LoadingBarProps {
  visible: boolean;
  progress?: number; // 0..1 for determinate; undefined for indeterminate
  label?: string;
  position?: 'bottom' | 'side';
  className?: string;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const LoadingBar: FC<LoadingBarProps> = ({ visible, progress, label, position = 'bottom', className }) => {
  const pct = useMemo(() =>
    typeof progress === 'number' && !Number.isNaN(progress)
      ? Math.round(clamp01(progress) * 100)
      : undefined
  , [progress]);

  if (!visible) return null;

  return (
    <div className={`loading-bar loading-bar--${position} ${className || ''}`.trim()} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined}>
      <div className="loading-bar__track">
        {typeof pct === 'number' ? (
          <div className="loading-bar__fill" style={{ width: `${pct}%` }} />
        ) : (
          <div className="loading-bar__fill loading-bar__fill--indeterminate" />
        )}
      </div>
      {label && <div className="loading-bar__label" aria-live="polite">{label}</div>}
    </div>
  );
};

export default LoadingBar;

