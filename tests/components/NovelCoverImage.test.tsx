import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NovelCoverImage } from '../../components/NovelCoverImage';

describe('NovelCoverImage', () => {
  it('renders cover images with a no-referrer policy', () => {
    render(
      <NovelCoverImage
        src="https://i.imgur.com/example.jpg"
        alt="Cover of Test Novel"
        imgClassName="cover-image"
        placeholderClassName="cover-placeholder"
        iconClassName="cover-icon"
      />
    );

    const image = screen.getByAltText('Cover of Test Novel');
    expect(image).toHaveAttribute('src', 'https://i.imgur.com/example.jpg');
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(image).toHaveAttribute('loading', 'lazy');
  });

  it('falls back to a placeholder when the cover image fails to load', () => {
    render(
      <NovelCoverImage
        src="https://i.imgur.com/example.jpg"
        alt="Cover of Broken Novel"
        imgClassName="cover-image"
        placeholderClassName="cover-placeholder"
        iconClassName="cover-icon"
      />
    );

    fireEvent.error(screen.getByAltText('Cover of Broken Novel'));

    expect(screen.getByTestId('novel-cover-placeholder')).toBeInTheDocument();
    expect(screen.queryByAltText('Cover of Broken Novel')).not.toBeInTheDocument();
  });

  it('resets the placeholder state when a new cover url is provided', () => {
    const { rerender } = render(
      <NovelCoverImage
        src="https://i.imgur.com/example.jpg"
        alt="Cover of Reset Novel"
        imgClassName="cover-image"
        placeholderClassName="cover-placeholder"
        iconClassName="cover-icon"
      />
    );

    fireEvent.error(screen.getByAltText('Cover of Reset Novel'));
    expect(screen.getByTestId('novel-cover-placeholder')).toBeInTheDocument();

    rerender(
      <NovelCoverImage
        src="https://i.imgur.com/new-example.jpg"
        alt="Cover of Reset Novel"
        imgClassName="cover-image"
        placeholderClassName="cover-placeholder"
        iconClassName="cover-icon"
      />
    );

    expect(screen.getByAltText('Cover of Reset Novel')).toHaveAttribute(
      'src',
      'https://i.imgur.com/new-example.jpg'
    );
  });
});
