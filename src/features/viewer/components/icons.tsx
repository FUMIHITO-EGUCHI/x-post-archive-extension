import type { SVGProps } from "react";

const paths = {
  Refresh: "M20 7v5h-5 M4 17v-5h5 M5 9a8 8 0 0 1 13-3l2 2 M19 15a8 8 0 0 1-13 3l-2-2",
  Trash: "M4 7h16 M10 11v6 M14 11v6 M6 7l1 13h10l1-13 M9 7V4h6v3",
  ExternalLink: "M13 5h6v6 M19 5l-9 9 M19 13v6H5V5h6",
  Reply: "M9 10H4l5-5 M4 10c10-1 15 3 16 9-3-3-7-4-11-3",
  Repost: "M4 8h14l-3-3 M20 16H6l3 3 M18 8v3 M6 16v-3",
  Heart: "M20 5c-2-2-5-1-8 2-3-3-6-4-8-2-4 4 1 9 8 14 7-5 12-10 8-14Z",
  Thread: "M4 5h16v5H4z M4 14h16v5H4z M8 10v4",
  Archive: "M4 13v6h16v-6 M4 13h5l1 2h4l1-2h5 M12 3v8 M9 8l3 3 3-3",
  Check: "M5 12l5 5L20 6",
  Alert: "M12 3 2 20h20L12 3Z M12 9v4 M12 17h.01",
  Spinner: "M12 3a9 9 0 1 0 9 9",
  Filter: "M3 5h18l-7 8v5l-4 2v-7L3 5Z",
  Tag: "M3 12V4h8l9 9-7 7-10-8Z M7 8h.01",
  ArrowDown: "M12 4v16 M6 14l6 6 6-6",
  ArrowUp: "M12 20V4 M6 10l6-6 6 6",
  ArrowRight: "M4 12h16 M14 6l6 6-6 6"
} as const;

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: keyof typeof paths }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
