// The R's open counter holds a signal: a call going out to a resident. Drawn from the logo art.
export const LOGO_TEAL = "#14b39c";
const R_TOP =
  "M258 262H760C910 262 1025 380 1025 560C1025 690 950 790 845 822L1025 1028Q1040 1055 1005 1055H805Q765 1055 740 1025L650 905Q645 893 660 888C770 850 840 760 840 640C840 500 730 395 590 395C500 395 430 455 330 455H258Q240 455 240 437V280Q240 262 258 262Z";
const R_FOOT = "M258 775C400 775 480 830 540 900L650 1035Q660 1055 635 1055H258Q240 1055 240 1037V793Q240 775 258 775Z";

export function BrandMark({ size = 30, ink = "var(--ink)" }: { size?: number; ink?: string }) {
  return (
    <svg width={size} height={size} viewBox="220 242 832 832" aria-hidden="true">
      <path d={R_TOP} fill={ink} />
      <path d={R_FOOT} fill={ink} />
      <circle cx="385" cy="632" r="85" fill={LOGO_TEAL} />
      <path d="M535 545Q635 635 535 725M660 468Q820 640 660 810" fill="none" stroke={LOGO_TEAL} strokeWidth="98" strokeLinecap="round" />
    </svg>
  );
}

export function Brand() {
  return (
    <a href="/" className="brand">
      <BrandMark />
      REACH
    </a>
  );
}
