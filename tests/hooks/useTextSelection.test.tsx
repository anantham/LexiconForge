import React, { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useTextSelection } from '../../hooks/useTextSelection';

function TestComponent() {
  const ref = useRef<HTMLDivElement>(null);
  const { selection } = useTextSelection(ref);
  return (
    <div>
      <div data-testid="container" ref={ref}>
        <p id="p">Hello world</p>
      </div>
      <div data-testid="outside"><p>Outside</p></div>
      <div data-testid="sel">{selection ? `${selection.text}|${Math.round(selection.rect.width)}x${Math.round(selection.rect.height)}` : 'none'}</div>
    </div>
  );
}

// Helpers to mock window.getSelection with a custom range and geometry
const makeRange = (start: Node, end: Node, rects: Array<{left:number;top:number;right:number;bottom:number}> = [],
  bbox?: {left:number;top:number;right:number;bottom:number}) => {
  const range: any = {
    startContainer: start,
    endContainer: end,
    getClientRects: () => rects.map(r => ({ ...r, width: r.right - r.left, height: r.bottom - r.top } as DOMRect)) as any,
    getBoundingClientRect: () => {
      const b = bbox ?? { left: 0, top: 0, right: 0, bottom: 0 };
      return { ...b, width: b.right - b.left, height: b.bottom - b.top } as DOMRect;
    }
  };
  return range;
};

const setSelectionMock = (text: string, range: any, opts?: { collapsed?: boolean; anchor?: Node }) => {
  (window as any).getSelection = () => ({
    rangeCount: 1,
    isCollapsed: !!opts?.collapsed,
    anchorNode: opts?.anchor ?? range.startContainer,
    toString: () => text,
    getRangeAt: () => range,
    removeAllRanges: () => {}
  });
};

describe('useTextSelection', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    // Ensure DOMRect exists (jsdom has it, but define if missing)
    if (!(globalThis as any).DOMRect) {
      (globalThis as any).DOMRect = class DOMRect {
        x = 0; y = 0; width = 0; height = 0; left = 0; top = 0; right = 0; bottom = 0;
        constructor(x=0,y=0,w=0,h=0){ this.x=x; this.y=y; this.width=w; this.height=h; this.left=x; this.top=y; this.right=x+w; this.bottom=y+h; }
      } as any;
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('captures selection inside container with union rect', async () => {
    render(<TestComponent />);
    const container = screen.getByTestId('container');
    const textNode = container.querySelector('#p')!.firstChild as Node;
    const range = makeRange(textNode, textNode, [
      { left: 10, top: 10, right: 50, bottom: 30 },
      { left: 40, top: 25, right: 80, bottom: 45 },
    ]);
    setSelectionMock('Hello', range);

    // Fire mouseup to trigger handler
    await act(async () => { document.dispatchEvent(new MouseEvent('mouseup')); });

    expect(screen.getByTestId('sel').textContent).toBe('Hello|70x35');
  });

  it('clears selection if outside container', () => {
    render(<TestComponent />);
    const container = screen.getByTestId('container');
    const outside = screen.getByTestId('outside');
    const insideNode = container.querySelector('#p')!.firstChild as Node;
    const outsideNode = outside.querySelector('p')!.firstChild as Node;
    const range = makeRange(insideNode, outsideNode);
    setSelectionMock('Outside', range);
    act(() => { document.dispatchEvent(new MouseEvent('mouseup')); });
    expect(screen.getByTestId('sel').textContent).toBe('none');
  });

  it('clears on Escape key', async () => {
    render(<TestComponent />);
    const container = screen.getByTestId('container');
    const textNode = container.querySelector('#p')!.firstChild as Node;
    const range = makeRange(textNode, textNode, [], { left: 1, top: 1, right: 11, bottom: 11 });
    setSelectionMock('Hello', range);
    act(() => { document.dispatchEvent(new MouseEvent('mouseup')); });
    expect(screen.getByTestId('sel').textContent).toContain('Hello|10x10');
    // Press Escape to clear
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(screen.getByTestId('sel').textContent).toBe('none');
  });

  it('clears on scroll', async () => {
    render(<TestComponent />);
    const container = screen.getByTestId('container');
    const textNode = container.querySelector('#p')!.firstChild as Node;
    const range = makeRange(textNode, textNode, [], { left: 1, top: 1, right: 11, bottom: 11 });
    setSelectionMock('Hello', range);
    act(() => { document.dispatchEvent(new MouseEvent('mouseup')); });
    expect(screen.getByTestId('sel').textContent).toContain('Hello|10x10');
    // Any scroll event captured at document should clear
    await act(async () => { document.dispatchEvent(new Event('scroll', { bubbles: true })); });
    expect(screen.getByTestId('sel').textContent).toBe('none');
  });

  it('preserves an active selection during touch handle auto-scroll', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    render(<TestComponent />);
    const container = screen.getByTestId('container');
    const textNode = container.querySelector('#p')!.firstChild as Node;
    const range = makeRange(textNode, textNode, [], { left: 1, top: 1, right: 11, bottom: 11 });
    setSelectionMock('Hello', range);
    act(() => { document.dispatchEvent(new MouseEvent('mouseup')); });

    act(() => { document.dispatchEvent(new Event('scroll', { bubbles: true })); });

    expect(screen.getByTestId('sel').textContent).toBe('Hello|10x10');
  });

  it('captures the final native selection after touchend', async () => {
    vi.useFakeTimers();
    render(<TestComponent />);
    const container = screen.getByTestId('container');
    const textNode = container.querySelector('#p')!.firstChild as Node;
    const range = makeRange(textNode, textNode, [], { left: 1, top: 1, right: 11, bottom: 11 });
    setSelectionMock('Hello', range);

    document.dispatchEvent(new Event('touchend', { bubbles: true }));
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });

    expect(screen.getByTestId('sel').textContent).toBe('Hello|10x10');
  });

  it('ignores collapsed or empty selections', () => {
    render(<TestComponent />);
    const container = screen.getByTestId('container');
    const textNode = container.querySelector('#p')!.firstChild as Node;
    const range = makeRange(textNode, textNode);
    setSelectionMock('', range, { collapsed: true });
    act(() => { document.dispatchEvent(new MouseEvent('mouseup')); });
    expect(screen.getByTestId('sel').textContent).toBe('none');
  });
});
