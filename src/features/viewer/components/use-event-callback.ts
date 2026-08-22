import { useCallback, useRef } from "react";

// Why: list-item handlers must keep a stable identity or React.memo on the cards is defeated —
// an inline closure re-created per render re-renders every card (#119). The ref indirection lets
// the latest closure run while the returned callback identity never changes. Not for use during
// render; call the result from event handlers only.
export function useEventCallback<Args extends unknown[], Result>(
  handler: (...args: Args) => Result
): (...args: Args) => Result {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  return useCallback((...args: Args) => handlerRef.current(...args), []);
}
