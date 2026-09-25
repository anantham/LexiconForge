import React, { useRef, useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useModalDialog } from '../../hooks/useModalDialog';

const Harness: React.FC = () => {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalDialog(dialogRef, open, () => setOpen(false));
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      <button type="button">Behind the dialog</button>
      {open && (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Test dialog" tabIndex={-1}>
          <button type="button">First</button>
          <input aria-label="Middle" />
          <button type="button" disabled>Disabled</button>
          <button type="button">Last</button>
        </div>
      )}
    </>
  );
};

const press = (key: string, shiftKey = false) =>
  fireEvent.keyDown(document.activeElement ?? document.body, { key, shiftKey });

const openDialog = () => {
  const opener = screen.getByRole('button', { name: 'Open' });
  opener.focus();
  fireEvent.click(opener);
  return opener;
};

describe('useModalDialog', () => {
  it('moves focus into the dialog when it opens', () => {
    render(<Harness />);
    openDialog();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('wraps Tab from the last control to the first, skipping disabled ones', () => {
    render(<Harness />);
    openDialog();
    screen.getByRole('button', { name: 'Last' }).focus();
    press('Tab');
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('wraps Shift+Tab from the first control to the last', () => {
    render(<Harness />);
    openDialog();
    press('Tab', true);
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
  });

  it('pulls focus back inside if it has escaped to the page behind', () => {
    render(<Harness />);
    openDialog();
    screen.getByRole('button', { name: 'Behind the dialog' }).focus();
    press('Tab');
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('closes on Escape and returns focus to the opener', () => {
    render(<Harness />);
    const opener = openDialog();
    press('Escape');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
