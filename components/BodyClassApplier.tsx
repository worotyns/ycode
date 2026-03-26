'use client';

import { useLayoutEffect } from 'react';

export default function BodyClassApplier({ classes }: { classes: string }) {
  useLayoutEffect(() => {
    const classList = (classes || 'bg-white').split(/\s+/).filter(Boolean);
    document.body.classList.add(...classList);
    return () => { document.body.classList.remove(...classList); };
  }, [classes]);

  return null;
}
