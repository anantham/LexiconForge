import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsModal from '../../components/SettingsModal';

describe('SettingsModal Tabs', () => {
  it('should render all tabs', () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />);

    // Check for current tab names (updated UI)
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getByText('Templates')).toBeInTheDocument();
    expect(screen.getByText('Audio')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
  });

  it('should switch to Metadata tab on click', () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />);

    const metadataTab = screen.getByText('Metadata');
    fireEvent.click(metadataTab);

    // Should show metadata form header (updated text)
    expect(screen.getByText('Novel Metadata')).toBeInTheDocument();
    expect(screen.getByText('Basic Information')).toBeInTheDocument();
  });

  it('should show Export tab with action buttons', () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />);

    const exportTab = screen.getByText('Export');
    fireEvent.click(exportTab);

    // Check for current button text (updated UI)
    expect(screen.getByText('Quick Export (Session Only)')).toBeInTheDocument();
    expect(screen.getByText('Publish to Library')).toBeInTheDocument();
  });
});
