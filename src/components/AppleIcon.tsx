
import React from 'react';

const AppleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" {...props}>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="12">
      <path d="M162,136s22-40,0-64c-22-24-50-16-50-16s-28-8-50,16c-22,24,0,64,0,64"/>
      <path d="M48,120c-16,32,0,88,44,88s64-24,84-32,44-56,28-88-60-48-100-32C64,72,64,88,48,120Z"/>
      <path d="M148,40c8.09,8,12,20,12,32"/>
    </g>
  </svg>
);

export default AppleIcon;
