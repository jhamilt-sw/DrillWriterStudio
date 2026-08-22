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

import { memo, useMemo } from 'react';
import { Group, Line, Rect, Text } from 'react-konva';

import type { FieldAppearance } from '../../core/types.ts';
import type { FieldMetrics } from '../../core/field.ts';
import {
  HASH_MARK_LENGTH_FEET,
  HASH_MARK_WIDTH_FEET,
  feetToSteps,
  hashMarkXs,
  yardLines,
  yardTicks,
} from '../../core/field.ts';
import { darken, lighten } from '../../core/color.ts';
import { type Viewport, toPixels } from '../../core/transform.ts';

interface FieldGraphicsProps {
  metrics: FieldMetrics;
  viewport: Viewport;
  appearance: FieldAppearance;
  showStepGrid: boolean;
}

/**
 * The field itself: turf, mown bands, sidelines, goal lines, five-yard lines,
 * hashes and printed numbers.
 *
 * Drawn as the press box sees it — front sideline along the bottom — which the
 * viewport's `yDirection` handles. Nothing here computes screen y itself; every
 * position goes through `toPixels`, and the geometry is then taken as min/max
 * so the code reads the same whichever way the field is oriented.
 *
 * Nothing is interactive, so the whole layer opts out of hit detection: with
 * 250 performers on top, every listener the canvas can skip is worth skipping
 * (NFR-1).
 */
export const FieldGraphics = memo(function FieldGraphics({
  metrics,
  viewport,
  appearance,
  showStepGrid,
}: FieldGraphicsProps) {
  const geometry = useMemo(() => {
    const front = toPixels({ x: 0, y: 0 }, viewport);
    const back = toPixels({ x: metrics.widthSteps, y: metrics.depthSteps }, viewport);

    const left = Math.min(front.x, back.x);
    const right = Math.max(front.x, back.x);
    const top = Math.min(front.y, back.y);
    const bottom = Math.max(front.y, back.y);

    const endZoneWidth = metrics.endZoneSteps * viewport.scale;

    const lines = yardLines(metrics).map((line) => ({
      ...line,
      pixelX: viewport.offsetX + line.x * viewport.scale,
      isGoalLine: line.yardsFromSide1 === 0 || line.yardsFromSide1 === 100,
    }));

    // Mown bands run between five-yard lines, alternating as a roller would
    // leave them.
    const stripes: { x: number; width: number; index: number }[] = [];
    for (let i = 0; i < lines.length - 1; i += 1) {
      stripes.push({
        x: Math.min(lines[i].pixelX, lines[i + 1].pixelX),
        width: Math.abs(lines[i + 1].pixelX - lines[i].pixelX),
        index: i,
      });
    }

    const hashRows = [metrics.frontHashY, metrics.backHashY].map((hashY) => ({
      y: toPixels({ x: 0, y: hashY }, viewport).y,
    }));
    // Where the continuous hash line starts and stops: goal line to goal line,
    // not sideline to sideline — the hash does not run through the end zones.
    const hashLineFrom = toPixels({ x: 0, y: 0 }, viewport).x;
    const hashLineTo = toPixels({ x: metrics.widthSteps, y: 0 }, viewport).x;

    /*
     * The hash marks: 24-inch dashes lying *along* the field, one bisecting
     * each five-yard line. Their length runs goal-to-goal, not across — a mark
     * drawn across the field is a stubby yard line, not a hash.
     */
    const spf = metrics.config.stepsPerFiveYards;
    const hashMarkLength =
      feetToSteps(HASH_MARK_LENGTH_FEET, spf) * viewport.scale;
    const hashMarkWidth = feetToSteps(HASH_MARK_WIDTH_FEET, spf) * viewport.scale;
    const hashTicks = hashMarkXs(metrics).map(
      (x) => toPixels({ x, y: 0 }, viewport).x,
    );

    // Yard markers: short ticks across the field, in from the sidelines and
    // out from the hashes. Precomputed in pixels so the render pass is a map.
    const yardTickLines = yardTicks(metrics).map((tick) => {
      const x = toPixels({ x: tick.x, y: 0 }, viewport).x;
      return [
        x,
        toPixels({ x: tick.x, y: tick.fromY }, viewport).y,
        x,
        toPixels({ x: tick.x, y: tick.toY }, viewport).y,
      ];
    });

    const stepGrid: number[] = [];
    if (showStepGrid && viewport.scale > 5) {
      for (let step = 1; step < metrics.widthSteps; step += 1) {
        if (step % metrics.stepsPerFiveYardLine === 0) continue;
        stepGrid.push(viewport.offsetX + step * viewport.scale);
      }
    }

    return {
      left,
      right,
      top,
      bottom,
      width: right - left,
      height: bottom - top,
      endZoneWidth,
      lines,
      stripes,
      hashRows,
      hashTicks,
      hashMarkLength,
      hashMarkWidth,
      yardTickLines,
      hashLineFrom,
      hashLineTo,
      stepGrid,
      numberSize: Math.max(6, Math.min(22, viewport.scale * 2.6)),
    };
  }, [metrics, viewport, showStepGrid]);

  // Line weights are deliberately heavy: a field read at a glance needs its
  // yard lines to carry across a room, not to be hairlines.
  const weight = appearance.lineWeight;
  const stripeColor = lighten(appearance.turfColor, 0.055);
  const gridColor = darken(appearance.turfColor, 0.12);

  return (
    <Group listening={false}>
      {metrics.config.showEndZones && (
        <>
          <Rect
            x={geometry.left - geometry.endZoneWidth}
            y={geometry.top}
            width={geometry.endZoneWidth}
            height={geometry.height}
            fill={appearance.endZoneColor}
            perfectDrawEnabled={false}
          />
          <Rect
            x={geometry.right}
            y={geometry.top}
            width={geometry.endZoneWidth}
            height={geometry.height}
            fill={appearance.endZoneColor}
            perfectDrawEnabled={false}
          />
        </>
      )}

      <Rect
        x={geometry.left}
        y={geometry.top}
        width={geometry.width}
        height={geometry.height}
        fill={appearance.turfColor}
        perfectDrawEnabled={false}
      />

      {appearance.showMowingStripes &&
        geometry.stripes
          .filter((stripe) => stripe.index % 2 === 1)
          .map((stripe) => (
            <Rect
              key={`stripe-${stripe.index}`}
              x={stripe.x}
              y={geometry.top}
              width={stripe.width}
              height={geometry.height}
              fill={stripeColor}
              perfectDrawEnabled={false}
            />
          ))}

      {geometry.stepGrid.map((x) => (
        <Line
          key={`grid-${x}`}
          points={[x, geometry.top, x, geometry.bottom]}
          stroke={gridColor}
          strokeWidth={0.6 * weight}
          opacity={0.5}
          perfectDrawEnabled={false}
        />
      ))}

      {/*
        The hash itself, drawn before the ticks so the ticks sit on top of it.
        Lighter than a yard line: it is a reference a designer aligns to, not
        paint that exists on the ground, and at full weight two of them across
        the field compete with the drill.
      */}
      {appearance.showHashLines &&
        geometry.hashRows.map((row, index) => (
          <Line
            key={`hash-line-${index}`}
            points={[geometry.hashLineFrom, row.y, geometry.hashLineTo, row.y]}
            stroke={appearance.lineColor}
            strokeWidth={1.2 * weight}
            opacity={0.75}
            perfectDrawEnabled={false}
          />
        ))}

      {/*
        Yard markers. Always drawn: they are how a designer reads the yardage
        between the five-yard lines, and they are what the hash-line switch is
        NOT about.
      */}
      {geometry.yardTickLines.map((points, index) => (
        <Line
          key={`yard-tick-${index}`}
          points={points}
          stroke={appearance.lineColor}
          strokeWidth={1.4 * weight}
          perfectDrawEnabled={false}
        />
      ))}

      {/*
        The hash marks proper — but only when the continuous hash line is off.
        Both at once is one drawn on top of the other in the same place, which
        reads as a lumpy line rather than as either thing.
      */}
      {!appearance.showHashLines &&
        geometry.hashRows.map((row, index) =>
          geometry.hashTicks.map((x) => (
            <Line
              key={`hash-${index}-${x}`}
              points={[
                x - geometry.hashMarkLength / 2,
                row.y,
                x + geometry.hashMarkLength / 2,
                row.y,
              ]}
              stroke={appearance.lineColor}
              // A real hash mark is 4 inches of paint; at a zoomed-out field
              // that is under a pixel, so it is floored at something visible.
              strokeWidth={Math.max(1.6, geometry.hashMarkWidth) * weight}
              lineCap="butt"
              perfectDrawEnabled={false}
            />
          )),
        )}

      {geometry.lines.map((line) => (
        <Line
          key={`yard-${line.yardsFromSide1}`}
          points={[line.pixelX, geometry.top, line.pixelX, geometry.bottom]}
          stroke={appearance.lineColor}
          strokeWidth={(line.isGoalLine ? 3 : line.isNumbered ? 2.4 : 1.8) * weight}
          perfectDrawEnabled={false}
        />
      ))}

      {/* Sidelines, drawn last so they sit crisply over the yard lines. */}
      <Rect
        x={geometry.left}
        y={geometry.top}
        width={geometry.width}
        height={geometry.height}
        stroke={appearance.lineColor}
        strokeWidth={3.2 * weight}
        perfectDrawEnabled={false}
      />

      {geometry.numberSize >= 8 &&
        geometry.lines
          .filter((line) => line.isNumbered)
          .map((line) => (
            <Group key={`num-${line.yardsFromSide1}`}>
              {/* Numbers face the near sideline, as painted on a real field. */}
              <Text
                x={line.pixelX - geometry.numberSize}
                y={geometry.bottom - geometry.numberSize * 2.1}
                width={geometry.numberSize * 2}
                align="center"
                text={String(line.number)}
                fontSize={geometry.numberSize}
                fontStyle="bold"
                fill={appearance.numberColor}
                listening={false}
                perfectDrawEnabled={false}
              />
              <Text
                x={line.pixelX - geometry.numberSize}
                y={geometry.top + geometry.numberSize * 0.9}
                width={geometry.numberSize * 2}
                align="center"
                text={String(line.number)}
                fontSize={geometry.numberSize}
                fontStyle="bold"
                fill={appearance.numberColor}
                listening={false}
                perfectDrawEnabled={false}
              />
            </Group>
          ))}
    </Group>
  );
});
