import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { hasTextSelection } from '../utils';

export function usePhaseNavigation({
  onNext,
  onPrev,
  onEscape,
  disabled,
}: {
  onNext: () => void;
  onPrev: () => void;
  onEscape?: () => void;
  disabled?: boolean;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const typing =
        tag === 'input' || tag === 'textarea' || target?.getAttribute('contenteditable') === 'true';

      if (typing) return;

      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }

      if (disabled) return;

      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled, onEscape, onNext, onPrev]);

  const gesture = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    pointerType: string;
    startedOnInteractive: boolean;
  } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const el = e.target as HTMLElement;
    const startedOnInteractive = !!el.closest?.('[data-interactive="true"]');
    gesture.current = {
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
      pointerType: (e as any).pointerType ?? 'mouse',
      startedOnInteractive,
    };
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (!gesture.current) return;

    const g = gesture.current;
    gesture.current = null;

    if (g.startedOnInteractive) return;
    if (hasTextSelection()) return;

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    const dt = Date.now() - g.startTime;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    const SWIPE_MIN = 60;
    if (absX > SWIPE_MIN && absX > absY * 1.2) {
      if (dx < 0) onNext();
      else onPrev();
      return;
    }

    const TAP_MAX_MOVE = 12;
    const TAP_MAX_TIME = 280;
    if ((g.pointerType === 'touch' || g.pointerType === 'pen') && absX < TAP_MAX_MOVE && absY < TAP_MAX_MOVE && dt < TAP_MAX_TIME) {
      const w = window.innerWidth || 1;
      const ratio = e.clientX / w;
      if (ratio < 0.18) onPrev();
      if (ratio > 0.82) onNext();
    }
  };

  return { onPointerDown, onPointerUp };
}
