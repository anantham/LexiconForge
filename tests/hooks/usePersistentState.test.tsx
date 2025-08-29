import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import usePersistentState from '../../hooks/usePersistentState';

function PersistComp<T extends any>({
  storageKey,
  defaultValue,
  opts
}: { storageKey: string; defaultValue: any; opts?: any }) {
  const [value, setValue] = usePersistentState<any>(storageKey, defaultValue, opts);
  return (
    <div>
      <div data-testid="value">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</div>
      <button data-testid="inc" onClick={() => setValue((v: any) => (typeof v === 'number' ? v + 1 : v))}>inc</button>
      <button data-testid="setStr" onClick={() => setValue('updated')}>set</button>
      <button data-testid="setObj" onClick={() => setValue({ a: 2 })}>setObj</button>
    </div>
  );
}

describe('usePersistentState', () => {
  it('returns default when key missing', () => {
    render(<PersistComp storageKey="k1" defaultValue={42} />);
    expect(screen.getByTestId('value').textContent).toBe('42');
  });

  it('handles parse errors gracefully', () => {
    localStorage.setItem('k2', '{not valid json');
    render(<PersistComp storageKey="k2" defaultValue={7} />);
    expect(screen.getByTestId('value').textContent).toBe('7');
  });

  it('applies migration when version mismatch', async () => {
    localStorage.setItem('k3', JSON.stringify({ __v: 1, value: 'old' }));
    render(
      <PersistComp
        storageKey="k3"
        defaultValue="def"
        opts={{ version: 2, migrate: (old: unknown, v: number) => 'migrated' }}
      />
    );
    expect(screen.getByTestId('value').textContent).toBe('migrated');
    // After an update, it should write with new version
    await act(async () => { await userEvent.click(screen.getByTestId('setStr')); });
    const stored = JSON.parse(localStorage.getItem('k3') || '{}');
    expect(stored.__v).toBe(2);
  });

  it('decodes on load and encodes on save', async () => {
    localStorage.setItem('k4', JSON.stringify({ __v: 1, value: { n: 3 } }));
    const decode = (json: any) => {
      if (typeof json?.n !== 'number') throw new Error('bad');
      return json.n;
    };
    const encode = (v: any) => ({ n: v, extra: true });
    render(<PersistComp storageKey="k4" defaultValue={0} opts={{ decode, encode }} />);
    expect(screen.getByTestId('value').textContent).toBe('3');
    await act(async () => { await userEvent.click(screen.getByTestId('inc')); });
    const stored = JSON.parse(localStorage.getItem('k4') || '{}');
    expect(stored.value).toEqual({ n: 4, extra: true });
  });

  it('syncs across tabs via storage event', async () => {
    render(<PersistComp storageKey="k5" defaultValue="a" opts={{ syncAcrossTabs: true }} />);
    // Simulate an external tab change
    const newValue = JSON.stringify({ __v: 1, value: 'remote' });
    window.dispatchEvent(new StorageEvent('storage', { key: 'k5', newValue }));
    await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('remote'));
  });

  it('catches write failures without breaking UI', async () => {
    const spy = vi.spyOn(localStorage.__proto__, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    render(<PersistComp storageKey="k6" defaultValue={1} />);
    await act(async () => { await userEvent.click(screen.getByTestId('inc')); });
    // UI still updates locally
    expect(screen.getByTestId('value').textContent).toBe('2');
    spy.mockRestore();
  });
});

