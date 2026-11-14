const paths = {
  dashboard:'M3 5h18v14H3z M3 9h18 M9 9v10 M13 15l2-2 2 1 2-3',
  play:'M8 5l11 7-11 7z',
  plug:'M9 3v4m6-4v4 M7 7h10v4a5 5 0 0 1-10 0z M12 16v5',
  account:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2',
  arrowBack:'M19 12H5m7-7-7 7 7 7',
  disconnect:'M10 4H5v16h5 M9 12h11m-4-4 4 4-4 4',
  overview:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  ranking:'M4 20h16 M6 16v-4 M12 16V5 M18 16V9',
  contracts:'m12 3 9 5-9 5-9-5 9-5z M3 12l9 5 9-5 M3 16l9 5 9-5',
  ecosystem:'M8 8l8 8m0-8-8 8 M8 6a2 2 0 1 1-4 0 2 2 0 1 1 4 0 M20 6a2 2 0 1 1-4 0 2 2 0 1 1 4 0 M8 18a2 2 0 1 1-4 0 2 2 0 1 1 4 0 M20 18a2 2 0 1 1-4 0 2 2 0 1 1 4 0',
  research:'M5 4h11l3 3v13H5z M8 10h8 M8 14h8 M8 17h5',
  observed:'M3 12h4l3-6 4 12 3-6h4',
  simulation:'M9 3h6 M10 3v7l-5 8a1 1 0 0 0 1 2h12a1 1 0 0 0 1-2l-5-8V3 M8 15h8',
  connect:'M10 14l4-4 M8 16l-1 1a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0 M16 8l1-1a3 3 0 1 1 4 4l-4 4a3 3 0 0 1-4 0',
  terminal:'m5 7 5 5-5 5 M13 17h6',
  api:'m8 6-6 6 6 6 M16 6l6 6-6 6 M14 4l-4 16',
  copy:'M9 9h11v11H9z M16 9V4H4v12h5',
  down:'M12 4v15m-5-5 5 5 5-5',
  launch:'M7 17 17 7 M7 7h10v10',
  left:'m15 6-6 6 6 6',
  right:'m9 6 6 6-6 6',
  search:'M15 15l5 5 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  close:'M6 6l12 12M18 6 6 18',
  clock:'M12 7v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  unlock:'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0 M12 15v2',
  repeat:'m17 2 4 4-4 4 M3 11V9a3 3 0 0 1 3-3h15 M7 22l-4-4 4-4 M21 13v2a3 3 0 0 1-3 3H3',
  growth:'M3 18l6-6 4 4 7-8 M15 8h5v5',
  users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M22 21v-2a4 4 0 0 0-3-4 M17 3a4 4 0 0 1 0 8',
  globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M3 12h18 M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18',
  chevron:'m6 9 6 6 6-6',
  check:'m5 12 4 4L19 6',
} as const;
export type IconName = keyof typeof paths;

export default function Icon({name}: {name:IconName}) {
  return <svg className="iv-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
