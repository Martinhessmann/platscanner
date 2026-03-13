import { PrimePart } from '../../types';
import type { WhisperResult } from '../llmWhispererService';
import { ocrLogger } from '../ocrLogger';
import { isUINoiseText } from './stepScreenType';
import { getWhisperExtractedText } from './stepTextExtraction';
import { normalizePrimeItemName, parsePrimePartsFromText } from './stepPrimePartsParser';

type PrimeRowLine = {
  lineIndex: number;
  rawLine: string;
  sanitizedLine: string;
  normalizedLine: string;
  quantityOnly: boolean;
};

type PrimeRowGroup = {
  lines: PrimeRowLine[];
};

type ColumnLayout = {
  start: number;
  width: number;
  columnStarts: number[];
};

type PhraseFragment = {
  text: string;
  start: number;
  end: number;
  lineIndex: number;
};

type PrimeCardSlot = {
  sets: PhraseFragment[];
  fullItems: PhraseFragment[];
  components: PhraseFragment[];
  quantities: Array<{ quantity: number; start: number; lineIndex: number }>;
};

type PrimeItemCandidate = {
  item: PrimePart;
  key: string;
  xStart: number;
  lineIndex: number;
};

type BoundaryCleanupResult = {
  tokens: string[];
  strippedLeading: string[];
  strippedTrailing: string[];
};

const PRIME_COMPONENT_TYPES = [
  'Blueprint',
  'Chassis',
  'Neuroptics',
  'Systems',
  'Barrel',
  'Receiver',
  'Stock',
  'Blade',
  'Handle',
  'Link',
  'Grip',
  'String',
  'Lower Limb',
  'Upper Limb',
  'Gauntlet',
  'Boot',
  'Ornament',
  'Head',
  'Pouch',
  'Carapace',
  'Cerebrum',
  'Guard',
  'Hilt',
  'Blades',
  'Chain',
  'Disc',
  'Harness',
  'Wings',
  'Band',
  'Buckle'
] as const;

const PRIME_COMPONENT_PATTERN = PRIME_COMPONENT_TYPES
  .slice()
  .sort((a, b) => b.length - a.length)
  .map((value) => value.replace(/\s+/g, '\\s+'))
  .join('|');

const NORMALIZED_COMPONENT_SEQUENCES = PRIME_COMPONENT_TYPES
  .map((value) => normalizePrimeItemName(value).split(' '))
  .sort((a, b) => b.length - a.length);

const FULL_ITEM_REGEX = new RegExp(
  `([A-Za-z][A-Za-z&'\\-]*(?:\\s+[A-Za-z][A-Za-z&'\\-]*)?)\\s+Prime\\s+(${PRIME_COMPONENT_PATTERN})(?:\\s+Blueprint)?`,
  'gi'
);

const SET_REGEX = /([A-Za-z][A-Za-z&'\-]*(?:\s+[A-Za-z][A-Za-z&'\-]*)?)\s+Prime\b/gi;
const COMPONENT_REGEX = new RegExp(`\\b(${PRIME_COMPONENT_PATTERN})(?:\\s+Blueprint)?\\b`, 'gi');
const PRIME_UI_SEGMENTS = [
  /INVENTORY\s*\/\s*SELL/gi,
  /PRIME\s+PARTS/gi,
  /SELL\s+PRICE/gi,
  /SEARCH\s*\.\.\.?/gi,
  /TAP\s+ON\s+ITEMS\s+TO\s+SELECT\s*O?/gi,
  /TAP\s+AND\s+HOLD\s+ON\s+ITEMS/gi,
  /FOR\s+MORE\s+INFO/gi,
  /SELL\s+ITEMS/gi,
  /ONLY\s+SELLABLE/gi,
  /\bEXIT\b/gi,
  /\bTOTAL\b/gi,
  /\.\.\./g,
  /<<<+/g
];

const stripUiSegmentsPreserveSpacing = (value: string): string => {
  return PRIME_UI_SEGMENTS.reduce((current, pattern) => {
    return current.replace(pattern, (match) => ' '.repeat(match.length));
  }, value);
};

const sanitizePreserveSpacing = (value: string): string => {
  return stripUiSegmentsPreserveSpacing(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\f/g, ' ')
    .replace(/[^A-Za-z0-9&'\-\s]/g, ' ');
};

const normalizePreserveWords = (value: string): string => {
  return normalizePrimeItemName(sanitizePreserveSpacing(value));
};

const stripComponentBoundary = (tokens: string[], fromStart: boolean): { tokens: string[]; stripped: string[] } => {
  const working = [...tokens];
  const stripped: string[] = [];

  let changed = true;
  while (changed && working.length > 0) {
    changed = false;
    for (const sequence of NORMALIZED_COMPONENT_SEQUENCES) {
      if (sequence.length > working.length) continue;

      const slice = fromStart
        ? working.slice(0, sequence.length)
        : working.slice(working.length - sequence.length);
      const matches = slice.length === sequence.length && slice.every((token, index) => token === sequence[index]);
      if (!matches) continue;

      if (fromStart) {
        stripped.push(...working.splice(0, sequence.length));
      } else {
        stripped.unshift(...working.splice(working.length - sequence.length, sequence.length));
      }
      changed = true;
      break;
    }
  }

  return { tokens: working, stripped };
};

const cleanupSetBoundaryTokens = (tokens: string[]): BoundaryCleanupResult => {
  const withoutLeading = stripComponentBoundary(tokens, true);
  const withoutTrailing = stripComponentBoundary(withoutLeading.tokens, false);
  return {
    tokens: withoutTrailing.tokens,
    strippedLeading: withoutLeading.stripped,
    strippedTrailing: withoutTrailing.stripped
  };
};

const normalizeSetFragmentText = (rawText: string): string | null => {
  const normalized = normalizePreserveWords(rawText);
  const tokens = normalized.split(' ').filter(Boolean);
  const primeIndex = tokens.lastIndexOf('Prime');
  if (primeIndex <= 0) return normalized || null;

  const cleanup = cleanupSetBoundaryTokens(tokens.slice(0, primeIndex));
  if (cleanup.tokens.length === 0) return null;

  return `${cleanup.tokens.join(' ')} Prime`;
};

const normalizeFullItemFragmentText = (rawText: string, componentText: string): string | null => {
  const normalized = normalizePreserveWords(rawText);
  const tokens = normalized.split(' ').filter(Boolean);
  const primeIndex = tokens.lastIndexOf('Prime');
  if (primeIndex <= 0) return normalized || null;

  const cleanup = cleanupSetBoundaryTokens(tokens.slice(0, primeIndex));
  if (cleanup.tokens.length === 0) return null;

  const normalizedComponent = normalizePreserveWords(componentText);
  const preferredComponent = cleanup.strippedTrailing.length > 0
    ? cleanup.strippedTrailing.join(' ')
    : normalizedComponent;
  if (!preferredComponent) return null;

  return `${cleanup.tokens.join(' ')} Prime ${preferredComponent}`;
};

const isQuantityToken = (token: string): boolean => /^(?:0?)([2-9]|[1-9]\d)$/.test(token);

const isQuantityOnlyLine = (value: string): boolean => {
  const trimmed = sanitizePreserveSpacing(value).trim();
  if (!trimmed) return false;
  return trimmed
    .split(/\s+/)
    .every((part) => isQuantityToken(part));
};

const isRelevantPrimeLine = (normalizedLine: string, quantityOnly: boolean): boolean => {
  if (!normalizedLine) return false;
  if (quantityOnly) return true;
  if (isUINoiseText(normalizedLine)) return false;
  if (/\bprime\b/i.test(normalizedLine)) return true;
  return new RegExp(`\\b(${PRIME_COMPONENT_PATTERN})(?:\\s+blueprint)?\\b`, 'i').test(normalizedLine);
};

const splitPrimeRowGroups = (text: string): PrimeRowGroup[] => {
  const rawLines = text.split('\n');
  const relevantLines: PrimeRowLine[] = rawLines
    .map((rawLine, lineIndex) => {
      const sanitizedLine = sanitizePreserveSpacing(rawLine);
      const normalizedLine = normalizePrimeItemName(sanitizedLine);
      const quantityOnly = isQuantityOnlyLine(rawLine);
      return {
        lineIndex,
        rawLine: rawLine.replace(/\f/g, ' '),
        sanitizedLine,
        normalizedLine,
        quantityOnly
      };
    })
    .filter((line) => isRelevantPrimeLine(line.normalizedLine, line.quantityOnly));

  const groups: PrimeRowGroup[] = [];
  let current: PrimeRowLine[] = [];

  relevantLines.forEach((line) => {
    const previous = current[current.length - 1];
    const currentHasContent = current.some((entry) => !entry.quantityOnly);
    const shouldStartNewGroup = !previous
      ? false
      : (line.quantityOnly && currentHasContent) || (line.lineIndex - previous.lineIndex > 4);

    if (shouldStartNewGroup && current.length > 0) {
      groups.push({ lines: current });
      current = [];
    }

    current.push(line);
  });

  if (current.length > 0) {
    groups.push({ lines: current });
  }

  return groups.filter((group) => group.lines.some((line) => !line.quantityOnly && /\bprime\b|\bblueprint\b|\bchassis\b|\bneuroptics\b|\bsystems\b|\bbarrel\b|\breceiver\b|\bblade\b|\bhandle\b|\bchain\b|\bboot\b/i.test(line.normalizedLine)));
};

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

const dedupeStarts = (starts: number[]): number[] => {
  const sorted = [...starts].sort((a, b) => a - b);
  const deduped: number[] = [];
  sorted.forEach((start) => {
    const previous = deduped[deduped.length - 1];
    if (previous === undefined || Math.abs(previous - start) > 2) {
      deduped.push(start);
    }
  });
  return deduped;
};

const collectSetStarts = (groups: PrimeRowGroup[]): number[] => {
  const starts: number[] = [];
  groups.forEach((group) => {
    group.lines.forEach((line) => {
      let match: RegExpExecArray | null;
      SET_REGEX.lastIndex = 0;
      while ((match = SET_REGEX.exec(line.sanitizedLine)) !== null) {
        const normalizedText = normalizeSetFragmentText(match[0]);
        if (!normalizedText) continue;
        const start = match.index ?? 0;
        starts.push(start);
      }
    });
  });
  return dedupeStarts(starts);
};

const inferColumnLayout = (groups: PrimeRowGroup[]): ColumnLayout | null => {
  const starts = collectSetStarts(groups);
  if (starts.length < 5) return null;

  const diffs = starts
    .slice(1)
    .map((start, index) => start - starts[index])
    .filter((diff) => diff >= 10 && diff <= 22);

  const width = median(diffs);
  if (!width || width < 10) return null;

  let bestOffset = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let offset = 0; offset <= Math.round(width); offset++) {
    const score = starts.reduce((sum, start) => {
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let columnIndex = 0; columnIndex < 10; columnIndex++) {
        const distance = Math.abs(start - (offset + columnIndex * width));
        if (distance < bestDistance) {
          bestDistance = distance;
        }
      }
      return sum + bestDistance;
    }, 0);

    if (score < bestScore) {
      bestScore = score;
      bestOffset = offset;
    }
  }

  return {
    start: bestOffset,
    width,
    columnStarts: Array.from({ length: 8 }, (_, index) => bestOffset + index * width)
  };
};

const quantizeToColumn = (
  start: number,
  layout: ColumnLayout,
  rightBias: boolean = false
): number | null => {
  const probe = rightBias ? start + layout.width * 0.35 : start;
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  layout.columnStarts.forEach((columnStart, index) => {
    const distance = Math.abs(probe - columnStart);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  if (bestIndex < 0) return null;
  if (bestDistance > layout.width * 0.9) return null;
  return bestIndex;
};

const appendUniqueFragment = (target: PhraseFragment[], fragment: PhraseFragment): void => {
  if (target.some((entry) => entry.text === fragment.text && Math.abs(entry.start - fragment.start) <= 1 && entry.lineIndex === fragment.lineIndex)) {
    return;
  }
  target.push(fragment);
};

const extractFullItemFragments = (line: PrimeRowLine): PhraseFragment[] => {
  const fragments: PhraseFragment[] = [];
  let match: RegExpExecArray | null;
  FULL_ITEM_REGEX.lastIndex = 0;
  while ((match = FULL_ITEM_REGEX.exec(line.sanitizedLine)) !== null) {
    const normalizedText = normalizeFullItemFragmentText(match[0], match[2]);
    if (!normalizedText) continue;
    fragments.push({
      text: normalizedText,
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      lineIndex: line.lineIndex
    });
  }
  return fragments;
};

const extractSetFragments = (line: PrimeRowLine): PhraseFragment[] => {
  const fragments: PhraseFragment[] = [];
  let match: RegExpExecArray | null;
  SET_REGEX.lastIndex = 0;
  while ((match = SET_REGEX.exec(line.sanitizedLine)) !== null) {
    const normalizedText = normalizeSetFragmentText(match[0]);
    if (!normalizedText) continue;
    fragments.push({
      text: normalizedText,
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      lineIndex: line.lineIndex
    });
  }
  return fragments;
};

const extractComponentFragments = (line: PrimeRowLine, fullItems: PhraseFragment[]): PhraseFragment[] => {
  const fragments: PhraseFragment[] = [];
  let match: RegExpExecArray | null;
  COMPONENT_REGEX.lastIndex = 0;
  while ((match = COMPONENT_REGEX.exec(line.sanitizedLine)) !== null) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const overlapsFullItem = fullItems.some((item) => start >= item.start && end <= item.end);
    if (overlapsFullItem) continue;

    fragments.push({
      text: normalizePreserveWords(match[0]),
      start,
      end,
      lineIndex: line.lineIndex
    });
  }
  return fragments;
};

const extractQuantityStarts = (line: PrimeRowLine): Array<{ quantity: number; start: number }> => {
  if (!line.rawLine.trim()) return [];
  const matches: Array<{ quantity: number; start: number }> = [];
  const regex = /\b0?([2-9]|[1-9]\d)\b/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line.rawLine)) !== null) {
    matches.push({
      quantity: parseInt(match[1], 10),
      start: match.index ?? 0
    });
  }
  return matches;
};

const combineComponentParts = (components: string[]): string[] => {
  if (components.length === 0) return [];
  const normalized = components.map((value) => normalizePreserveWords(value)).filter(Boolean);
  const output: string[] = [];

  if (normalized.includes('blueprint')) {
    const blueprintable = normalized.find((value) => /^(chassis|neuroptics|systems)$/i.test(value));
    if (blueprintable) {
      output.push(`${blueprintable} blueprint`);
    }
  }

  normalized.forEach((value) => {
    if (value === 'blueprint') return;
    if (output.includes(value)) return;
    if (/^(chassis|neuroptics|systems)$/i.test(value) && normalized.includes('blueprint')) return;
    output.push(value);
  });

  return output;
};

const parsePrimeCardText = (cardText: string, quantity: number): PrimePart | null => {
  const parsed = parsePrimePartsFromText(cardText);
  if (parsed.length === 0) return null;
  const item = parsed[0];
  return {
    ...item,
    quantity: Math.max(1, quantity || item.quantity || 1)
  };
};

const extractComponentFromItemName = (itemName: string): string | null => {
  const match = normalizePrimeItemName(itemName).match(
    new RegExp(`^.+?\\s+prime\\s+(${PRIME_COMPONENT_PATTERN})(?:\\s+blueprint)?$`, 'i')
  );
  if (!match) return null;
  const component = normalizePrimeItemName(match[1]);
  if (/\\bblueprint$/i.test(normalizePrimeItemName(itemName)) && /^(chassis|neuroptics|systems)$/i.test(component)) {
    return `${component} blueprint`;
  }
  return component;
};

const pushCandidate = (
  candidates: PrimeItemCandidate[],
  seen: Set<string>,
  parsed: PrimePart | null,
  xStart: number,
  lineIndex: number
): void => {
  if (!parsed) return;
  const key = normalizePrimeItemName(parsed.name).toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  candidates.push({
    item: { ...parsed, quantity: 1 },
    key,
    xStart,
    lineIndex
  });
};

const findComponentAnchor = (slot: PrimeCardSlot, componentText: string): PhraseFragment | undefined => {
  return slot.components.find(
    (fragment) => normalizePreserveWords(fragment.text) === componentText || `${normalizePreserveWords(fragment.text)} blueprint` === componentText
  );
};

const combineSequenceComponentRefs = (
  refs: Array<{ text: string; start: number; lineIndex: number; consumed: boolean }>
): Array<{ text: string; start: number; lineIndex: number; consumed: boolean }> => {
  const merged: Array<{ text: string; start: number; lineIndex: number; consumed: boolean }> = [];

  refs.forEach((ref) => {
    if (/^blueprint$/i.test(ref.text)) {
      const previous = merged[merged.length - 1];
      if (previous && /^(chassis|neuroptics|systems)$/i.test(previous.text)) {
        previous.text = `${previous.text} Blueprint`;
        return;
      }
    }

    merged.push(ref);
  });

  return merged;
};

const assignQuantitiesToCandidates = (
  candidates: PrimeItemCandidate[],
  quantities: Array<{ quantity: number; start: number; lineIndex: number }>
): PrimePart[] => {
  if (candidates.length === 0) return [];

  const assigned = candidates.map((candidate) => ({ ...candidate.item, quantity: 1 }));
  const usedIndexes = new Set<number>();

  quantities
    .slice()
    .sort((a, b) => a.lineIndex === b.lineIndex ? a.start - b.start : a.lineIndex - b.lineIndex)
    .forEach((badge) => {
      let bestIndex = -1;
      let bestScore = Number.POSITIVE_INFINITY;

      candidates.forEach((candidate, index) => {
        if (usedIndexes.has(index)) return;

        const lineDelta = candidate.lineIndex - badge.lineIndex;
        if (lineDelta < 0) return;

        const horizontalDelta = candidate.xStart - badge.start;
        // Quantity badges belong to the card below/right, never to a card that starts left of the badge.
        if (horizontalDelta < 0) return;

        const score = lineDelta * 100 + horizontalDelta;
        if (score < bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });

      if (bestIndex === -1) {
        candidates.forEach((candidate, index) => {
          if (usedIndexes.has(index)) return;

          const lineDelta = Math.abs(candidate.lineIndex - badge.lineIndex);
          const horizontalDelta = Math.abs(candidate.xStart - badge.start);
          const score = lineDelta * 120 + horizontalDelta;
          if (score < bestScore) {
            bestScore = score;
            bestIndex = index;
          }
        });
      }

      if (bestIndex === -1) return;
      usedIndexes.add(bestIndex);
      assigned[bestIndex].quantity = Math.max(assigned[bestIndex].quantity || 1, badge.quantity);
    });

  return assigned;
};

const parseRowGroupWithLayout = (group: PrimeRowGroup, layout: ColumnLayout): PrimePart[] => {
  const slots: PrimeCardSlot[] = Array.from({ length: 8 }, () => ({
    sets: [],
    fullItems: [],
    components: [],
    quantities: []
  }));

  group.lines.forEach((line) => {
    const fullItems = extractFullItemFragments(line);
    fullItems.forEach((fragment) => {
      const columnIndex = quantizeToColumn(fragment.start, layout);
      if (columnIndex === null) return;
      appendUniqueFragment(slots[columnIndex].fullItems, fragment);
    });

    const sets = extractSetFragments(line);
    sets.forEach((fragment) => {
      const columnIndex = quantizeToColumn(fragment.start, layout);
      if (columnIndex === null) return;
      appendUniqueFragment(slots[columnIndex].sets, fragment);
    });

    const components = extractComponentFragments(line, fullItems);
    components.forEach((fragment) => {
      const columnIndex = quantizeToColumn(fragment.start, layout);
      if (columnIndex === null) return;
      appendUniqueFragment(slots[columnIndex].components, fragment);
    });

    extractQuantityStarts(line).forEach(({ quantity, start }) => {
      const columnIndex = quantizeToColumn(start, layout, true);
      if (columnIndex === null) return;
      slots[columnIndex].quantities.push({ quantity, start, lineIndex: line.lineIndex });
    });
  });

  const candidates: PrimeItemCandidate[] = [];
  const seen = new Set<string>();
  const sortedSetsBySlot = slots.map((slot) => slot.sets
    .slice()
    .sort((a, b) => a.lineIndex === b.lineIndex ? a.start - b.start : a.lineIndex - b.lineIndex)
    .map((fragment) => fragment.text));
  const componentRefsBySlot = slots.map((slot) => {
    const componentTexts = combineComponentParts(
      slot.components
        .slice()
        .sort((a, b) => a.lineIndex === b.lineIndex ? a.start - b.start : a.lineIndex - b.lineIndex)
        .map((fragment) => fragment.text)
    );

    return componentTexts.map((text) => {
      const anchor = findComponentAnchor(slot, text);
      return {
        text,
        start: anchor?.start ?? slot.sets[0]?.start ?? 0,
        lineIndex: anchor?.lineIndex ?? slot.sets[0]?.lineIndex ?? 0,
        consumed: false
      };
    });
  });

  slots.forEach((slot, slotIndex) => {
    const sortedSets = sortedSetsBySlot[slotIndex];
    const componentRefs = componentRefsBySlot[slotIndex];

    const consumedComponents = new Set<string>();

    slot.fullItems
      .slice()
      .sort((a, b) => a.lineIndex === b.lineIndex ? a.start - b.start : a.lineIndex - b.lineIndex)
      .forEach((fragment) => {
        const parsed = parsePrimeCardText(fragment.text, 1);
        const component = parsed ? extractComponentFromItemName(parsed.name) : null;
        if (component) {
          consumedComponents.add(component);
          const matchingComponent = componentRefs.find((entry) => entry.text === component);
          if (matchingComponent) {
            matchingComponent.consumed = true;
          }
        }
        pushCandidate(candidates, seen, parsed, fragment.start, fragment.lineIndex);
      });

    const primarySet = sortedSets.find(Boolean);
    if (!primarySet) {
      return;
    }

    if (sortedSets.length > 1) {
      const sequenceRefs = combineSequenceComponentRefs(
        componentRefs.filter((entry) => !entry.consumed && !consumedComponents.has(entry.text))
      );

      for (let borrowIndex = slotIndex + 1; sequenceRefs.length < sortedSets.length && borrowIndex < slots.length; borrowIndex += 1) {
        combineSequenceComponentRefs(componentRefsBySlot[borrowIndex]).forEach((entry) => {
          if (entry.consumed) return;
          sequenceRefs.push(entry);
        });
      }

      sortedSets.forEach((setText, setIndex) => {
        const componentRef = sequenceRefs[setIndex];
        if (!componentRef) return;
        componentRef.consumed = true;
        pushCandidate(
          candidates,
          seen,
          parsePrimeCardText(`${setText} ${componentRef.text}`, 1),
          slot.sets[0]?.start ?? componentRef.start,
          componentRef.lineIndex
        );
      });
      return;
    }

    const leftoverComponents = componentRefs.filter((entry) => !entry.consumed && !consumedComponents.has(entry.text));
    if (leftoverComponents.length === 0) {
      pushCandidate(candidates, seen, parsePrimeCardText(primarySet, 1), slot.sets[0].start, slot.sets[0].lineIndex);
      return;
    }

    leftoverComponents.forEach((componentRef) => {
      pushCandidate(
        candidates,
        seen,
        parsePrimeCardText(`${primarySet} ${componentRef.text}`, 1),
        slot.sets[0].start,
        componentRef.lineIndex || slot.sets[0].lineIndex
      );
    });
  });

  const quantities = slots.flatMap((slot) => slot.quantities);
  return assignQuantitiesToCandidates(candidates, quantities);
};

const applyQuantitiesByVisualOrder = (items: PrimePart[], group: PrimeRowGroup, layout: ColumnLayout | null): PrimePart[] => {
  if (items.length === 0 || !layout) return items;

  const adjusted = items.map((item) => ({ ...item, quantity: Math.max(1, item.quantity || 1) }));
  const quantityColumns = group.lines
    .flatMap((line) => extractQuantityStarts(line).map(({ quantity, start }) => ({
      quantity,
      columnIndex: quantizeToColumn(start, layout, true)
    })))
    .filter((entry): entry is { quantity: number; columnIndex: number } => entry.columnIndex !== null)
    .sort((a, b) => a.columnIndex - b.columnIndex);

  quantityColumns.forEach(({ quantity, columnIndex }) => {
    if (columnIndex < adjusted.length) {
      adjusted[columnIndex].quantity = Math.max(adjusted[columnIndex].quantity || 1, quantity);
    }
  });

  return adjusted;
};

const mergePrimeItems = (groups: PrimePart[][]): PrimePart[] => {
  const merged = new Map<string, PrimePart>();

  groups.flat().forEach((item) => {
    const key = normalizePrimeItemName(item.name).toLowerCase();
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...item, quantity: Math.max(1, item.quantity || 1) });
      return;
    }

    merged.set(key, {
      ...existing,
      quantity: Math.max(existing.quantity || 1, item.quantity || 1)
    });
  });

  return Array.from(merged.values()).map((item, index) => ({
    ...item,
    id: `prime-meta-${index}`
  }));
};

export const parsePrimePartsFromWhisperResult = (whisperResult: WhisperResult): PrimePart[] => {
  const extractedText = getWhisperExtractedText(whisperResult);
  if (!extractedText.trim()) {
    return [];
  }

  const rowGroups = splitPrimeRowGroups(extractedText);
  if (rowGroups.length === 0) {
    return parsePrimePartsFromText(extractedText);
  }

  const globalLayout = inferColumnLayout(rowGroups);
  const parsedGroups = rowGroups.map((group) => {
    const groupLayout = inferColumnLayout([group]) || globalLayout;

    if (groupLayout) {
      const layoutItems = parseRowGroupWithLayout(group, groupLayout);
      if (layoutItems.length >= 7) {
        return layoutItems;
      }
    }

    const fallbackItems = parsePrimePartsFromText(group.lines.map((line) => line.rawLine).join('\n'));
    return applyQuantitiesByVisualOrder(fallbackItems, group, groupLayout || globalLayout);
  });

  const merged = mergePrimeItems(parsedGroups);
  if (merged.length === 0) {
    return parsePrimePartsFromText(extractedText);
  }

  ocrLogger.info('Parsing', 'Metadata-aware prime row parsing completed', {
    rowGroups: rowGroups.length,
    usedLayout: !!globalLayout,
    parsedItems: merged.map((item) => `${item.name} x${item.quantity || 1}`)
  });

  return merged;
};
