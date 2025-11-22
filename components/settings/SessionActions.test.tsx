import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SessionActions from './SessionActions';

const createFileReaderMock = (result: string) => {
  class MockFileReader {
    onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
    readAsText = vi.fn(() => {
      this.onload?.({
        target: { result },
      } as ProgressEvent<FileReader>);
    });
  }
  return MockFileReader;
};

describe('SessionActions', () => {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const onClear = vi.fn();
  const onImport = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).FileReader = createFileReaderMock('{"foo":"bar"}');
  });

  const renderActions = () =>
    render(
      <SessionActions
        onSave={onSave}
        onCancel={onCancel}
        onClear={onClear}
        onImport={onImport}
      />
    );

  it('triggers save and cancel actions', async () => {
    const user = userEvent.setup();
    renderActions();

    const saveButtons = screen.getAllByRole('button', { name: /save changes/i });
    await user.click(saveButtons[0]);

    const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
    await user.click(cancelButtons[0]);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onClear when clicking clear session', async () => {
    const user = userEvent.setup();
    renderActions();

    const clearButtons = screen.getAllByRole('button', { name: /clear session/i });
    await user.click(clearButtons[0]);

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('parses import file and calls onImport', () => {
    const { container } = renderActions();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const file = new File(['{}'], 'session.json', { type: 'application/json' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(onImport).toHaveBeenCalledWith({ foo: 'bar' });
  });
});
