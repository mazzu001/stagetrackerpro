// Hook-free mobile detection to avoid React module conflicts

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Return static value temporarily to avoid React hooks
  // This avoids the React module resolution issue
  if (typeof window !== 'undefined') {
    return window.innerWidth < MOBILE_BREAKPOINT;
  }
  return false;
}