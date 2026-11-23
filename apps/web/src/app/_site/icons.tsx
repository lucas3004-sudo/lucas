/** Icônes du site public (trait 24 × 24, même style que le menu du logiciel). */
const PATHS = {
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
  building: "M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3",
  contacts: "M5 4h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5zM5 4v17M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M8.5 17a3.5 3.5 0 0 1 7 0M21 8v2M21 13v2",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M12 12h.01",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5",
  visit: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  key: "M14.5 9.5a4 4 0 1 0-3.9 3.1L3 20v1h3v-2h2v-2h2l2.3-2.3A4 4 0 0 0 14.5 9.5M16 7.5h.01",
  deal: "M3 7h18v12H3zM8 7V5h8v2M3 12h18",
  listing: "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7",
  upload: "M12 15V4M7.5 8.5 12 4l4.5 4.5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4",
  download: "M12 4v11M7.5 10.5 12 15l4.5-4.5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5",
  bot: "M12 3v3M7 8h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3zM9 13h.01M15 13h.01M9.5 17h5",
  chart: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  grid: "M4 4h16v16H4zM4 9.5h16M4 15h16M9.5 4v16",
  book: "M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10",
  calculator: "M6 3h12v18H6zM9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01",
  note: "M5 4h14v11l-5 5H5zM14 20v-5h5",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  check: "M5 12.5l4.5 4.5L19 7.5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  plus: "M12 5v14M5 12h14",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2",
} as const;

export type SiteIconName = keyof typeof PATHS;

export function SiteIcon({ name, className = "size-5", strokeWidth = 1.7 }: { name: SiteIconName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
