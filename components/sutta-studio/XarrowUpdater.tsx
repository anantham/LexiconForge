import React, { useLayoutEffect } from 'react';
import { useXarrow } from 'react-xarrows';

export function XarrowUpdater({ deps }: { deps: React.DependencyList }) {
  const updateXarrow = useXarrow();
  useLayoutEffect(() => {
    updateXarrow();
    const t = window.setTimeout(() => updateXarrow(), 30);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return null;
}
