export function LahzaLogo({ className = 'h-8 w-auto' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 100"
      className={className}
      role="img"
      aria-label="LAHTHA"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="28" cy="50" r="9" className="fill-gold-500" />
      <text
        x="58"
        y="62"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="42"
        fontWeight="700"
        className="fill-ink-900"
        letterSpacing="4"
      >
        LAHTHA
      </text>
    </svg>
  );
}
