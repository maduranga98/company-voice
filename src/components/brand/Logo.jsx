/** The VoxWel logo, cropped to its mark so it sits cleanly in a rounded tile. */
export const BrandMark = ({ size = 32, className = "" }) => (
  <span
    className={`inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-[24%] bg-white ${className}`}
    style={{ width: size, height: size }}
  >
    <img
      src="/voxwel-logo.png"
      alt="VoxWel"
      className="h-full w-full scale-[1.9] object-cover"
      draggable="false"
    />
  </span>
);

const Logo = ({ size = 32, tone = "brand", className = "", showWordmark = true }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <BrandMark size={size} />
    {showWordmark && (
      <span
        className={`text-[1.1rem] font-semibold tracking-tight ${
          tone === "light" ? "text-white" : "text-ink"
        }`}
      >
        Vox<span className={tone === "light" ? "text-brand-400" : "text-brand-600"}>Wel</span>
      </span>
    )}
  </span>
);

export default Logo;
