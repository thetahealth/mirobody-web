/**
 * Mobile menu trigger (rendered only ≤768px by callers).
 * Standardizes the 44×44 touch target, glyph, and accessibility; callers pass
 * onClick and an optional layout `className` (margins/alignment vary per header).
 */
function HamburgerButton({ onClick, className = "", ariaLabel = "menu" }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={`inline-flex items-center justify-center w-[44px] h-[44px] shrink-0 text-[20px] leading-none bg-transparent border-none cursor-pointer ${className}`}
    >
      ☰
    </button>
  );
}

export default HamburgerButton;
