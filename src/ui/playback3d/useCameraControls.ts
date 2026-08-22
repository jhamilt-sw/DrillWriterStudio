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

/**
 * Mouse, wheel and keyboard for the 3D camera.
 *
 * All the maths lives in `core/camera3d.ts`; this is the part that turns
 * gestures into calls. The orbit is held in a ref rather than React state
 * because it changes on every mousemove and every animation frame — putting it
 * in state would re-render the whole overlay sixty times a second to move a
 * camera that React does not draw.
 */

import { useCallback, useEffect, useRef } from 'react';

import {
  CONTROL_RATES,
  type OrbitState,
  dollyBy,
  flyBy,
  orbitBy,
  panBy,
} from '../../core/camera3d.ts';

export interface CameraControls {
  orbitRef: React.MutableRefObject<OrbitState>;
  /** Advance the free-fly keys. Call once per frame from the render loop. */
  stepFly: (deltaSeconds: number) => void;
  handlers: {
    onPointerDown: (event: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLCanvasElement>) => void;
    onWheel: (event: React.WheelEvent<HTMLCanvasElement>) => void;
    onContextMenu: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  };
}

type DragMode = 'orbit' | 'pan' | null;

export function useCameraControls(initial: OrbitState): CameraControls {
  const orbitRef = useRef<OrbitState>(initial);
  const dragRef = useRef<{ mode: DragMode; x: number; y: number }>({
    mode: null,
    x: 0,
    y: 0,
  });
  const keysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      // Let the browser have its own shortcuts.
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      keysRef.current.add(event.key.toLowerCase());
    };
    const up = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    // Held keys stick if the window loses focus mid-press, and the camera then
    // drifts across the field on its own until you click back and tap the key.
    const clear = () => keysRef.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, []);

  const stepFly = useCallback((deltaSeconds: number) => {
    const keys = keysRef.current;
    if (keys.size === 0) return;
    const forward = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0);
    const right = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    const up = (keys.has('e') ? 1 : 0) - (keys.has('q') ? 1 : 0);
    if (forward === 0 && right === 0 && up === 0) return;
    orbitRef.current = flyBy(
      orbitRef.current,
      { forward, right, up },
      deltaSeconds,
      keys.has('shift'),
    );
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    // Left drags swing the camera; right or middle slides it, the convention
    // every 3D tool shares.
    const mode: DragMode = event.button === 0 ? 'orbit' : 'pan';
    dragRef.current = { mode, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag.mode) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (drag.mode === 'orbit') {
      orbitRef.current = orbitBy(
        orbitRef.current,
        -dx * CONTROL_RATES.orbitDegreesPerPixel,
        dy * CONTROL_RATES.orbitDegreesPerPixel,
      );
    } else {
      // Panning scales with distance: at 500 feet out, a pixel should cover
      // more ground than it does standing on the sideline.
      const scale = (orbitRef.current.distance / 200) * CONTROL_RATES.panFeetPerPixel;
      orbitRef.current = panBy(orbitRef.current, -dx * scale, dy * scale);
    }
  }, []);

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current.mode = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    const factor =
      event.deltaY > 0
        ? CONTROL_RATES.dollyPerWheelNotch
        : 1 / CONTROL_RATES.dollyPerWheelNotch;
    orbitRef.current = dollyBy(orbitRef.current, factor);
  }, []);

  const onContextMenu = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    // Right-drag is a pan; a context menu mid-drag would abandon it.
    event.preventDefault();
  }, []);

  return {
    orbitRef,
    stepFly,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onWheel, onContextMenu },
  };
}
