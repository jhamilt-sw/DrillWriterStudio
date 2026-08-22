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

import { useState } from 'react';

import type { DrillPoint } from '../../core/types.ts';
import {
  arcFormation,
  assignToTargets,
  blockFormation,
  centroid,
  circleFormation,
  clampAll,
  evenlySpaceAlongLine,
  lineFormation,
  mirrorHorizontal,
  mirrorVertical,
  rotateAbout,
  scaleAbout,
  seedSelection,
  snapPoint,
  sortAlongDominantAxis,
} from '../../core/formations.ts';
import { resolvePosition } from '../../core/show.ts';
import { SHAPE_LIBRARY, type ShapeKind, buildShape } from '../../core/shapes.ts';
import {
  DEFAULT_TEXT_OPTIONS,
  MAX_TEXT_HEIGHT,
  MIN_TEXT_HEIGHT,
  allocatePerformers,
  buildTextFormation,
  layoutText,
} from '../../core/textFormation.ts';
import { unsupportedCharacters } from '../../core/glyphs.ts';
import { useFieldMetrics, useShowStore } from '../../state/showStore.ts';

/**
 * Bulk formation tools (FR-1.6).
 *
 * Every tool works on the current selection and writes straight into the
 * current set, so the result lands in undo history as a single step. Forms are
 * generated around the selection's own centre rather than the field's, which is
 * what a designer expects when they build a shape where they are already
 * working.
 */
export function FormationTools() {
  const show = useShowStore((state) => state.show);
  const currentSetIndex = useShowStore((state) => state.currentSetIndex);
  const selectedIds = useShowStore((state) => state.selectedPerformerIds);
  const setPositions = useShowStore((state) => state.setPositions);
  const view = useShowStore((state) => state.view);
  const metrics = useFieldMetrics();

  const [interval, setIntervalSteps] = useState(2);
  const [spacing, setSpacing] = useState(2);
  const [columns, setColumns] = useState(8);
  const [radius, setRadius] = useState(12);
  const [arcSweep, setArcSweep] = useState(120);
  const [rotation, setRotation] = useState(15);
  const [shapeKind, setShapeKind] = useState<ShapeKind>('star');
  const [shapeWidth, setShapeWidth] = useState(32);
  const [shapeHeight, setShapeHeight] = useState(32);
  const [shapeRotation, setShapeRotation] = useState(0);
  const [starPoints, setStarPoints] = useState(5);
  const [text, setText] = useState('BAND');
  const [textHeight, setTextHeight] = useState(DEFAULT_TEXT_OPTIONS.heightSteps);
  const [textSpacing, setTextSpacing] = useState(DEFAULT_TEXT_OPTIONS.letterSpacingSteps);

  const shape = SHAPE_LIBRARY.find((entry) => entry.kind === shapeKind) ?? SHAPE_LIBRARY[0];

  const count = selectedIds.length;
  const disabled = count === 0;

  /** Where a performer who has never been placed starts from. */
  const stagingPoint = { x: metrics.fiftyX, y: metrics.frontHashY };

  const unplacedIds = selectedIds.filter(
    (id) => !resolvePosition(show, id, currentSetIndex),
  );

  /**
   * The selected performers, in a stable spatial order, with their positions.
   *
   * Performers who have not been placed yet are seeded across the 50 rather
   * than dropped: without a starting point they have no centroid and no
   * spatial order, so every tool below would quietly do nothing to a roster
   * that had just been typed in. Seeding them means "select eight trumpets,
   * press Block" works as the first thing a designer ever does.
   */
  function selection(): { id: string; point: DrillPoint }[] {
    const seeded = seedSelection(
      selectedIds.map((id) => ({
        id,
        point: resolvePosition(show, id, currentSetIndex),
      })),
      stagingPoint,
      interval,
    );
    return sortAlongDominantAxis(seeded, (entry) => entry.point);
  }

  /** Drop the selection onto the field in a block, without reshaping anything. */
  function placeOnField(): void {
    const rows = Math.ceil(count / columns);
    const origin = {
      x: stagingPoint.x - ((Math.min(columns, count) - 1) * interval) / 2,
      y: stagingPoint.y - ((rows - 1) * spacing) / 2,
    };
    apply(
      blockFormation(origin, count, columns, interval, spacing),
      'Place on field',
      { preserveOrder: true },
    );
  }

  /** Apply generated targets to the selection, snapping and staying in bounds. */
  function apply(
    targets: DrillPoint[],
    label: string,
    options: { preserveOrder?: boolean } = {},
  ): void {
    const current = selection();
    if (current.length === 0 || targets.length === 0) return;
    const clamped = clampAll(targets, metrics).map((point) =>
      snapPoint(point, view.snapSteps),
    );
    const positions: Record<string, DrillPoint> = options.preserveOrder
      ? Object.fromEntries(
          current.map((entry, index) => [entry.id, clamped[index] ?? entry.point]),
        )
      : assignToTargets(current, clamped);
    setPositions(positions, { label });
  }

  /**
   * What the current text would do, for showing before anyone commits to it.
   *
   * Recomputed on every keystroke, which is cheap: laying out forty characters
   * is arithmetic over a few hundred points, and it saves the designer from
   * having to press the button to discover the word is twice as wide as the
   * field.
   */
  const textPlan = (() => {
    const layout = layoutText(text, {
      center: { x: 0, y: 0 },
      heightSteps: textHeight,
      letterSpacingSteps: textSpacing,
    });
    const drawable = layout.glyphs.filter((glyph) => glyph.glyph.strokes.length > 0);
    return {
      widthSteps: layout.widthSteps,
      glyphCount: layout.glyphs.length,
      drawableCount: drawable.length,
      allocation: allocatePerformers(layout.glyphs, count),
      unsupported: unsupportedCharacters(text),
      shortfall: Math.max(0, drawable.length - count),
    };
  })();

  function transform(
    fn: (points: DrillPoint[], center: DrillPoint) => DrillPoint[],
    label: string,
  ): void {
    const current = selection();
    if (current.length === 0) return;
    const points = current.map((entry) => entry.point);
    const center = centroid(points);
    apply(fn(points, center), label, { preserveOrder: true });
  }

  return (
    <div className="section">
      <div className="section__header">
        <h2 className="section__title">Formation tools</h2>
        <span className="roster-section__count">{count} selected</span>
      </div>

      <div className="section__body">
        {disabled && (
          <p className="hint" style={{ marginTop: 0 }}>
            Select performers first — click a section name in the roster, click
            individual chips, or drag a box on the field. Every tool below
            reshapes the current selection inside the current set.
          </p>
        )}

        {unplacedIds.length > 0 && (
          <div className="alert alert--warning" role="status">
            <strong>
              {unplacedIds.length} of these {unplacedIds.length === 1 ? 'is' : 'are'} not
              on the field yet.
            </strong>{' '}
            Press any tool below to place them, or drop them in as a block:
            <div style={{ marginTop: 6 }}>
              <button type="button" className="btn btn--sm btn--primary" onClick={placeOnField}>
                Place {count} on the field
              </button>
            </div>
          </div>
        )}

        <div className="grid-3">
          <div className="field">
            <label className="field__label" htmlFor="tool-interval">
              Interval
            </label>
            <input
              id="tool-interval"
              className="input"
              type="number"
              step={0.25}
              min={0.25}
              value={interval}
              onChange={(event) =>
                setIntervalSteps(Math.max(0.25, Number(event.target.value) || 2))
              }
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="tool-spacing">
              Row gap
            </label>
            <input
              id="tool-spacing"
              className="input"
              type="number"
              step={0.25}
              min={0.25}
              value={spacing}
              onChange={(event) =>
                setSpacing(Math.max(0.25, Number(event.target.value) || 2))
              }
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="tool-columns">
              Columns
            </label>
            <input
              id="tool-columns"
              className="input"
              type="number"
              min={1}
              max={64}
              value={columns}
              onChange={(event) =>
                setColumns(Math.max(1, Number(event.target.value) || 8))
              }
            />
          </div>
        </div>

        <div className="row row--wrap" style={{ marginBottom: 10 }}>
          <button
            type="button"
            className="btn btn--sm"
            disabled={disabled}
            onClick={() => {
              const points = selection().map((entry) => entry.point);
              const center = centroid(points);
              const span = ((count - 1) * interval) / 2;
              apply(
                lineFormation(
                  { x: center.x - span, y: center.y },
                  { x: center.x + span, y: center.y },
                  count,
                ),
                'Form a line',
                { preserveOrder: true },
              );
            }}
          >
            Line
          </button>
          <button
            type="button"
            className="btn btn--sm"
            disabled={disabled}
            onClick={() => {
              const points = selection().map((entry) => entry.point);
              const center = centroid(points);
              const span = ((count - 1) * interval) / 2;
              apply(
                lineFormation(
                  { x: center.x, y: center.y - span },
                  { x: center.x, y: center.y + span },
                  count,
                ),
                'Form a file',
                { preserveOrder: true },
              );
            }}
          >
            File
          </button>
          <button
            type="button"
            className="btn btn--sm"
            disabled={disabled}
            onClick={() => {
              const points = selection().map((entry) => entry.point);
              const center = centroid(points);
              const rows = Math.ceil(count / columns);
              const origin = {
                x: center.x - ((columns - 1) * interval) / 2,
                y: center.y - ((rows - 1) * spacing) / 2,
              };
              apply(
                blockFormation(origin, count, columns, interval, spacing),
                'Form a block',
                { preserveOrder: true },
              );
            }}
          >
            Block
          </button>
          <button
            type="button"
            className="btn btn--sm"
            disabled={disabled}
            onClick={() => {
              const center = centroid(selection().map((entry) => entry.point));
              apply(
                arcFormation(
                  { x: center.x, y: center.y + radius },
                  radius,
                  -arcSweep / 2,
                  arcSweep / 2,
                  count,
                ),
                'Form an arc',
                { preserveOrder: true },
              );
            }}
          >
            Arc
          </button>
          <button
            type="button"
            className="btn btn--sm"
            disabled={disabled}
            onClick={() => {
              const center = centroid(selection().map((entry) => entry.point));
              apply(circleFormation(center, radius, count), 'Form a circle');
            }}
          >
            Circle
          </button>
          <button
            type="button"
            className="btn btn--sm"
            disabled={disabled || count < 3}
            onClick={() =>
              transform((points) => evenlySpaceAlongLine(points), 'Even out spacing')
            }
            title="Redistribute evenly between the two outermost performers"
          >
            Even out
          </button>
        </div>

        <div className="grid-2">
          <div className="field">
            <label className="field__label" htmlFor="tool-radius">
              Radius (steps)
            </label>
            <input
              id="tool-radius"
              className="input"
              type="number"
              min={1}
              value={radius}
              onChange={(event) => setRadius(Math.max(1, Number(event.target.value) || 12))}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="tool-sweep">
              Arc sweep (°)
            </label>
            <input
              id="tool-sweep"
              className="input"
              type="number"
              min={10}
              max={350}
              value={arcSweep}
              onChange={(event) =>
                setArcSweep(Math.max(10, Math.min(350, Number(event.target.value) || 120)))
              }
            />
          </div>
        </div>

        <h3 className="section__title" style={{ margin: '10px 0 4px' }}>
          Shapes
        </h3>
        <p className="hint" style={{ marginTop: 0, marginBottom: 6 }}>
          Outline forms. Performers land on every corner first, then fill the
          edges — a star with empty points does not read as a star.
        </p>

        <div className="row row--wrap" style={{ marginBottom: 8 }}>
          {SHAPE_LIBRARY.map((entry) => (
            <button
              key={entry.kind}
              type="button"
              className={`chip${shapeKind === entry.kind ? ' chip--selected' : ''}`}
              title={entry.hint}
              aria-pressed={shapeKind === entry.kind}
              onClick={() => setShapeKind(entry.kind)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="grid-3">
          <div className="field">
            <label className="field__label" htmlFor="shape-width">
              Width
            </label>
            <input
              id="shape-width"
              className="input"
              type="number"
              min={2}
              step={1}
              value={shapeWidth}
              onChange={(event) =>
                setShapeWidth(Math.max(2, Number(event.target.value) || 2))
              }
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="shape-height">
              Depth
            </label>
            <input
              id="shape-height"
              className="input"
              type="number"
              min={2}
              step={1}
              value={shapeHeight}
              onChange={(event) =>
                setShapeHeight(Math.max(2, Number(event.target.value) || 2))
              }
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="shape-rotation">
              Turn (°)
            </label>
            <input
              id="shape-rotation"
              className="input"
              type="number"
              step={15}
              value={shapeRotation}
              onChange={(event) => setShapeRotation(Number(event.target.value) || 0)}
            />
          </div>
        </div>

        {shapeKind === 'star' && (
          <div className="field" style={{ maxWidth: 160 }}>
            <label className="field__label" htmlFor="star-points">
              Star points
            </label>
            <input
              id="star-points"
              className="input"
              type="number"
              min={3}
              max={12}
              value={starPoints}
              onChange={(event) =>
                setStarPoints(Math.max(3, Math.min(12, Number(event.target.value) || 5)))
              }
            />
          </div>
        )}

        <div className="row row--wrap" style={{ marginBottom: 4 }}>
          <button
            type="button"
            className="btn btn--sm btn--primary"
            disabled={disabled}
            onClick={() => {
              const centre = centroid(selection().map((entry) => entry.point));
              apply(
                buildShape(shapeKind, count, {
                  center: centre,
                  widthSteps: shapeWidth,
                  heightSteps: shapeHeight,
                  rotationDegrees: shapeRotation,
                  starPoints,
                }),
                `Form a ${shape.label.toLowerCase()}`,
              );
            }}
          >
            Form {shape.label.toLowerCase()}
          </button>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            disabled={disabled}
            title="Match the shape box to the field's proportions"
            onClick={() => {
              setShapeWidth(Math.round(metrics.widthSteps / 4));
              setShapeHeight(Math.round(metrics.depthSteps / 2));
            }}
          >
            Fit to field
          </button>
        </div>

        {count > 0 && count < shape.minimumCount && (
          <p className="hint" style={{ color: 'var(--warning)' }}>
            A {shape.label.toLowerCase()} has {shape.minimumCount} corners — with{' '}
            {count} selected it will be spaced evenly around the outline instead
            of landing on them.
          </p>
        )}

        <h3 className="section__title" style={{ margin: '10px 0 4px' }}>
          Text
        </h3>
        <div className="field">
          <label className="field__label" htmlFor="text-input">
            Spell out
          </label>
          <input
            id="text-input"
            className="input"
            value={text}
            placeholder="GO BAND!"
            maxLength={40}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <div className="grid-2">
          <div className="field">
            <label className="field__label" htmlFor="text-height">
              Letter height (steps)
            </label>
            <input
              id="text-height"
              className="input"
              type="number"
              min={MIN_TEXT_HEIGHT}
              max={MAX_TEXT_HEIGHT}
              value={textHeight}
              onChange={(event) =>
                setTextHeight(
                  Math.max(
                    MIN_TEXT_HEIGHT,
                    Math.min(MAX_TEXT_HEIGHT, Number(event.target.value) || MIN_TEXT_HEIGHT),
                  ),
                )
              }
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="text-spacing">
              Letter gap (steps)
            </label>
            <input
              id="text-spacing"
              className="input"
              type="number"
              min={0}
              step={0.5}
              value={textSpacing}
              onChange={(event) => setTextSpacing(Math.max(0, Number(event.target.value) || 0))}
            />
          </div>
        </div>

        <div className="row row--wrap" style={{ marginBottom: 4 }}>
          <button
            type="button"
            className="btn btn--sm btn--primary"
            disabled={disabled || textPlan.drawableCount === 0}
            onClick={() => {
              const centre = centroid(selection().map((entry) => entry.point));
              apply(
                buildTextFormation(text, count, {
                  center: centre,
                  heightSteps: textHeight,
                  letterSpacingSteps: textSpacing,
                }),
                `Spell “${text.trim()}”`,
              );
            }}
          >
            Spell it out
          </button>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            disabled={textPlan.drawableCount === 0}
            title="Shrink the letters until the word fits between the goal lines"
            onClick={() => {
              // Solve for the height directly rather than stepping down to it:
              // width is proportional to height once the gaps are taken out.
              const usable = metrics.widthSteps * 0.9;
              const gaps = Math.max(0, textPlan.glyphCount - 1) * textSpacing;
              const perHeight = (textPlan.widthSteps - gaps) / textHeight;
              if (perHeight <= 0) return;
              setTextHeight(
                Math.max(
                  MIN_TEXT_HEIGHT,
                  Math.min(MAX_TEXT_HEIGHT, Math.floor((usable - gaps) / perHeight)),
                ),
              );
            }}
          >
            Fit to field
          </button>
          <span className="roster-section__count">
            {Math.round(textPlan.widthSteps)} × {textHeight} steps
          </span>
        </div>

        {textPlan.unsupported.length > 0 && (
          <p className="hint" style={{ color: 'var(--warning)' }}>
            No letter form for {textPlan.unsupported.map((c) => `“${c}”`).join(', ')} —
            those characters will be skipped.
          </p>
        )}

        {count > 0 && textPlan.shortfall > 0 && (
          <p className="hint" style={{ color: 'var(--warning)' }}>
            {textPlan.drawableCount} letters and only {count} selected —{' '}
            {textPlan.shortfall} would be left empty. Select more performers or
            shorten the text.
          </p>
        )}

        {count > 0 && textPlan.shortfall === 0 && textPlan.allocation.length > 0 && (
          <p className="hint" style={{ marginTop: 0 }}>
            {textPlan.allocation
              .filter((entry) => entry.count > 0)
              .map((entry) => `${entry.character} ${entry.count}`)
              .join(' · ')}
          </p>
        )}

        {textPlan.widthSteps > metrics.widthSteps && (
          <p className="hint" style={{ color: 'var(--warning)' }}>
            That is wider than the field. Reduce the height or use “Fit to field”.
          </p>
        )}

        <h3 className="section__title" style={{ margin: '10px 0 4px' }}>
          Transform
        </h3>
        <div className="row row--wrap" style={{ marginBottom: 8 }}>
          <button
            type="button"
            className="btn btn--sm"
            disabled={disabled}
            onClick={() =>
              apply(
                mirrorVertical(
                  selection().map((entry) => entry.point),
                  metrics.fiftyX,
                ),
                'Mirror across the 50',
              )
            }
            title="Reflect the selection across the 50 yard line"
          >
            Mirror ↔ 50
          </button>
          <button
            type="button"
            className="btn btn--sm"
            disabled={disabled}
            onClick={() =>
              transform(
                (points, center) => mirrorVertical(points, center.x),
                'Mirror in place',
              )
            }
            title="Reflect across the selection's own centre"
          >
            Flip ↔
          </button>
          <button
            type="button"
            className="btn btn--sm"
            disabled={disabled}
            onClick={() =>
              transform(
                (points, center) => mirrorHorizontal(points, center.y),
                'Flip front to back',
              )
            }
          >
            Flip ↕
          </button>
          <button
            type="button"
            className="btn btn--sm"
            disabled={disabled}
            onClick={() =>
              transform(
                (points, center) => rotateAbout(points, center, -rotation),
                'Rotate',
              )
            }
          >
            ↺ {rotation}°
          </button>
          <button
            type="button"
            className="btn btn--sm"
            disabled={disabled}
            onClick={() =>
              transform(
                (points, center) => rotateAbout(points, center, rotation),
                'Rotate',
              )
            }
          >
            ↻ {rotation}°
          </button>
        </div>

        <div className="row row--wrap">
          <button
            type="button"
            className="btn btn--sm"
            disabled={disabled}
            onClick={() =>
              transform((points, center) => scaleAbout(points, center, 1.25), 'Spread')
            }
            title="Spread the selection apart"
          >
            Spread
          </button>
          <button
            type="button"
            className="btn btn--sm"
            disabled={disabled}
            onClick={() =>
              transform((points, center) => scaleAbout(points, center, 0.8), 'Condense')
            }
          >
            Condense
          </button>
          <div className="field field--row" style={{ margin: 0, flex: 1 }}>
            <label className="field__label" htmlFor="tool-rotation">
              Angle
            </label>
            <input
              id="tool-rotation"
              className="input input--number input--inline"
              type="number"
              min={1}
              max={180}
              value={rotation}
              onChange={(event) =>
                setRotation(Math.max(1, Math.min(180, Number(event.target.value) || 15)))
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
