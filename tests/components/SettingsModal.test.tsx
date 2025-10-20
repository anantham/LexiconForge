import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsModal from '../../components/SettingsModal';

describe('SettingsModal Tabs', () => {
  it('should render all tabs', () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />);

    expect(screen.getByText('Translation')).toBeInTheDocument();
    expect(screen.getByText('EPUB')).toBeInTheDocument();
    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByText('Preferences')).toBeInTheDocument();
  });

  it('should switch to Metadata tab on click', () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />);

    const metadataTab = screen.getByText('Metadata');
    fireEvent.click(metadataTab);

    // Should show metadata form
    expect(screen.getByText('Novel Information')).toBeInTheDocument();
  });

  it('should show Export tab with action buttons', () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />);

    const exportTab = screen.getByText('Export');
    fireEvent.click(exportTab);

    expect(screen.getByText('Export Session JSON')).toBeInTheDocument();
    expect(screen.getByText('Publish to Library')).toBeInTheDocument();
  });
});
