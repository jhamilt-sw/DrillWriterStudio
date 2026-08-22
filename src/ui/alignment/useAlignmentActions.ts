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

import { useMemo } from 'react';

import type { DrillPoint } from '../../core/types.ts';
import {
  type EdgeAlignment,
  type GroupAnchor,
  alignToEdge,
  distributeAlongAxis,
  moveGroupToLandmark,
  moveGroupToNearestLandmark,
  snapEachToLandmarks,
} from '../../core/align.ts';
import {
  type FieldLandmark,
  clampToField,
  verticalLandmarks,
  yardLineLandmarks,
} from '../../core/field.ts';
import { resolvePosition } from '../../core/show.ts';
import { useFieldMetrics, useShowStore } from '../../state/showStore.ts';

export interface AlignAction {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  run: () => void;
}

export interface AlignGroup {
  id: string;
  label: string;
  actions: AlignAction[];
}

export interface AlignmentMenu {
  groups: AlignGroup[];
  selectedCount: number;
  /** How many of the selection are actually on the field in this set. */
  placedCount: number;
}

/**
 * The alignment commands, as data.
 *
 * Returning a model rather than rendered markup means the right-click menu and
 * the always-visible panel are the same commands — there is no second copy to
 * drift, and every command stays reachable by keyboard for anyone who cannot
 * use a right-click (NFR-3).
 */
export function useAlignmentActions(): AlignmentMenu {
  const show = useShowStore((state) => state.show);
  const currentSetIndex = useShowStore((state) => state.currentSetIndex);
  const selectedIds = useShowStore((state) => state.selectedPerformerIds);
  const setPositions = useShowStore((state) => state.setPositions);
  const metrics = useFieldMetrics();

  return useMemo(() => {
    // Alignment only ever moves performers who are already on the field. There
    // is nothing sensible to align an unplaced performer to, and silently
    // materialising them here would make "align" a placement tool by accident.
    const placed = selectedIds
      .map((id) => ({ id, point: resolvePosition(show, id, currentSetIndex) }))
      .filter((entry): entry is { id: string; point: DrillPoint } => Boolean(entry.point));

    const enabled = placed.length > 0;
    const points = placed.map((entry) => entry.point);

    /** Run a transform over the selection and commit it as one undo step. */
    const apply = (
      label: string,
      transform: (input: DrillPoint[]) => DrillPoint[],
    ): void => {
      if (placed.length === 0) return;
      const result = transform(points);
      const positions: Record<string, DrillPoint> = {};
      placed.forEach((entry, index) => {
        const next = result[index];
        if (next) positions[entry.id] = clampToField(next, metrics);
      });
      setPositions(positions, { label });
    };

    const yardLines = yardLineLandmarks(metrics);
    const vertical = verticalLandmarks(metrics);
    const landmarkById = (id: string): FieldLandmark | undefined =>
      vertical.find((landmark) => landmark.id === id);

    const toLandmark = (
      id: string,
      label: string,
      landmarkId: string,
      anchor: GroupAnchor,
      hint?: string,
    ): AlignAction => ({
      id,
      label,
      hint,
      disabled: !enabled,
      run: () => {
        const landmark = landmarkById(landmarkId);
        if (!landmark) return;
        apply(label, (input) => moveGroupToLandmark(input, landmark, anchor));
      },
    });

    const edge = (id: EdgeAlignment, label: string, hint: string): AlignAction => ({
      id: `edge-${id}`,
      label,
      hint,
      disabled: !enabled,
      run: () => apply(label, (input) => alignToEdge(input, id)),
    });

    const groups: AlignGroup[] = [
      {
        id: 'yard-lines',
        label: 'Yard lines',
        actions: [
          {
            id: 'snap-each-yard',
            label: 'Snap each to nearest yard line',
            hint: 'Each performer moves to their own nearest line. Changes the form.',
            disabled: !enabled,
            run: () =>
              apply('Snap to yard lines', (input) =>
                snapEachToLandmarks(input, yardLines),
              ),
          },
          {
            id: 'group-nearest-yard',
            label: 'Move group to nearest yard line',
            hint: 'Slides the whole form sideways. Keeps the form exactly.',
            disabled: !enabled,
            run: () =>
              apply('Align group to yard line', (input) =>
                moveGroupToNearestLandmark(input, yardLines, 'centre'),
              ),
          },
          {
            id: 'group-fifty',
            label: 'Centre the group on the 50',
            disabled: !enabled,
            run: () => {
              const fifty = yardLines.find((landmark) => landmark.id === 'yard-50');
              if (!fifty) return;
              apply('Centre on the 50', (input) =>
                moveGroupToLandmark(input, fifty, 'centre'),
              );
            },
          },
        ],
      },
      {
        id: 'hashes',
        label: 'Hashes and sidelines',
        actions: [
          {
            id: 'snap-each-vertical',
            label: 'Snap each to nearest hash or sideline',
            hint: 'Each performer moves front-to-back to their own nearest line.',
            disabled: !enabled,
            run: () =>
              apply('Snap to hashes', (input) => snapEachToLandmarks(input, vertical)),
          },
          {
            id: 'group-nearest-vertical',
            label: 'Move group to nearest hash or sideline',
            hint: 'Slides the whole form front-to-back. Keeps the form exactly.',
            disabled: !enabled,
            run: () =>
              apply('Align group to hash', (input) =>
                moveGroupToNearestLandmark(input, vertical, 'centre'),
              ),
          },
          toLandmark(
            'front-hash',
            'Move group to Front Hash',
            'frontHash',
            'centre',
          ),
          toLandmark('back-hash', 'Move group to Back Hash', 'backHash', 'centre'),
          toLandmark(
            'front-sideline',
            'Move group to Front side line',
            'frontSideline',
            'leading',
            'Puts the front-most rank on the sideline.',
          ),
          toLandmark(
            'back-sideline',
            'Move group to Back side line',
            'backSideline',
            'trailing',
            'Puts the back-most rank on the sideline.',
          ),
        ],
      },
      {
        id: 'dress',
        label: 'Dress the selection',
        actions: [
          edge('front', 'Dress to the front', 'Everyone onto the front-most y.'),
          edge('back', 'Dress to the back', 'Everyone onto the back-most y.'),
          edge('side1', 'Dress to Side 1', 'Everyone onto the Side 1 edge.'),
          edge('side2', 'Dress to Side 2', 'Everyone onto the Side 2 edge.'),
          edge('centreY', 'Dress to the middle rank', 'Everyone onto the centre y.'),
          edge('centreX', 'Dress to the middle file', 'Everyone onto the centre x.'),
        ],
      },
      {
        id: 'distribute',
        label: 'Even out intervals',
        actions: [
          {
            id: 'distribute-x',
            label: 'Distribute side to side',
            hint: 'Equal side-to-side gaps, front-to-back left alone.',
            disabled: placed.length < 3,
            run: () =>
              apply('Distribute side to side', (input) =>
                distributeAlongAxis(input, 'x'),
              ),
          },
          {
            id: 'distribute-y',
            label: 'Distribute front to back',
            hint: 'Equal front-to-back gaps, side-to-side left alone.',
            disabled: placed.length < 3,
            run: () =>
              apply('Distribute front to back', (input) =>
                distributeAlongAxis(input, 'y'),
              ),
          },
        ],
      },
    ];

    return { groups, selectedCount: selectedIds.length, placedCount: placed.length };
  }, [show, currentSetIndex, selectedIds, metrics, setPositions]);
}
