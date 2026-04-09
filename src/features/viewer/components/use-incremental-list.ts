import { useEffect, useMemo, useState } from "react";

type UseIncrementalListOptions = {
  initialCount?: number;
  step?: number;
  requiredCount?: number;
};

const DEFAULT_INCREMENTAL_LIST_SIZE = 40;

export function useIncrementalList<T>(
  items: readonly T[],
  options: UseIncrementalListOptions = {}
) {
  const initialCount = normalizeListCount(options.initialCount, DEFAULT_INCREMENTAL_LIST_SIZE);
  const step = normalizeListCount(options.step, initialCount);
  const requiredCount = normalizeRequiredCount(options.requiredCount);
  const [visibleCount, setVisibleCount] = useState(() => Math.max(initialCount, requiredCount));

  useEffect(() => {
    setVisibleCount(Math.max(initialCount, requiredCount));
  }, [initialCount, items, requiredCount]);

  const resolvedVisibleCount = Math.min(items.length, Math.max(visibleCount, requiredCount));
  const visibleItems = useMemo(
    () => items.slice(0, resolvedVisibleCount),
    [items, resolvedVisibleCount]
  );
  const remainingCount = Math.max(items.length - resolvedVisibleCount, 0);

  function loadMore(): void {
    setVisibleCount((current) =>
      Math.min(items.length, Math.max(current, requiredCount) + step)
    );
  }

  return {
    visibleItems,
    visibleCount: resolvedVisibleCount,
    totalCount: items.length,
    remainingCount,
    hasMore: remainingCount > 0,
    loadMore
  };
}

function normalizeListCount(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function normalizeRequiredCount(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}
