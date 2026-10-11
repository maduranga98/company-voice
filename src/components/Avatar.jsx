const SIZES = {
  xs: "w-5 h-5 text-[9px]",
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-xs",
};

const initialsOf = (name) => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
};

// Initials chip used wherever a person is shown (assignee, note author, pickers).
const Avatar = ({ name, size = "sm", className = "" }) => (
  <span
    aria-hidden="true"
    className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#2D3E50]/10 font-semibold text-[#2D3E50] ${SIZES[size] || SIZES.sm} ${className}`}
  >
    {initialsOf(name)}
  </span>
);

export default Avatar;
