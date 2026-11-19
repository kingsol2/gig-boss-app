import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "upload"
  | "chart"
  | "user"
  | "back"
  | "plus"
  | "chevron"
  | "eye"
  | "eyeOff"
  | "trash"
  | "edit"
  | "map"
  | "wallet"
  | "miles"
  | "clock"
  | "delivery"
  | "settings"
  | "help"
  | "shield"
  | "bell"
  | "lock"
  | "camera"
  | "check"
  | "x"
  | "search"
  | "calendar"
  | "mail"
  | "info";

const paths: Record<IconName, string> = {
  home: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5Z",
  upload: "M12 16V4m0 0L7 9m5-5 5 5M4 15v5h16v-5",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 9a7 7 0 0 0-14 0",
  back: "m15 18-6-6 6-6",
  plus: "M12 5v14M5 12h14",
  chevron: "m9 18 6-6-6-6",
  eye: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  eyeOff:
    "m3 3 18 18M10.6 10.6A2 2 0 0 0 13.4 13.4M9.9 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2 2.8M6.6 6.6C3.5 8.5 2 12 2 12s3.5 7 10 7a10 10 0 0 0 4-.8",
  trash: "M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6",
  edit: "m4 20 4.5-1L19 8.5 15.5 5 5 15.5 4 20ZM13.5 7l3.5 3.5",
  map: "m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15",
  wallet: "M3 7h16a2 2 0 0 1 2 2v10H5a2 2 0 0 1-2-2V7Zm0 0V5a2 2 0 0 1 2-2h13v4m-3 5h6",
  miles: "M5 19 19 5M7 5h12v12M5 9v10h10",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-15v5l3 2",
  delivery:
    "M3 6h11v12H3V6Zm11 4h4l3 4v4h-7v-8ZM7 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  settings:
    "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8-3.5 2-1-2-3-2 .5a8 8 0 0 0-2-1L15.5 5h-7L8 7.5a8 8 0 0 0-2 1L4 8l-2 3 2 1v2l-2 1 2 3 2-.5a8 8 0 0 0 2 1L8.5 21h7l.5-2.5a8 8 0 0 0 2-1l2 .5 2-3-2-1v-2Z",
  help: "M9.5 9a2.5 2.5 0 1 1 3.2 2.4c-.7.2-.7.8-.7 1.6m0 4h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z",
  shield: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Zm-3-10 2 2 4-5",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-8 12h4",
  lock: "M6 10h12v11H6V10Zm3 0V7a3 3 0 0 1 6 0v3",
  camera: "M3 8h4l2-3h6l2 3h4v12H3V8Zm9 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  check: "m5 12 4 4L19 6",
  x: "M6 6l12 12M18 6 6 18",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm6-2 5 5",
  calendar: "M5 3v3m14-3v3M3 9h18M4 5h16v16H4V5Z",
  mail: "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm-1 2 9 6 9-6",
  info: "M12 11v6m0-10h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z",
};

export function Icon({
  name,
  className = "h-5 w-5",
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
