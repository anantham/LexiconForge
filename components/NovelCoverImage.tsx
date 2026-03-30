import React from 'react';
import { BookOpen } from 'lucide-react';

interface NovelCoverImageProps {
  src?: string;
  alt: string;
  imgClassName: string;
  placeholderClassName: string;
  iconClassName: string;
  loading?: 'eager' | 'lazy';
}

export function NovelCoverImage({
  src,
  alt,
  imgClassName,
  placeholderClassName,
  iconClassName,
  loading = 'lazy',
}: NovelCoverImageProps) {
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div className={placeholderClassName} data-testid="novel-cover-placeholder">
        <BookOpen className={iconClassName} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={imgClassName}
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  );
}
