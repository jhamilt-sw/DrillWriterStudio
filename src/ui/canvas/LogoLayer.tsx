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

import { useEffect, useMemo, useState } from 'react';
import type Konva from 'konva';
import { Circle, Group, Image as KonvaImage, Rect } from 'react-konva';

import type { FieldLogo } from '../../core/types.ts';
import { isLogoInteractive } from '../../core/logos.ts';
import { type Viewport, toPixels } from '../../core/transform.ts';

/**
 * Load a data URL into an HTMLImageElement for Konva.
 *
 * Konva draws images, not URLs, so each logo needs a decoded element. They are
 * cached by data URL: re-decoding a school crest on every render would stall
 * the canvas while dragging.
 */
const imageCache = new Map<string, HTMLImageElement>();

function useLogoImages(logos: FieldLogo[]): Map<string, HTMLImageElement> {
  const [, setVersion] = useState(0);

  const urls = useMemo(() => logos.map((logo) => logo.dataUrl), [logos]);

  useEffect(() => {
    let cancelled = false;
    for (const url of urls) {
      if (imageCache.has(url)) continue;
      const image = new window.Image();
      image.onload = () => {
        if (cancelled) return;
        imageCache.set(url, image);
        // Nudge a re-render now the bitmap is decodable.
        setVersion((value) => value + 1);
      };
      // A corrupt payload simply never appears; it must not break the canvas.
      image.onerror = () => undefined;
      image.src = url;
    }
    return () => {
      cancelled = true;
    };
  }, [urls]);

  return imageCache;
}

interface LogoLayerProps {
  logos: FieldLogo[];
  viewport: Viewport;
  selectedLogoId: string | null;
  /** Editing is off during playback, so logos are inert while watching. */
  interactive: boolean;
  onSelect: (logoId: string | null) => void;
  onPointerDownBody: (
    logoId: string,
    event: Konva.KonvaEventObject<PointerEvent>,
  ) => void;
  onPointerDownHandle: (
    logoId: string,
    corner: LogoCorner,
    event: Konva.KonvaEventObject<PointerEvent>,
  ) => void;
}

export type LogoCorner = 'sw' | 'se' | 'nw' | 'ne';

/**
 * Logos painted onto the turf.
 *
 * Rendered above the grass but below the yard lines and hashes, because that is
 * how a real field looks: the crest is painted on the sod and the white lines
 * are laid over the top of it. Drawn at less than full opacity for the same
 * reason — a logo that hides the turf reads as a sticker.
 */
export function LogoLayer({
  logos,
  viewport,
  selectedLogoId,
  interactive,
  onSelect,
  onPointerDownBody,
  onPointerDownHandle,
}: LogoLayerProps) {
  const images = useLogoImages(logos);

  return (
    <Group listening={interactive}>
      {logos
        .filter((logo) => logo.visible)
        .map((logo) => {
          const image = images.get(logo.dataUrl);
          if (!image) return null;

          // A locked logo is painted exactly the same but takes no pointer
          // events, so a press on the turf over it reaches the field beneath.
          const grabbable = isLogoInteractive(logo, interactive);
          const centre = toPixels(logo.center, viewport);
          const width = logo.widthSteps * viewport.scale;
          const height = logo.heightSteps * viewport.scale;
          const isSelected = grabbable && logo.id === selectedLogoId;

          return (
            <Group key={logo.id}>
              <KonvaImage
                image={image}
                x={centre.x}
                y={centre.y}
                width={width}
                height={height}
                offsetX={width / 2}
                offsetY={height / 2}
                rotation={logo.rotationDegrees}
                opacity={logo.opacity}
                listening={grabbable}
                perfectDrawEnabled={false}
                onPointerDown={(event) => {
                  if (!grabbable) return;
                  event.cancelBubble = true;
                  onSelect(logo.id);
                  onPointerDownBody(logo.id, event);
                }}
              />

              {isSelected && (
                <Group
                  x={centre.x}
                  y={centre.y}
                  rotation={logo.rotationDegrees}
                  listening
                >
                  <Rect
                    x={-width / 2}
                    y={-height / 2}
                    width={width}
                    height={height}
                    stroke="#1f6feb"
                    strokeWidth={1.5}
                    dash={[6, 4]}
                    listening={false}
                    perfectDrawEnabled={false}
                  />
                  {(
                    [
                      ['nw', -width / 2, -height / 2],
                      ['ne', width / 2, -height / 2],
                      ['sw', -width / 2, height / 2],
                      ['se', width / 2, height / 2],
                    ] as [LogoCorner, number, number][]
                  ).map(([corner, x, y]) => (
                    <Circle
                      key={corner}
                      x={x}
                      y={y}
                      radius={5}
                      fill="#ffffff"
                      stroke="#1f6feb"
                      strokeWidth={1.5}
                      perfectDrawEnabled={false}
                      onPointerDown={(event) => {
                        event.cancelBubble = true;
                        onPointerDownHandle(logo.id, corner, event);
                      }}
                    />
                  ))}
                </Group>
              )}
            </Group>
          );
        })}
    </Group>
  );
}
