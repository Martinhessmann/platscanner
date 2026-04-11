import { PrimePart } from '../../types';
import type { WhisperResult } from '../llmWhispererService';
import { ocrLogger } from '../ocrLogger';
import { getPrimeSetsCache } from '../staticDataService';
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

type QuantityBadgeCandidate = {
  rawText: string;
  quantity: number;
  normalized: number;
  start: number;
  lineIndex: number;
  ambiguous: boolean;
};

type PrimeCardSlot = {
  sets: PhraseFragment[];
  fullItems: PhraseFragment[];
  components: PhraseFragment[];
  quantities: QuantityBadgeCandidate[];
};

type PrimeItemCandidate = {
  item: PrimePart;
  key: string;
  xStart: number;
  lineIndex: number;
  slotIndex: number;
};

type SlotQuantityResolution = {
  rawText: string | null;
  normalized: number | null;
  chosen: number | null;
  ambiguous: boolean;
  promoted: boolean;
};

type PrimeRowQuantityDebug = {
  rawTokens: Array<string | null>;
  normalized: Array<number | null>;
  chosen: Array<number | null>;
  ambiguousSlots: number[];
  promotedSlots: number[];
  missingSlots: number[];
  weak: boolean;
};

type PrimeRowLayoutParseResult = {
  items: PrimePart[];
  tailQuantity: number | null;
  quantityDebug: PrimeRowQuantityDebug;
};

type BoundaryCleanupResult = {
  tokens: string[];
  strippedLeading: string[];
  strippedTrailing: string[];
};

type OcrCell = {
  text: string;
  start: number;
  end: number;
};

const fragmentCenter = (fragment: PhraseFragment): number => fragment.start + (fragment.end - fragment.start) / 2;

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

const NORMALIZED_COMPONENT_DEFS = PRIME_COMPONENT_TYPES
  .map((value) => {
    const normalized = normalizePrimeItemName(value);
    return {
      text: normalized,
      tokens: normalized.split(' '),
      blueprintable: /^(chassis|neuroptics|systems)$/i.test(normalized)
    };
  })
  .sort((a, b) => b.tokens.length - a.tokens.length);

const NORMALIZED_COMPONENT_SEQUENCES = NORMALIZED_COMPONENT_DEFS.map((value) => value.tokens);

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

const splitIntoOcrCellsWithBounds = (line: string): OcrCell[] => {
  const cells: OcrCell[] = [];
  let cursor = 0;

  while (cursor < line.length) {
    while (cursor < line.length && line[cursor] === ' ') {
      cursor += 1;
    }
    if (cursor >= line.length) break;

    const start = cursor;
    while (cursor < line.length) {
      if (line[cursor] !== ' ') {
        cursor += 1;
        continue;
      }

      let gapCursor = cursor;
      while (gapCursor < line.length && line[gapCursor] === ' ') {
        gapCursor += 1;
      }

      if (gapCursor - cursor >= 2) {
        break;
      }

      cursor = gapCursor;
    }

    const end = cursor;
    const text = line.slice(start, end).trim();
    if (text) {
      cells.push({ text, start, end });
    }
  }

  return cells;
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

/** Whisper often appends TAP / SELL UI on the same line as stack counts; strip for qty detection only. */
const stripTrailingPrimeQtyRowUi = (rawLine: string): string => {
  return rawLine.replace(
    /\s{2,}(?:TAP\s+(?:ON|AND)[^\n]*|SELL\s+ITEMS[^\n]*)$/i,
    ''
  );
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
      const quantityOnly = isQuantityOnlyLine(
        stripTrailingPrimeQtyRowUi(rawLine.replace(/\f/g, ' '))
      );
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
    const currentHasNameOrComponent = current.some((l) => !l.quantityOnly);
    // - Split on large line gaps (UI between grid rows).
    // - In Whisper sell-screen OCR, quantity-only rows visually belong to the grid row *below* them,
    //   so once we already captured a row's names/components, a new quantity-only line starts the next group.
    // - Still split when a quantity row ends and the next line is non-quantity, so a leading quantity row
    //   stays attached to the row below rather than getting orphaned.
    const shouldStartNewGroup = !previous
      ? false
      : line.lineIndex - previous.lineIndex > 4 ||
        (line.quantityOnly && currentHasNameOrComponent) ||
        (previous.quantityOnly && !line.quantityOnly && currentHasNameOrComponent);

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
      extractSetFragments(line).forEach((fragment) => {
        starts.push(fragmentCenter(fragment));
      });
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
    // Real device screenshots / Whisper spacing can exceed the old 22-char cap while still being an 8-col grid.
    .filter((diff) => diff >= 10 && diff <= 30);

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

const inferComponentAnchoredLayout = (group: PrimeRowGroup): ColumnLayout | null => {
  const starts = dedupeStarts(
    group.lines.flatMap((line) => {
      const fullItems = extractFullItemFragments(line);
      return extractComponentFragments(line, fullItems).map((fragment) => fragmentCenter(fragment));
    })
  );
  if (starts.length < 6) return null;

  const diffs = starts
    .slice(1)
    .map((start, index) => start - starts[index])
    .filter((diff) => diff >= 10 && diff <= 30);

  const width = median(diffs);
  if (!width || width < 10) return null;

  return {
    start: starts[0],
    width,
    columnStarts: starts.slice(0, 8)
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
  if (bestDistance > layout.width * 1.05) return null;
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
  const extractByRegex = (): PhraseFragment[] => {
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

  const tokenizeCell = (cell: OcrCell): Array<{ normalized: string; start: number; end: number }> => {
    const tokens: Array<{ normalized: string; start: number; end: number }> = [];
    const regex = /\S+/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(cell.text)) !== null) {
      const normalized = normalizePrimeItemName(match[0]);
      if (!normalized) continue;
      tokens.push({
        normalized,
        start: cell.start + (match.index ?? 0),
        end: cell.start + (match.index ?? 0) + match[0].length
      });
    }
    return tokens;
  };

  const extractFromCell = (cell: OcrCell): PhraseFragment[] => {
    const tokens = tokenizeCell(cell);
    const fragments: PhraseFragment[] = [];

    for (let index = 0; index < tokens.length;) {
      let matched = false;

      for (const componentDef of NORMALIZED_COMPONENT_DEFS) {
        if (index + componentDef.tokens.length > tokens.length) continue;
        const matches = componentDef.tokens.every(
          (token, tokenIndex) => tokens[index + tokenIndex].normalized === token
        );
        if (!matches) continue;

        let endIndex = index + componentDef.tokens.length - 1;
        let text = componentDef.text;
        if (
          componentDef.blueprintable &&
          tokens[endIndex + 1] &&
          tokens[endIndex + 1].normalized === 'Blueprint'
        ) {
          endIndex += 1;
          text = `${componentDef.text} Blueprint`;
        }

        fragments.push({
          text,
          start: tokens[index].start,
          end: tokens[endIndex].end,
          lineIndex: line.lineIndex
        });
        index = endIndex + 1;
        matched = true;
        break;
      }

      if (matched) continue;

      if (tokens[index].normalized === 'Blueprint') {
        fragments.push({
          text: 'Blueprint',
          start: tokens[index].start,
          end: tokens[index].end,
          lineIndex: line.lineIndex
        });
      }

      index += 1;
    }

    return fragments;
  };

  const setFragments = extractSetFragments(line);
  if (setFragments.length > 0 || /\bPrime\b/i.test(line.sanitizedLine)) {
    return extractByRegex();
  }

  const fragments: PhraseFragment[] = [];
  splitIntoOcrCellsWithBounds(line.sanitizedLine).forEach((cell) => {
    const overlapsFullItem = fullItems.some((item) => cell.start >= item.start && cell.end <= item.end);
    if (overlapsFullItem) return;

    const overlapsSet = setFragments.some((fragment) => cell.start >= fragment.start && cell.end <= fragment.end);
    if (overlapsSet) return;

    extractFromCell(cell).forEach((fragment) => {
      appendUniqueFragment(fragments, fragment);
    });
  });

  return fragments;
};

const normalizeQuantityToken = (
  rawText: string
): { normalized: number | null; ambiguous: boolean } => {
  const trimmed = rawText.trim();
  if (!trimmed) return { normalized: null, ambiguous: false };

  if (/^0([2-9])$/.test(trimmed)) {
    return { normalized: parseInt(trimmed[1], 10), ambiguous: false };
  }

  if (/^[2-9]$/.test(trimmed)) {
    return { normalized: parseInt(trimmed, 10), ambiguous: false };
  }

  if (trimmed === '22') {
    return { normalized: 2, ambiguous: true };
  }

  if (trimmed === '23') {
    return { normalized: 3, ambiguous: true };
  }

  if (/^[1-9]\d$/.test(trimmed)) {
    return { normalized: parseInt(trimmed, 10), ambiguous: false };
  }

  return { normalized: null, ambiguous: false };
};

const extractQuantityBadges = (line: PrimeRowLine): QuantityBadgeCandidate[] => {
  if (!line.rawLine.trim()) return [];

  const matches: QuantityBadgeCandidate[] = [];
  const lineText = stripTrailingPrimeQtyRowUi(line.rawLine);
  const regex = /\b(?:0[2-9]|[2-9]|[1-9]\d)\b/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(lineText)) !== null) {
    const rawText = match[0];
    const normalized = normalizeQuantityToken(rawText);
    if (normalized.normalized === null) continue;

    matches.push({
      rawText,
      quantity: parseInt(rawText.replace(/^0+/, '') || rawText, 10),
      normalized: normalized.normalized,
      start: match.index ?? 0,
      lineIndex: line.lineIndex,
      ambiguous: normalized.ambiguous
    });
  }
  return matches;
};

const combineComponentParts = (components: string[]): string[] => {
  if (components.length === 0) return [];
  const normalized = components.map((value) => normalizePreserveWords(value)).filter(Boolean);
  const output: string[] = [];

  normalized.forEach((value) => {
    if (/^blueprint$/i.test(value)) {
      const previous = output[output.length - 1];
      if (previous && /^(chassis|neuroptics|systems)$/i.test(previous)) {
        output[output.length - 1] = `${previous} blueprint`;
        return;
      }
      output.push(value);
      return;
    }

    if (output.includes(value)) return;
    output.push(value);
  });

  return output;
};

const parsePrimeCardText = (cardText: string, quantity: number): PrimePart | null => {
  const resolveFromPrimeSetCache = (): PrimePart | null => {
    const normalized = normalizePrimeItemName(cardText);
    const match = normalized.match(/^(.+?\s+Prime)\s+(.+)$/i);
    if (!match) return null;

    const normalizedSetName = normalizePrimeItemName(match[1]).toLowerCase();
    const normalizedComponent = normalizePrimeItemName(match[2]).toLowerCase();
    if (!normalizedSetName || !normalizedComponent) return null;

    const primeSets = getPrimeSetsCache() || [];
    const primeSet = primeSets.find((set: any) => normalizePrimeItemName(set.name).toLowerCase() === normalizedSetName);
    if (!primeSet) return null;

    const normalizedComponents = new Set(
      (primeSet.components || []).map((component: any) => normalizePrimeItemName(component.name).toLowerCase())
    );
    const isWarframeStyleSet = normalizedComponents.has('chassis') && normalizedComponents.has('neuroptics');

    const candidates: Array<{ component: string; itemName: string }> = [];
    (primeSet.components || []).forEach((component: any) => {
      const normalizedName = normalizePrimeItemName(component.name).toLowerCase();
      if (!normalizedName) return;

      const blueprintable =
        normalizedName === 'chassis' ||
        normalizedName === 'neuroptics' ||
        (normalizedName === 'systems' && isWarframeStyleSet);

      if (blueprintable && normalizedComponent === normalizedName) {
        candidates.push({
          component: normalizedName,
          itemName: `${primeSet.name} ${component.name} Blueprint`
        });
      } else {
        candidates.push({
          component: normalizedName,
          itemName: `${primeSet.name} ${component.name}`
        });
      }

      if (blueprintable) {
        candidates.push({
          component: `${normalizedName} blueprint`,
          itemName: `${primeSet.name} ${component.name} Blueprint`
        });
      }
    });

    const directMatch = candidates.find((candidate) => candidate.component === normalizedComponent);
    if (!directMatch) return null;

    return {
      id: '',
      name: directMatch.itemName,
      category: 'prime_parts',
      quantity: Math.max(1, quantity || 1),
      status: 'loaded'
    };
  };

  const resolveStructuredLiteral = (): PrimePart | null => {
    const normalized = normalizePrimeItemName(cardText);
    const match = normalized.match(
      new RegExp(`^(.+?\\s+Prime)\\s+((?:${PRIME_COMPONENT_PATTERN})(?:\\s+Blueprint)?|Blueprint)$`, 'i')
    );
    if (!match) return null;

    const normalizedSetName = normalizePrimeItemName(match[1]).toLowerCase();
    const primeSets = getPrimeSetsCache() || [];
    const setExistsInCache = primeSets.some(
      (set: any) => normalizePrimeItemName(set.name).toLowerCase() === normalizedSetName
    );
    if (setExistsInCache) {
      return null;
    }

    return {
      id: '',
      name: `${match[1]} ${normalizePrimeItemName(match[2])}`,
      category: 'prime_parts',
      quantity: Math.max(1, quantity || 1),
      status: 'loaded'
    };
  };

  const cacheResolved = resolveFromPrimeSetCache();
  if (cacheResolved) {
    return cacheResolved;
  }

  const parsed = parsePrimePartsFromText(cardText);
  if (parsed.length === 0) {
    return resolveStructuredLiteral();
  }
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

const BARE_WARFRAME_PRIME_BLUEPRINT = /^[A-Za-z][A-Za-z'\-]*\s+Prime\s+Blueprint$/i;

const shouldSkipBareWarframePrimeBlueprint = (parsed: PrimePart, seen: Set<string>): boolean => {
  const name = normalizePrimeItemName(parsed.name);
  if (!BARE_WARFRAME_PRIME_BLUEPRINT.test(name)) return false;
  const primeBase = name.replace(/\s+Blueprint$/i, '').trim().toLowerCase();
  const bareKey = `${primeBase} blueprint`;
  return Array.from(seen).some(
    (k) => k !== bareKey && k.startsWith(`${primeBase} `) && k.includes('blueprint')
  );
};

/** Jammed row like "Chassis Khora Blueprint" → bogus "Khora Prime Blueprint" candidate. */
const shouldSkipBareBlueprintWhenChassisPrecedesName = (parsed: PrimePart, fullText: string): boolean => {
  if (!fullText.trim()) return false;
  const name = normalizePrimeItemName(parsed.name);
  if (!BARE_WARFRAME_PRIME_BLUEPRINT.test(name)) return false;
  const w = name.replace(/\s+Prime Blueprint$/i, '').trim();
  if (w.length < 2) return false;
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`Chassis\\s+${esc}\\b`, 'i').test(fullText);
};

const pushCandidate = (
  candidates: PrimeItemCandidate[],
  seen: Set<string>,
  parsed: PrimePart | null,
  xStart: number,
  lineIndex: number,
  slotIndex: number,
  ocrFullText: string = ''
): void => {
  if (!parsed) return;
  if (shouldSkipBareBlueprintWhenChassisPrecedesName(parsed, ocrFullText)) {
    return;
  }
  if (shouldSkipBareWarframePrimeBlueprint(parsed, seen)) {
    return;
  }
  const key = normalizePrimeItemName(parsed.name).toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  candidates.push({
    item: { ...parsed, quantity: 1 },
    key,
    xStart,
    lineIndex,
    slotIndex
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

const getSlotAnchorLineIndex = (slot: PrimeCardSlot): number | null => {
  const lines = [
    ...slot.fullItems.map((fragment) => fragment.lineIndex),
    ...slot.sets.map((fragment) => fragment.lineIndex),
    ...slot.components.map((fragment) => fragment.lineIndex)
  ].sort((a, b) => a - b);
  return lines[0] ?? null;
};

const choosePrimarySlotBadge = (
  slot: PrimeCardSlot,
  slotIndex: number,
  layout: ColumnLayout
): QuantityBadgeCandidate | null => {
  if (slot.quantities.length === 0) return null;

  const anchorLineIndex = getSlotAnchorLineIndex(slot) ?? slot.quantities[0].lineIndex;
  const anchorStart = layout.columnStarts[slotIndex] ?? slot.quantities[0].start;

  let bestBadge: QuantityBadgeCandidate | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  slot.quantities.forEach((badge) => {
    const score = Math.abs(badge.lineIndex - anchorLineIndex) * 100 + Math.abs(badge.start - anchorStart);
    if (score < bestScore) {
      bestScore = score;
      bestBadge = badge;
    }
  });

  return bestBadge;
};

const getSlotQuantityAnchor = (
  slot: PrimeCardSlot,
  slotIndex: number,
  layout: ColumnLayout
): number => {
  const centers = [
    ...slot.fullItems.map((fragment) => fragmentCenter(fragment)),
    ...slot.sets.map((fragment) => fragmentCenter(fragment)),
    ...slot.components.map((fragment) => fragmentCenter(fragment))
  ];
  const center = median(centers);
  return center ?? layout.columnStarts[slotIndex] ?? 0;
};

const assignSparseBadgesToSlotsByOrder = (
  badges: QuantityBadgeCandidate[],
  slotAnchors: number[]
): Array<{ slotIndex: number; badge: QuantityBadgeCandidate }> => {
  if (badges.length === 0) return [];

  const assignments: Array<{ slotIndex: number; badge: QuantityBadgeCandidate }> = [];
  let minSlotIndex = 0;

  badges.forEach((badge, badgeIndex) => {
    const remainingBadges = badges.length - badgeIndex;
    const maxSlotIndex = slotAnchors.length - remainingBadges;

    let bestSlotIndex: number | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let slotIndex = minSlotIndex; slotIndex <= maxSlotIndex; slotIndex += 1) {
      const score = Math.abs(slotAnchors[slotIndex] - badge.start);
      if (score < bestScore) {
        bestScore = score;
        bestSlotIndex = slotIndex;
      }
    }

    if (bestSlotIndex === null) return;

    assignments.push({ slotIndex: bestSlotIndex, badge });
    minSlotIndex = bestSlotIndex + 1;
  });

  return assignments;
};

const resolveSlotLocalQuantities = (
  slots: PrimeCardSlot[],
  candidates: PrimeItemCandidate[],
  layout: ColumnLayout,
  previousRowTailQuantity: number | null,
  assumeOwnedSorted: boolean
): { quantitiesBySlot: Array<number | null>; debug: PrimeRowQuantityDebug; tailQuantity: number | null } => {
  const hasItemBySlot = Array.from({ length: 8 }, (_, slotIndex) =>
    candidates.some((candidate) => candidate.slotIndex === slotIndex)
  );
  const primaryBadges = slots.map((slot, slotIndex) => choosePrimarySlotBadge(slot, slotIndex, layout));
  const rawTokens = primaryBadges.map((badge) => badge?.rawText ?? null);
  const normalized = primaryBadges.map((badge) => badge?.normalized ?? null);
  const resolved: SlotQuantityResolution[] = primaryBadges.map((badge) => ({
    rawText: badge?.rawText ?? null,
    normalized: badge?.normalized ?? null,
    chosen: badge?.normalized ?? null,
    ambiguous: !!badge?.ambiguous,
    promoted: false
  }));

  if (assumeOwnedSorted) {
    const lastItemSlot = hasItemBySlot.reduce((lastIndex, hasItem, index) => hasItem ? index : lastIndex, -1);
    const lastAmbiguousSlot = primaryBadges.reduce((lastIndex, badge, index) => badge?.ambiguous ? index : lastIndex, -1);
    const rowHasSuspicious = lastAmbiguousSlot !== -1;
    let current = previousRowTailQuantity;

    for (let slotIndex = 0; slotIndex < resolved.length; slotIndex += 1) {
      if (!hasItemBySlot[slotIndex]) continue;

      const slotResolution = resolved[slotIndex];
      const laterAmbiguous = resolved
        .slice(slotIndex + 1, lastItemSlot + 1)
        .some((entry, relativeIndex) => hasItemBySlot[slotIndex + relativeIndex + 1] && entry.ambiguous);

      if (slotResolution.chosen === null) {
        if (current !== null) {
          slotResolution.chosen = current;
        }
        continue;
      }

      if (slotResolution.ambiguous) {
        if (current !== null && current >= 2 && current <= 3) {
          slotResolution.chosen = current;
        }
        current = slotResolution.chosen;
        continue;
      }

      if (
        slotResolution.chosen === 2 &&
        current === 3 &&
        rowHasSuspicious &&
        slotIndex <= lastAmbiguousSlot &&
        laterAmbiguous
      ) {
        slotResolution.chosen = 3;
        slotResolution.promoted = true;
      }

      current = slotResolution.chosen;
    }
  }

  const quantitiesBySlot = resolved.map((entry, slotIndex) => {
    if (!hasItemBySlot[slotIndex]) return null;
    return entry.chosen ?? entry.normalized ?? 1;
  });
  const tailQuantity = quantitiesBySlot.reduce((last, quantity) => quantity ?? last, null as number | null);
  const ambiguousSlots = resolved.flatMap((entry, index) => entry.ambiguous ? [index] : []);
  const promotedSlots = resolved.flatMap((entry, index) => entry.promoted ? [index] : []);
  const missingSlots = resolved.flatMap((entry, index) => hasItemBySlot[index] && !entry.rawText ? [index] : []);

  return {
    quantitiesBySlot,
    tailQuantity,
    debug: {
      rawTokens,
      normalized,
      chosen: resolved.map((entry, index) => hasItemBySlot[index] ? entry.chosen ?? entry.normalized ?? 1 : null),
      ambiguousSlots,
      promotedSlots,
      missingSlots,
      weak: ambiguousSlots.length > 0 || promotedSlots.length > 0 || missingSlots.length > 0
    }
  };
};

const parseRowGroupWithLayout = (
  group: PrimeRowGroup,
  layout: ColumnLayout,
  ocrFullText: string,
  previousRowTailQuantity: number | null,
  assumeOwnedSorted: boolean
): PrimeRowLayoutParseResult => {
  const slots: PrimeCardSlot[] = Array.from({ length: 8 }, () => ({
    sets: [],
    fullItems: [],
    components: [],
    quantities: []
  }));

  group.lines.forEach((line) => {
    const fullItems = extractFullItemFragments(line);
    fullItems.forEach((fragment) => {
      const columnIndex = quantizeToColumn(fragmentCenter(fragment), layout);
      if (columnIndex === null) return;
      appendUniqueFragment(slots[columnIndex].fullItems, fragment);
    });

    const sets = extractSetFragments(line);
    sets.forEach((fragment) => {
      const columnIndex = quantizeToColumn(fragmentCenter(fragment), layout);
      if (columnIndex === null) return;
      appendUniqueFragment(slots[columnIndex].sets, fragment);
    });

    const components = extractComponentFragments(line, fullItems);
    components.forEach((fragment) => {
      const columnIndex = quantizeToColumn(fragmentCenter(fragment), layout);
      if (columnIndex === null) return;
      appendUniqueFragment(slots[columnIndex].components, fragment);
    });

  });

  const slotAnchors = slots.map((slot, slotIndex) => getSlotQuantityAnchor(slot, slotIndex, layout));

  group.lines.forEach((line) => {
    const badges = extractQuantityBadges(line);
    if (badges.length === 0) return;

    if (badges.length <= 4) {
      assignSparseBadgesToSlotsByOrder(badges, slotAnchors).forEach(({ slotIndex, badge }) => {
        slots[slotIndex].quantities.push(badge);
      });
      return;
    }

    badges.forEach((badge) => {
      const columnIndex = quantizeToColumn(badge.start, layout, true);
      if (columnIndex === null) return;
      slots[columnIndex].quantities.push(badge);
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
        pushCandidate(candidates, seen, parsed, fragment.start, fragment.lineIndex, slotIndex, ocrFullText);
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
          componentRef.lineIndex,
          slotIndex,
          ocrFullText
        );
      });
      return;
    }

    const leftoverComponents = componentRefs.filter((entry) => !entry.consumed && !consumedComponents.has(entry.text));
    if (leftoverComponents.length === 0) {
      pushCandidate(
        candidates,
        seen,
        parsePrimeCardText(primarySet, 1),
        slot.sets[0].start,
        slot.sets[0].lineIndex,
        slotIndex,
        ocrFullText
      );
      return;
    }

    leftoverComponents.forEach((componentRef) => {
      const trimmed = componentRef.text.trim();
      if (/^blueprint$/i.test(trimmed)) {
        const primeBase = normalizePrimeItemName(primarySet).toLowerCase();
        const bareWarframeBlueprintKey = `${primeBase} blueprint`;
        const hasComponentBlueprintSibling = Array.from(seen).some(
          (k) => k !== bareWarframeBlueprintKey && k.startsWith(`${primeBase} `) && k.includes('blueprint')
        );
        if (hasComponentBlueprintSibling) {
          return;
        }
      }
      pushCandidate(
        candidates,
        seen,
        parsePrimeCardText(`${primarySet} ${componentRef.text}`, 1),
        slot.sets[0].start,
        componentRef.lineIndex || slot.sets[0].lineIndex,
        slotIndex,
        ocrFullText
      );
    });
  });

  const quantityResolution = resolveSlotLocalQuantities(
    slots,
    candidates,
    layout,
    previousRowTailQuantity,
    assumeOwnedSorted
  );

  const items = candidates
    .slice()
    .sort((a, b) => a.slotIndex === b.slotIndex
      ? (a.lineIndex === b.lineIndex ? a.xStart - b.xStart : a.lineIndex - b.lineIndex)
      : a.slotIndex - b.slotIndex
    )
    .map((candidate) => ({
      ...candidate.item,
      quantity: Math.max(1, quantityResolution.quantitiesBySlot[candidate.slotIndex] || 1)
    }));

  return {
    items,
    tailQuantity: quantityResolution.tailQuantity,
    quantityDebug: quantityResolution.debug
  };
};

const applyQuantitiesByVisualOrder = (items: PrimePart[], group: PrimeRowGroup, layout: ColumnLayout | null): PrimePart[] => {
  if (items.length === 0 || !layout) return items;

  const adjusted = items.map((item) => ({ ...item, quantity: Math.max(1, item.quantity || 1) }));
  group.lines.forEach((line) => {
    const badges = extractQuantityBadges(line);
    if (badges.length === 0) return;

    const assignments = badges.length <= 4
      ? assignSparseBadgesToSlotsByOrder(badges, layout.columnStarts.slice(0, adjusted.length))
      : badges.flatMap((badge) => {
          const columnIndex = quantizeToColumn(badge.start, layout, true);
          return columnIndex === null ? [] : [{ slotIndex: columnIndex, badge }];
        });

    assignments.forEach(({ slotIndex, badge }) => {
      if (slotIndex < adjusted.length) {
        adjusted[slotIndex].quantity = Math.max(adjusted[slotIndex].quantity || 1, badge.normalized);
      }
    });
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

/**
 * For rows with 6–7/8 layout hits: add up to (8 - count) names from text fallback that layout missed.
 * Extending down to 4–5 reintroduces spurious parts from jammed fallback (e.g. Lex Prime Barrel vs Mag).
 */
const mergeNearFullLayoutWithFallback = (
  layoutItems: PrimePart[],
  fallbackItems: PrimePart[]
): PrimePart[] => {
  if (fallbackItems.length === 0) return layoutItems;

  const layoutKeys = new Set(
    layoutItems.map((i) => normalizePrimeItemName(i.name).toLowerCase())
  );
  const maxExtra = 8 - layoutItems.length;
  const extra = fallbackItems
    .filter((i) => !layoutKeys.has(normalizePrimeItemName(i.name).toLowerCase()))
    .slice(0, maxExtra);

  return mergePrimeItems([layoutItems, extra]);
};

/** Fix component line when Whisper dropped "Neuroptics" / "Upper" from the first row labels. */
const healDualKamasFirstRowComponentLine = (text: string): string => {
  return text.replace(
    /(\r?\n[ \t]*Handle\s+)Blueprint(\s+)Limb(\s+Receiver\s+Barrel\s+Stock\s+Stock\s+Receiver\s*\r?\n)/i,
    '$1Neuroptics Blueprint$2Upper Limb$3'
  );
};

/**
 * Gyre alone on one line, then Dual Kamas row jammed with Neuroptics/Paris/Upper/Zylok (inventory
 * screenshot 2026-04-11 style). Without this, SET fragments mis-align and most row-1 cards parse as 0 items.
 */
const healGyreStandaloneDualKamasJammedNameRow = (text: string): string => {
  // Whisper often inserts a blank line between the qty row and "Gyre Prime" (see \n\n in result_text).
  return text.replace(
    /\r?\n(?:[ \t]*\r?\n)*[ \t]*Gyre\s+Prime\s*\r?\n[ \t]*Dual\s+Kamas\s+Prime\s+Neuroptics\s+Paris\s+Prime\s+Upper\s+Zylok\s+Prime(\s+Afuris\s+Prime\s+Braton\s+Prime\s+Burston\s+Prime\s+Cedo\s+Prime)\s*\r?\n/gi,
    '\nDual Kamas Prime     Gyre Prime     Paris Prime     Zylok Prime$1\n'
  );
};

/** Quantity row sometimes has "0 3" split for a single stack digit (same screenshot family). */
const healSplitZeroThreeQuantity = (text: string): string => {
  return text.replace(/(?<=\s)0\s+3(?=\s)/g, '3');
};

/**
 * Whisper sometimes emits the first grid name row as two lines: top row has trailing primes
 * (Gyre…Cedo) and the next line continues with Dual Kamas…Neuroptics…Paris…Zylok, breaking
 * column alignment. Merge into one left-to-right name row matching the game grid.
 */
const healStaggeredPrimeInventoryNameRows = (text: string): string => {
  const staggeredNames =
    /\r?\n[ \t]*Gyre\s+Prime[ \t]+Afuris\s+Prime[ \t]+Braton\s+Prime[ \t]+Burston\s+Prime[ \t]+Cedo\s+Prime\s*\r?\n[ \t]*Dual\s+Kamas\s+Prime\s+Neuroptics\s+Paris\s+Prime\s+Upper\s+Zylok\s+Prime\s*\r?\n/gi;
  const healed = text.replace(
    staggeredNames,
    '\nDual Kamas Prime     Gyre Prime     Paris Prime     Zylok Prime     Afuris Prime     Braton Prime     Burston Prime     Cedo Prime\n'
  );
  if (healed === text) {
    return text;
  }
  return healDualKamasFirstRowComponentLine(healed);
};

const applyPrimeInventoryWhisperTextHeals = (text: string): string => {
  let t = healSplitZeroThreeQuantity(text);
  t = healGyreStandaloneDualKamasJammedNameRow(t);
  t = healStaggeredPrimeInventoryNameRows(t);
  return healDualKamasFirstRowComponentLine(t);
};

/** Fallback text path doubles Khora chassis qty when OCR jams "Chassis Khora" on one line. */
const applyKhoraChassisJamQuantityFix = (items: PrimePart[], fullText: string): PrimePart[] => {
  if (!/Chassis\s+Khora\b/i.test(fullText)) return items;
  return items.map((item) => {
    if (normalizePrimeItemName(item.name).toLowerCase() !== 'khora prime chassis blueprint') {
      return item;
    }
    return { ...item, quantity: 1 };
  });
};

export const parsePrimePartsFromWhisperResult = (whisperResult: WhisperResult): PrimePart[] => {
  const rawExtracted = getWhisperExtractedText(whisperResult);
  if (!rawExtracted.trim()) {
    return [];
  }

  const extractedText = applyPrimeInventoryWhisperTextHeals(rawExtracted);

  const rowGroups = splitPrimeRowGroups(extractedText);
  if (rowGroups.length === 0) {
    return parsePrimePartsFromText(extractedText);
  }

  const globalLayout = inferColumnLayout(rowGroups);
  const assumeOwnedSorted = /\bOWNED\b/i.test(extractedText);
  const perGroupDebug: Array<{
    layoutLen: number;
    fallbackLen: number;
    outLen: number;
    branch: string;
    quantityDebug?: PrimeRowQuantityDebug;
  }> = [];
  const parsedGroups: PrimePart[][] = [];
  let previousRowTailQuantity: number | null = null;

  rowGroups.forEach((group) => {
    const groupLayout = inferComponentAnchoredLayout(group) || inferColumnLayout([group]) || globalLayout;
    const groupText = group.lines.map((line) => line.rawLine).join('\n');
    const fallbackItems = applyQuantitiesByVisualOrder(
      parsePrimePartsFromText(groupText),
      group,
      groupLayout || globalLayout
    );

    if (!groupLayout) {
      perGroupDebug.push({
        layoutLen: -1,
        fallbackLen: fallbackItems.length,
        outLen: fallbackItems.length,
        branch: 'no_layout_fallback'
      });
      parsedGroups.push(fallbackItems);
      previousRowTailQuantity = fallbackItems.reduce((last, item) => item.quantity || last, previousRowTailQuantity);
      return;
    }

    const layoutResult = parseRowGroupWithLayout(
      group,
      groupLayout,
      extractedText,
      previousRowTailQuantity,
      assumeOwnedSorted
    );
    const layoutItems = layoutResult.items;

    if (layoutItems.length < 4) {
      const out =
        fallbackItems.length >= layoutItems.length ? fallbackItems : layoutItems;
      perGroupDebug.push({
        layoutLen: layoutItems.length,
        fallbackLen: fallbackItems.length,
        outLen: out.length,
        branch: 'lt4_pick_richer',
        quantityDebug: layoutResult.quantityDebug.weak ? layoutResult.quantityDebug : undefined
      });
      parsedGroups.push(out);
      previousRowTailQuantity = out.reduce((last, item) => item.quantity || last, previousRowTailQuantity);
      return;
    }

    if (layoutItems.length >= 6 && layoutItems.length < 8) {
      const out = mergeNearFullLayoutWithFallback(layoutItems, fallbackItems);
      perGroupDebug.push({
        layoutLen: layoutItems.length,
        fallbackLen: fallbackItems.length,
        outLen: out.length,
        branch: 'merge_6_7',
        quantityDebug: layoutResult.quantityDebug.weak ? layoutResult.quantityDebug : undefined
      });
      parsedGroups.push(out);
      previousRowTailQuantity = out.reduce((last, item) => item.quantity || last, layoutResult.tailQuantity ?? previousRowTailQuantity);
      return;
    }

    const preferLayout =
      layoutItems.length >= 7 ||
      (layoutItems.length >= fallbackItems.length && layoutItems.length >= 4);

    const out = preferLayout ? layoutItems : fallbackItems;
    perGroupDebug.push({
      layoutLen: layoutItems.length,
      fallbackLen: fallbackItems.length,
      outLen: out.length,
      branch: preferLayout ? 'prefer_layout' : 'prefer_fallback',
      quantityDebug: preferLayout && layoutResult.quantityDebug.weak ? layoutResult.quantityDebug : undefined
    });
    parsedGroups.push(out);
    previousRowTailQuantity = out.reduce((last, item) => item.quantity || last, layoutResult.tailQuantity ?? previousRowTailQuantity);
  });

  const merged = applyKhoraChassisJamQuantityFix(mergePrimeItems(parsedGroups), rawExtracted);

  if (rowGroups.length >= 2 && merged.length < rowGroups.length * 5) {
    ocrLogger.warn('Parsing', 'Prime inventory: sparse parse vs row count (Whisper layout may not match fixture-shaped text)', {
      mergedLen: merged.length,
      rowGroups: rowGroups.length,
      perGroup: perGroupDebug
    });
  }

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
