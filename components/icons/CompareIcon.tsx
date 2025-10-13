import React from 'react';

const CompareIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    width={20}
    height={20}
    {...props}
  >
    <path
      d="M5 4h5l-1.5 1.5 3 3L11 10l-3-3L6.5 8.5V4zM15 16h-5l1.5-1.5-3-3L9 10l3 3 1.5-1.5V16z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default CompareIcon;
