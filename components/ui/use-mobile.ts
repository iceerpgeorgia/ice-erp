import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    
    // Initialize on first mount to prevent hydration mismatch
    const initialValue = window.innerWidth < MOBILE_BREAKPOINT;
    setIsMobile(initialValue);
    
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Prevent rendering mismatch during hydration by returning false initially
  // The useEffect will update it to the correct value after mount
  return isMobile === undefined ? false : isMobile;
}
