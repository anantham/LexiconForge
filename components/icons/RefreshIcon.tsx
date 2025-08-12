
import React from 'react';

/**
 * A reusable refresh icon component.
 * This was created specifically for the Phase 3 re-translation feature, providing
 * a clear and intuitive UI element for the button in ChapterView.
 */
const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7V9a1 1 0 01-2 0V3a1 1 0 011-1zm12 14a1 1 0 01-1-1v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 111.885-.666A5.002 5.002 0 0014.001 13V11a1 1 0 112 0v5a1 1 0 01-1 1z"
      clipRule="evenodd"
    />
  </svg>
);

export default RefreshIcon;