// Shared SVG path data (24x24 viewBox, stroke icons) for the viewer (React)
// and the X content script (plain DOM). Keep this module free of React so the
// content script bundle can import it.
export const ICON_PATHS = {
  Refresh: "M19 3v5h-5 M19 8A8 8 0 1 0 20 12",
  Trash: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6",
  ExternalLink: "M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  Reply: "M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.4A8.5 8.5 0 1 1 21 11.5Z",
  Repost: "M4.5 10V8a3 3 0 0 1 3-3H19 M16 2l3 3-3 3 M19.5 14v2a3 3 0 0 1-3 3H5 M8 22l-3-3 3-3",
  Heart: "M12 20.5S3 15 3 8.8A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 9 2.5C21 15 12 20.5 12 20.5Z",
  Thread: "M5 3v18 M9 6h11 M9 12h11 M9 18h7",
  Archive: "M12 3v11 M7 10l5 5 5-5 M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
  Check: "M5 12.5l4.5 4.5L19 7",
  Alert: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Z M12 7.5v5.5 M12 16.5h.01",
  Spinner: "M12 3a9 9 0 1 1-9 9",
  Filter: "M3 4h18l-7 8.5V18l-4 2v-7.5Z",
  Tag: "M3 3h8l10 10-8 8L3 11Z M7.5 7.5h.01",
  ArrowDown: "M12 4v16 M6 14l6 6 6-6",
  ArrowUp: "M12 20V4 M6 10l6-6 6 6",
  ArrowRight: "M4 12h16 M14 6l6 6-6 6",
  Plus: "M12 5v14 M5 12h14",
  Close: "M6 6l12 12 M18 6L6 18",
  Search: "M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M15.5 15.5L20 20",
  Pause: "M9 5v14 M15 5v14"
} as const;

export type IconName = keyof typeof ICON_PATHS;
