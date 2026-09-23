import type { CSSProperties } from "react";

const paths = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 17.5h7m-3.5-3.5v7" />
    </>
  ),
  capsule: (
    <>
      <path d="m9 4-5 5a6 6 0 0 0 8.5 8.5l5-5A6 6 0 0 0 9 4Z" />
      <path d="m6.5 6.5 8.5 8.5m-6-5-2 2" />
    </>
  ),
  scan: (
    <>
      <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M1 12h22" />
      <path d="M8 7h8M8 17h8" />
    </>
  ),
  conversation: (
    <>
      <path d="M21 11a8 8 0 0 1-8 8H8l-5 3V11a9 9 0 0 1 18 0Z" />
      <path d="M7 10h10M7 14h6" />
    </>
  ),
  arrow: (
    <>
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </>
  ),
  arrowUp: (
    <>
      <path d="M12 20V4m-6 6 6-6 6 6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10v.1" />
    </>
  ),
  book: (
    <>
      <path d="M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6" />
    </>
  ),
  pause: (
    <>
      <path d="M8 5v14M16 5v14" />
    </>
  ),
  play: <path d="m8 5 11 7-11 7Z" />,
  branch: (
    <>
      <circle cx="5" cy="5" r="2" />
      <circle cx="19" cy="5" r="2" />
      <circle cx="12" cy="20" r="2" />
      <path d="M5 7v3c0 4 7 2 7 8m7-11v3c0 4-7 2-7 8" />
    </>
  ),
  spinner: <path d="M21 12a9 9 0 1 1-9-9" />,
};
export type IconName = keyof typeof paths;
export default function Icon({
  name,
  size = 20,
  className = "",
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {paths[name]}
    </svg>
  );
}
export function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M12 3h8v9h9v8h-9v9h-8v-9H3v-8h9V3Z" fill="currentColor" />
      <path d="m11 16 3 3 7-7" stroke="var(--paper)" strokeWidth="1.6" />
    </svg>
  );
}
