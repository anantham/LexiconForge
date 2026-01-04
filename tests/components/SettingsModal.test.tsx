import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsModal from '../../components/SettingsModal';

describe('SettingsModal Sidebar Navigation', () => {
  it('should render all sidebar sections and items', () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />);

    // Check for sidebar section headers (Settings appears twice - header + sidebar)
    expect(screen.getAllByText('Settings').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Workspace')).toBeInTheDocument();

    // Check for sidebar items
    expect(screen.getByText('Providers')).toBeInTheDocument();
    expect(screen.getByText('Prompt')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    expect(screen.getByText('Display')).toBeInTheDocument();
    // Audio is hidden when enableAudio is false (default)
    expect(screen.queryByText('Audio')).not.toBeInTheDocument();
    expect(screen.getByText('Templates')).toBeInTheDocument();
    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getByText('Gallery')).toBeInTheDocument();
  });

  it('should switch to Metadata panel on click', () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />);

    const metadataItem = screen.getByText('Metadata');
    fireEvent.click(metadataItem);

    // Should show metadata form header
    expect(screen.getByText('Novel Metadata')).toBeInTheDocument();
    expect(screen.getByText('Basic Information')).toBeInTheDocument();
  });

  it('should show Export panel with action buttons', () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />);

    // Find and click the Export item in the sidebar
    const exportItems = screen.getAllByText('Export');
    // Second one is the sidebar item (first is section header)
    fireEvent.click(exportItems[1]);

    // Check for current button text
    expect(screen.getByText('Quick Export (Session Only)')).toBeInTheDocument();
    expect(screen.getByText('Publish to Library')).toBeInTheDocument();
  });
});
