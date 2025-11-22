import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FooterNavigation from '../../../components/chapter/FooterNavigation';

describe('FooterNavigation', () => {
  it('disables buttons when URLs missing', () => {
    render(
      <FooterNavigation
        prevUrl={null}
        nextUrl={null}
        isLoading={false}
        onNavigatePrev={vi.fn()}
        onNavigateNext={vi.fn()}
      />
    );
    expect(screen.getByText(/Previous/)).toBeDisabled();
    expect(screen.getByText(/Next/)).toBeDisabled();
  });

  it('calls navigation handlers when enabled', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(
      <FooterNavigation
        prevUrl="/prev"
        nextUrl="/next"
        isLoading={false}
        onNavigatePrev={onPrev}
        onNavigateNext={onNext}
      />
    );
    fireEvent.click(screen.getByText(/Previous/));
    fireEvent.click(screen.getByText(/Next/));
    expect(onPrev).toHaveBeenCalled();
    expect(onNext).toHaveBeenCalled();
  });
});
