import React from 'react';

const PortalIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    width={20}
    height={20}
    {...props}
  >
    {/* Spiral portal */}
    <path
      d="M10 3a7 7 0 0 1 7 7h-2.5a4.5 4.5 0 0 0-4.5-4.5V3z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17 10a7 7 0 0 1-7 7v-2.5a4.5 4.5 0 0 0 4.5-4.5H17z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10 17a7 7 0 0 1-7-7h2.5a4.5 4.5 0 0 0 4.5 4.5V17z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 10a7 7 0 0 1 7-7v2.5A4.5 4.5 0 0 0 5.5 10H3z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Entry arrow pointing into center */}
    <path
      d="M10 8l2 2-2 2M7 10h5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default PortalIcon;
