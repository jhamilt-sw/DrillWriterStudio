/*
 * DrillWriter Studio
 * Author: Jasper Hamilton
 * AI assistance: Portions of this code and its documentation were generated
 *   or refined using AI tools under human direction.
 * Attribution: Credit to the original author in derivative works is
 *   appreciated as a courtesy. It is not required by the license; see NOTICE.
 * Created: 2026-08-21  ·  Last modified: 2026-08-22
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export interface Size {
  width: number;
  height: number;
}

/**
 * Track an element's content box. Konva needs explicit pixel dimensions for its
 * stage, so the canvas host measures itself and passes the result down.
 */
export function useElementSize<T extends HTMLElement>(): [
  (node: T | null) => void,
  Size,
] {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);
  const nodeRef = useRef<T | null>(null);

  const measure = useCallback((node: T) => {
    const rect = node.getBoundingClientRect();
    setSize((previous) =>
      Math.abs(previous.width - rect.width) < 0.5 &&
      Math.abs(previous.height - rect.height) < 0.5
        ? previous
        : { width: rect.width, height: rect.height },
    );
  }, []);

  const ref = useCallback(
    (node: T | null) => {
      observerRef.current?.disconnect();
      nodeRef.current = node;
      if (!node) return;
      measure(node);
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => measure(node));
      observer.observe(node);
      observerRef.current = observer;
    },
    [measure],
  );

  useLayoutEffect(() => () => observerRef.current?.disconnect(), []);

  return [ref, size];
}
