import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SettingsSidebar, type SidebarSection } from './SettingsSidebar';

const mockSections: SidebarSection[] = [
  {
    id: 'settings',
    label: 'Settings',
    icon: '⚙️',
    items: [
      { id: 'providers', label: 'Providers' },
      { id: 'prompt', label: 'Prompt' },
      { id: 'advanced', label: 'Advanced' },
    ],
  },
  {
    id: 'features',
    label: 'Features',
    icon: '✨',
    items: [
      { id: 'display', label: 'Display' },
      { id: 'audio', label: 'Audio' },
    ],
  },
];

describe('SettingsSidebar', () => {
  it('renders all sections and items', () => {
    const onSelect = vi.fn();
    render(
      <SettingsSidebar
        sections={mockSections}
        activeItem="providers"
        onSelect={onSelect}
      />
    );

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Providers')).toBeInTheDocument();
    expect(screen.getByText('Audio')).toBeInTheDocument();
  });

  it('calls onSelect when item clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <SettingsSidebar
        sections={mockSections}
        activeItem="providers"
        onSelect={onSelect}
      />
    );

    await user.click(screen.getByText('Audio'));
    expect(onSelect).toHaveBeenCalledWith('audio');
  });

  it('highlights active item', () => {
    const onSelect = vi.fn();
    render(
      <SettingsSidebar
        sections={mockSections}
        activeItem="providers"
        onSelect={onSelect}
      />
    );

    const activeItem = screen.getByText('Providers').closest('button');
    expect(activeItem).toHaveClass('bg-blue-600');
  });

  it('can collapse and expand sections', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <SettingsSidebar
        sections={mockSections}
        activeItem="providers"
        onSelect={onSelect}
      />
    );

    // Initially all items are visible
    expect(screen.getByText('Providers')).toBeInTheDocument();

    // Click Settings section header to collapse
    await user.click(screen.getByText('Settings'));

    // Items should be hidden after collapse
    expect(screen.queryByText('Providers')).not.toBeInTheDocument();

    // Click again to expand
    await user.click(screen.getByText('Settings'));

    // Items visible again
    expect(screen.getByText('Providers')).toBeInTheDocument();
  });

  it('hides items marked as hidden', () => {
    const onSelect = vi.fn();
    const sectionsWithHidden: SidebarSection[] = [
      {
        id: 'test',
        label: 'Test',
        icon: '🧪',
        items: [
          { id: 'visible', label: 'Visible' },
          { id: 'hidden', label: 'Hidden', hidden: true },
        ],
      },
    ];

    render(
      <SettingsSidebar
        sections={sectionsWithHidden}
        activeItem="visible"
        onSelect={onSelect}
      />
    );

    expect(screen.getByText('Visible')).toBeInTheDocument();
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });
});
