import { useEffect, useRef } from "react";

/**
 * Custom hook for handling click outside events
 * @param {Function} callback - Function to call when clicking outside
 * @param {boolean} isActive - Whether the hook should be active
 * @param {Object|Array} refs - Optional ref or array of refs to monitor. If not provided, returns a new ref.
 * @returns {Object|null} ref - Ref to attach to the target element (null if refs parameter is provided)
 */
function useClickOutside(callback, isActive = true, refs = null) {
  const internalRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Determine which refs to check
      let refsToCheck = [];

      if (refs) {
        // If refs parameter is provided, use it
        refsToCheck = Array.isArray(refs) ? refs : [refs];
      } else {
        // Otherwise, use internal ref
        refsToCheck = [internalRef];
      }

      // Check if click is outside all refs
      const isOutside = refsToCheck.every(
        (ref) => ref.current && !ref.current.contains(event.target),
      );

      if (isOutside) {
        callback();
      }
    };

    if (isActive) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [callback, isActive, refs]);

  // Return internal ref only if no external refs were provided
  return refs ? null : internalRef;
}

export default useClickOutside;
