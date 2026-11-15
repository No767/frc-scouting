import { useSyncExternalStore } from "react";

const MOBILE_QUERY = "(max-width: 1279px)";

function subscribe(onChange: () => void) {
  const mql = globalThis.matchMedia(MOBILE_QUERY);
  mql.addEventListener("change", onChange);
  return () => {
    mql.removeEventListener("change", onChange);
  };
}

function getSnapshot() {
  return globalThis.matchMedia(MOBILE_QUERY).matches;
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
