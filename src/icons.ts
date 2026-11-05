// Inline SVG icons (stroke-based, inherit currentColor).
const svg = (body: string, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  logo: `<svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="7" width="20" height="16" rx="3" fill="var(--logo-back)"/><rect x="9" y="10" width="20" height="16" rx="3" fill="var(--accent)"/><path d="M16.5 15.2v5.6l4.8-2.8z" fill="var(--on-accent)"/></svg>`,
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  help: svg('<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'),
  globe: svg('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>'),
  upload: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>', 40),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 18),
  minus: svg('<path d="M5 12h14"/>', 22),
  plusBig: svg('<path d="M12 5v14M5 12h14"/>', 22),
  sort: svg('<path d="M3 6h13M3 12h9M3 18h5"/><path d="M18 9V21M15 18l3 3 3-3"/>', 18),
  trash: svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', 18),
  x: svg('<path d="M18 6L6 18M6 6l12 12"/>', 16),
  left: svg('<path d="M15 18l-6-6 6-6"/>', 16),
  right: svg('<path d="M9 18l6-6-6-6"/>', 16),
  back: svg('<path d="M19 12H5M12 19l-7-7 7-7"/>', 18),
  next: svg('<path d="M5 12h14M12 5l7 7-7 7"/>', 18),
  play: svg('<path d="M7 4.5v15l12-7.5z"/>', 18),
  pause: svg('<path d="M8.5 5v14M15.5 5v14"/>', 18),
  check: svg('<path d="M20 6L9 17l-5-5"/>', 18),
  alert: svg('<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>', 18),
  save: svg('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>', 20),
  download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>', 20),
  undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  redo: svg('<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
  share: svg('<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>', 22),
  film: svg('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9.2v5.6l4.6-2.8z"/>', 22),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', 14),
};
