import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SettingsModal from '../../components/SettingsModal';

const sidebar = () => within(screen.getByRole('navigation', { name: 'Settings sections' }));

describe('SettingsModal Sidebar Navigation', () => {
  it('should render all sidebar sections and items', () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />);

    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(sidebar().getByText('Settings')).toBeInTheDocument();
    expect(sidebar().getByText('Features')).toBeInTheDocument();
    expect(sidebar().getByText('Workspace')).toBeInTheDocument();

    // Check for sidebar items
    expect(sidebar().getByText('Providers')).toBeInTheDocument();
    expect(sidebar().getByText('Prompt')).toBeInTheDocument();
    expect(sidebar().getByText('Advanced')).toBeInTheDocument();
    expect(sidebar().getByText('Display')).toBeInTheDocument();
    // Audio is hidden when enableAudio is false (default)
    expect(screen.queryByText('Audio')).not.toBeInTheDocument();
    expect(sidebar().getByText('Templates')).toBeInTheDocument();
    expect(sidebar().getByText('Metadata')).toBeInTheDocument();
    expect(sidebar().getByText('Gallery')).toBeInTheDocument();
  });

  it('should switch to Metadata panel on click', () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />);

    const metadataItem = sidebar().getByRole('button', { name: 'Metadata' });
    fireEvent.click(metadataItem);

    // Should show metadata form header
    expect(screen.getByText('Novel Metadata')).toBeInTheDocument();
    expect(screen.getByText('Basic Information')).toBeInTheDocument();
  });

  it('should show Export panel with action buttons', () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />);

    // Find and click the Export item in the sidebar
    const exportItems = sidebar().getAllByText('Export');
    // Second one is the sidebar item (first is section header)
    fireEvent.click(exportItems[1]);

    // Check for current button text
    expect(screen.getByText('Quick Export (Session Only)')).toBeInTheDocument();
    expect(screen.getByText('Publish to Library')).toBeInTheDocument();
  });

  it('closes on Escape like Cancel', () => {
    let closed = 0;
    render(<SettingsModal isOpen={true} onClose={() => { closed += 1; }} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(closed).toBe(1);
  });
});
