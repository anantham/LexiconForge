
import React from 'react';

const ThumbsUpIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
  >
    <path d="M2 20h2v-8H2v8zm19.82-8.43c.12-.21.18-.46.18-.72 0-.9-.58-1.65-1.32-1.94L18.39 8H14V4c0-1.1-.9-2-2-2h-1c-.55 0-1 .45-1 1v1.82l-3.41 3.42c-.33.34-.59.77-.59 1.25V19c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l2.8-6.35c.19-.42.28-.88.18-1.35z" />
  </svg>
);

export default ThumbsUpIcon;
