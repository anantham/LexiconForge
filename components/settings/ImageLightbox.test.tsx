import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageLightbox } from './ImageLightbox';
import type { GalleryImage } from './GalleryPanel';

// Mock useBlobUrl hook
vi.mock('../../hooks/useBlobUrl', () => ({
  useBlobUrl: vi.fn(() => 'blob:test-image-url'),
}));

const createMockImage = (id: string, prompt: string): GalleryImage => ({
  chapterId: `chapter-${id}`,
  chapterTitle: `Chapter ${id}`,
  marker: `img-${id}`,
  prompt,
  imageCacheKey: { chapterId: `chapter-${id}`, placementMarker: `img-${id}`, version: 1 },
});

describe('ImageLightbox', () => {
  const mockImages: GalleryImage[] = [
    createMockImage('1', 'First image prompt'),
    createMockImage('2', 'Second image prompt'),
    createMockImage('3', 'Third image prompt'),
  ];

  const defaultProps = {
    image: mockImages[0],
    allImages: mockImages,
    onClose: vi.fn(),
    onSetCover: vi.fn(),
    isCover: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders image and info panel', () => {
    render(<ImageLightbox {...defaultProps} />);

    expect(screen.getByText(/Chapter 1/)).toBeInTheDocument();
    expect(screen.getByText(/Image 1 of 3/)).toBeInTheDocument();
    expect(screen.getByText(/First image prompt/)).toBeInTheDocument();
  });

  it('displays "Set as Cover" button when not cover', () => {
    render(<ImageLightbox {...defaultProps} isCover={false} />);

    expect(screen.getByRole('button', { name: /Set as Cover/i })).toBeInTheDocument();
  });

  it('displays "Cover Selected" when already cover', () => {
    render(<ImageLightbox {...defaultProps} isCover={true} />);

    expect(screen.getByRole('button', { name: /Cover Selected/i })).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ImageLightbox {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /Close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape key pressed', () => {
    const onClose = vi.fn();

    render(<ImageLightbox {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('navigates to next image when right arrow clicked', async () => {
    const user = userEvent.setup();

    render(<ImageLightbox {...defaultProps} />);

    expect(screen.getByText(/Image 1 of 3/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Next image/i }));

    expect(screen.getByText(/Image 2 of 3/)).toBeInTheDocument();
    expect(screen.getByText(/Second image prompt/)).toBeInTheDocument();
  });

  it('navigates to previous image when left arrow clicked', async () => {
    const user = userEvent.setup();

    render(<ImageLightbox {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /Previous image/i }));

    // Wraps around to last image
    expect(screen.getByText(/Image 3 of 3/)).toBeInTheDocument();
    expect(screen.getByText(/Third image prompt/)).toBeInTheDocument();
  });

  it('navigates with arrow keys', () => {
    render(<ImageLightbox {...defaultProps} />);

    expect(screen.getByText(/Image 1 of 3/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText(/Image 2 of 3/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText(/Image 1 of 3/)).toBeInTheDocument();
  });

  it('wraps around navigation at boundaries', async () => {
    const user = userEvent.setup();

    // Start at first image
    render(<ImageLightbox {...defaultProps} image={mockImages[0]} />);

    expect(screen.getByText(/Image 1 of 3/)).toBeInTheDocument();

    // Go backwards - should wrap to last
    await user.click(screen.getByRole('button', { name: /Previous image/i }));
    expect(screen.getByText(/Image 3 of 3/)).toBeInTheDocument();

    // Go forward - should wrap to first
    await user.click(screen.getByRole('button', { name: /Next image/i }));
    expect(screen.getByText(/Image 1 of 3/)).toBeInTheDocument();
  });

  it('calls onSetCover when "Set as Cover" clicked', async () => {
    const user = userEvent.setup();
    const onSetCover = vi.fn();

    render(<ImageLightbox {...defaultProps} onSetCover={onSetCover} />);

    await user.click(screen.getByRole('button', { name: /Set as Cover/i }));
    expect(onSetCover).toHaveBeenCalledWith(mockImages[0]);
  });

  it('hides navigation arrows when only one image', () => {
    render(
      <ImageLightbox
        {...defaultProps}
        allImages={[mockImages[0]]}
      />
    );

    expect(screen.queryByRole('button', { name: /Previous image/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Next image/i })).not.toBeInTheDocument();
  });

  it('closes when backdrop clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { container } = render(<ImageLightbox {...defaultProps} onClose={onClose} />);

    // Click the backdrop (the outermost div)
    const backdrop = container.querySelector('.fixed.inset-0');
    if (backdrop) {
      await user.click(backdrop);
      expect(onClose).toHaveBeenCalled();
    }
  });
});
