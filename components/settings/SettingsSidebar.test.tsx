import { render, screen, within } from '@testing-library/react';
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

// The sidebar nav (tablet/desktop); phones get the native picker instead.
const nav = () => within(screen.getByRole('navigation', { name: 'Settings sections' }));

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

    expect(nav().getByText('Settings')).toBeInTheDocument();
    expect(nav().getByText('Features')).toBeInTheDocument();
    expect(nav().getByText('Providers')).toBeInTheDocument();
    expect(nav().getByText('Audio')).toBeInTheDocument();
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

    await user.click(nav().getByText('Audio'));
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

    const activeItem = nav().getByText('Providers').closest('button');
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
    expect(nav().getByText('Providers')).toBeInTheDocument();

    // Click Settings section header to collapse
    await user.click(nav().getByText('Settings'));

    // Items should be hidden after collapse
    expect(nav().queryByText('Providers')).not.toBeInTheDocument();

    // Click again to expand
    await user.click(nav().getByText('Settings'));

    // Items visible again
    expect(nav().getByText('Providers')).toBeInTheDocument();
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

    expect(nav().getByText('Visible')).toBeInTheDocument();
    expect(nav().queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('marks the active item and each section expanded state for assistive tech', async () => {
    const user = userEvent.setup();
    render(<SettingsSidebar sections={mockSections} activeItem="providers" onSelect={vi.fn()} />);

    expect(nav().getByRole('button', { name: 'Providers' })).toHaveAttribute('aria-current', 'page');
    expect(nav().getByRole('button', { name: 'Prompt' })).not.toHaveAttribute('aria-current');
    const header = nav().getByRole('button', { name: /Settings/ });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    await user.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  it('offers phones a labelled section picker that selects the chosen panel', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SettingsSidebar sections={mockSections} activeItem="providers" onSelect={onSelect} />);

    const picker = screen.getByRole('combobox', { name: 'Settings section' });
    expect(picker).toHaveValue('providers');
    await user.selectOptions(picker, 'audio');
    expect(onSelect).toHaveBeenCalledWith('audio');
  });
});
