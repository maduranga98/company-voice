/** VoxWel mark: a speech bubble carrying a voice waveform. */
export const BrandMark = ({ size = 32, className = "", tone = "brand" }) => {
  const onDark = tone === "light";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="VoxWel"
      className={className}
    >
      <rect
        width="32"
        height="32"
        rx="9"
        fill={onDark ? "#fff" : "url(#vx-grad)"}
      />
      <path
        d="M9 9.5h14a2.5 2.5 0 0 1 2.5 2.5v6.5a2.5 2.5 0 0 1-2.5 2.5h-6l-4.2 3.2a.6.6 0 0 1-.96-.48V21H9a2.5 2.5 0 0 1-2.5-2.5V12A2.5 2.5 0 0 1 9 9.5Z"
        fill={onDark ? "#5B5BD6" : "#fff"}
        fillOpacity={onDark ? 1 : 0.18}
      />
      <g stroke={onDark ? "#fff" : "#fff"} strokeWidth="1.9" strokeLinecap="round">
        <path d="M11 15.2v1.6M14 13.5v5M17 12v8M20 14.4v3.2" />
      </g>
      {!onDark && (
        <defs>
          <linearGradient id="vx-grad" x1="0" y1="0" x2="32" y2="32">
            <stop stopColor="#7A7FE6" />
            <stop offset="1" stopColor="#4A49C2" />
          </linearGradient>
        </defs>
      )}
    </svg>
  );
};

const Logo = ({ size = 32, tone = "brand", className = "", showWordmark = true }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <BrandMark size={size} tone={tone} />
    {showWordmark && (
      <span
        className={`text-[1.1rem] font-semibold tracking-tight ${
          tone === "light" ? "text-white" : "text-ink"
        }`}
      >
        Vox<span className={tone === "light" ? "text-white/70" : "text-brand-600"}>Wel</span>
      </span>
    )}
  </span>
);

export default Logo;
