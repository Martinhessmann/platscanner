import { VoidRelic } from '../../types';
import { extractTextWithLLMWhisperer, isLLMWhispererConfigured, type WhisperResult } from '../llmWhispererService';
import { ocrLogger } from '../ocrLogger';
import { getRelicsCache, loadRelicsData } from '../staticDataService';
import { parseGenericItemsFromText } from './stepGenericItemsParser';
import { getWhisperExtractedText } from './stepTextExtraction';

type RelicRarity = 'intact' | 'exceptional' | 'flawless' | 'radiant';

type LineBounds = {
  x: number;
  y: number;
  height: number;
  width: number;
};

type RelicRowLine = {
  lineIndex: number;
  rawLine: string;
  sanitizedLine: string;
  normalizedLine: string;
  quantityOnly: boolean;
  hasRelicAnchor: boolean;
  hasRefinement: boolean;
  bounds: LineBounds | null;
};

type RelicRowGroup = {
  lines: RelicRowLine[];
  minY: number;
  maxY: number;
};

type ColumnLayout = {
  columnStarts: number[];
  width: number;
};

type PhraseFragment = {
  text: string;
  start: number;
  end: number;
  lineIndex: number;
  rarity?: RelicRarity | null;
  valid: boolean;
};

type RelicSlot = {
  relics: PhraseFragment[];
  refinements: Array<{ rarity: RelicRarity; start: number; lineIndex: number }>;
  quantities: Array<{ quantity: number; start: number; lineIndex: number }>;
};

type ResolvedRelicCandidate = {
  item: VoidRelic | null;
  suspicious: boolean;
  explicitQuantity: boolean;
  slotIndex: number;
  groupIndex: number;
  xStart: number;
  lineIndex: number;
  rect: SlotRect | null;
};

type SlotRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
};

type CanvasLike = {
  width: number;
  height: number;
  getContext: (contextId: '2d') => any;
  toBlob?: (callback: (blob: Blob | null) => void, type?: string) => void;
  toBuffer?: (mimeType?: string) => Uint8Array;
};

type LoadedImageSource = {
  source: any;
  width: number;
  height: number;
  cleanup: () => void;
  createCanvas: (width: number, height: number) => Promise<CanvasLike | null>;
};

type WhisperPageBounds = {
  width: number;
  height: number;
};

const RELIC_UI_SEGMENTS = [
  /VOID\s+RELICS\s*\/\s*REFINEMENT/gi,
  /\bVOID\s+RELICS\b/gi,
  /\bREFINEMENT\b/gi,
  /\bCOLLECTED\b/gi,
  /\bSEARCH\b/gi,
  /SELECT\s+A\s+RELIC\s+TO\s+VIEW\s+ITS\s+REWARDS\.?/gi,
  /VISIT\s+VARZIA/gi,
  /\bEXIT\b/gi,
  /\bALL\b/gi,
  /<<<+/g
];

const STANDARD_RELIC_REGEX = /\b(Lith|Meso|Neo|Axi)\s+([A-Z0-9][A-Z0-9]*)(?:\s+Relic)?(?:\s{0,3}[\[\(]\s*(Intact|Exceptional|Flawless|Radiant)\s*[\]\)])?/gi;
const REQUIEM_RELIC_REGEX = /\b(Requiem)(?:\s+([IVX]+))?(?:\s+Relic)?(?:\s{0,3}[\[\(]\s*(Intact|Exceptional|Flawless|Radiant)\s*[\]\)])?/gi;
const REFINEMENT_REGEX = /\b(Intact|Exceptional|Flawless|Radiant)\b/gi;
const RELIC_NAME_REGEX = /\b(?:Lith|Meso|Neo|Axi)\s+[A-Z0-9][A-Z0-9]*\b/i;
const RELIC_NAME_ALIASES = new Map<string, string>([
  ['neo o3 relic', 'Neo O3 Relic']
]);

let knownRelicNamesPromise: Promise<Map<string, string>> | null = null;

const stripUiSegmentsPreserveSpacing = (value: string): string => {
  return RELIC_UI_SEGMENTS.reduce((current, pattern) => {
    return current.replace(pattern, (match) => ' '.repeat(match.length));
  }, value);
};

const sanitizePreserveSpacing = (value: string): string => {
  return stripUiSegmentsPreserveSpacing(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\f/g, ' ')
    .replace(/[^A-Za-z0-9[\]()×x+\-\s]/g, ' ');
};

const normalizeWhitespace = (value: string): string => {
  return sanitizePreserveSpacing(value).replace(/\s+/g, ' ').trim();
};

const normalizeRelicKey = (value: string): string => normalizeWhitespace(value).toLowerCase();

const normalizeRarity = (value: string | null | undefined): RelicRarity | null => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'intact' || normalized === 'exceptional' || normalized === 'flawless' || normalized === 'radiant') {
    return normalized;
  }
  return null;
};

const normalizeRelicCode = (value: string): string | null => {
  const compact = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (compact.length < 2) return null;

  const chars = compact.split('');

  if (/^\d/.test(chars[0])) {
    if (chars[0] === '0') chars[0] = 'O';
    else if (chars[0] === '1') chars[0] = 'I';
  }

  for (let index = 1; index < chars.length; index += 1) {
    if (chars[index] === 'O' || chars[index] === 'D' || chars[index] === 'Q') chars[index] = '0';
    if (chars[index] === 'I' || chars[index] === 'L') chars[index] = '1';
    if (!/\d/.test(chars[index])) return null;
  }

  if (!/[A-Z]/.test(chars[0])) return null;
  return chars.join('');
};

const canonicalizeKnownRelicName = (rawName: string): string | null => {
  const clean = normalizeWhitespace(
    rawName
      .replace(/[\[\(]\s*(Intact|Exceptional|Flawless|Radiant)\s*[\]\)]/gi, ' ')
      .replace(/\b(Intact|Exceptional|Flawless|Radiant)\b/gi, ' ')
  );

  let match = clean.match(/^(Lith|Meso|Neo|Axi)\s+([A-Z0-9][A-Z0-9]*)(?:\s+Relic)?$/i);
  if (match) {
    const era = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    const normalizedCode = normalizeRelicCode(match[2]);
    if (!normalizedCode) return null;
    return `${era} ${normalizedCode} Relic`;
  }

  match = clean.match(/^Requiem\s+([IVX]+)(?:\s+Relic)?$/i);
  if (match) {
    return `Requiem ${match[1].toUpperCase()} Relic`;
  }

  return null;
};

const getKnownRelicNameMap = async (): Promise<Map<string, string>> => {
  if (!knownRelicNamesPromise) {
    knownRelicNamesPromise = (async () => {
      const relics = getRelicsCache() || await loadRelicsData();
      const map = new Map<string, string>();

      relics.forEach((relic: any) => {
        const canonical = canonicalizeKnownRelicName(
          String(relic?.name || '').replace(/\s+(Intact|Exceptional|Flawless|Radiant)$/i, '')
        );
        if (!canonical) return;
        map.set(normalizeRelicKey(canonical), canonical);
      });

      RELIC_NAME_ALIASES.forEach((canonical, key) => {
        map.set(key, canonical);
      });

      return map;
    })();
  }

  return knownRelicNamesPromise;
};

const isQuantityOnlyLine = (value: string): boolean => {
  const normalized = normalizeWhitespace(value).replace(/[×]/g, 'x');
  if (!normalized) return false;
  return normalized.split(/\s+/).every((token) => /^x?\d+$/i.test(token));
};

const getLineBounds = (whisperResult: WhisperResult, lineIndex: number): LineBounds | null => {
  const bounds = Array.isArray(whisperResult.line_metadata) ? whisperResult.line_metadata[lineIndex] : null;
  if (!Array.isArray(bounds) || bounds.length < 4) return null;
  const [x, y, height, width] = bounds.map((value) => Number(value) || 0);
  if (width <= 0 || height < 0) return null;
  return { x, y, height, width };
};

const buildRelevantRelicLines = (whisperResult: WhisperResult): RelicRowLine[] => {
  const rawLines = getWhisperExtractedText(whisperResult).split('\n');

  return rawLines
    .map((rawLine, lineIndex) => {
      const sanitizedLine = sanitizePreserveSpacing(rawLine);
      const normalizedLine = normalizeWhitespace(rawLine);
      const quantityOnly = isQuantityOnlyLine(rawLine);
      const hasRelicAnchor = STANDARD_RELIC_REGEX.test(sanitizedLine) || REQUIEM_RELIC_REGEX.test(sanitizedLine) || RELIC_NAME_REGEX.test(normalizedLine);
      const hasRefinement = REFINEMENT_REGEX.test(sanitizedLine);
      STANDARD_RELIC_REGEX.lastIndex = 0;
      REQUIEM_RELIC_REGEX.lastIndex = 0;
      REFINEMENT_REGEX.lastIndex = 0;

      return {
        lineIndex,
        rawLine: rawLine.replace(/\f/g, ' '),
        sanitizedLine,
        normalizedLine,
        quantityOnly,
        hasRelicAnchor,
        hasRefinement,
        bounds: getLineBounds(whisperResult, lineIndex)
      };
    })
    .filter((line) => line.quantityOnly || line.hasRelicAnchor || line.hasRefinement);
};

const splitRelicRowGroups = (lines: RelicRowLine[]): RelicRowGroup[] => {
  const groups: RelicRowGroup[] = [];
  let current: RelicRowLine[] = [];

  const commitCurrent = () => {
    if (current.length === 0) return;
    const yValues = current
      .flatMap((line) => line.bounds ? [line.bounds.y, line.bounds.y + line.bounds.height] : [])
      .filter((value) => Number.isFinite(value));
    const minY = yValues.length > 0 ? Math.min(...yValues) : current[0].lineIndex * 100;
    const maxY = yValues.length > 0 ? Math.max(...yValues) : current[current.length - 1].lineIndex * 100 + 60;

    groups.push({ lines: current, minY, maxY });
    current = [];
  };

  lines.forEach((line) => {
    const previous = current[current.length - 1];
    const currentHasContent = current.some((entry) => !entry.quantityOnly);
    const quantitiesOnly = current.length > 0 && current.every((entry) => entry.quantityOnly);

    const previousY = previous?.bounds?.y ?? (previous?.lineIndex ?? 0) * 100;
    const currentY = line.bounds?.y ?? line.lineIndex * 100;
    const gap = currentY - previousY;

    const shouldStartNewGroup = !previous
      ? false
      : (line.quantityOnly && currentHasContent)
        || (!line.quantityOnly && quantitiesOnly && gap > 420)
        || (!quantitiesOnly && gap > 220);

    if (shouldStartNewGroup) {
      commitCurrent();
    }

    current.push(line);
  });

  commitCurrent();
  return groups.filter((group) => group.lines.some((line) => line.hasRelicAnchor));
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const clusterStarts = (starts: number[], tolerance = 6): number[] => {
  const sorted = [...starts].sort((a, b) => a - b);
  const clusters: number[][] = [];

  sorted.forEach((start) => {
    const cluster = clusters[clusters.length - 1];
    if (!cluster || Math.abs(median(cluster) - start) > tolerance) {
      clusters.push([start]);
      return;
    }
    cluster.push(start);
  });

  return clusters.map((cluster) => Math.round(median(cluster)));
};

const getWhisperPageBounds = (whisperResult: WhisperResult): WhisperPageBounds | null => {
  if (!Array.isArray(whisperResult.line_metadata)) return null;

  let width = 0;
  let height = 0;

  whisperResult.line_metadata.forEach((entry) => {
    if (!Array.isArray(entry) || entry.length < 4) return;
    const x = Number(entry[0]) || 0;
    const y = Number(entry[1]) || 0;
    const lineHeight = Number(entry[2]) || 0;
    const lineWidth = Number(entry[3]) || 0;
    width = Math.max(width, x + lineWidth);
    height = Math.max(height, y + lineHeight);
  });

  if (width <= 0 || height <= 0) return null;
  return { width, height };
};

const extractRelicFragments = (
  line: RelicRowLine,
  knownRelics: Map<string, string>
): PhraseFragment[] => {
  const fragments: PhraseFragment[] = [];

  let match: RegExpExecArray | null;
  STANDARD_RELIC_REGEX.lastIndex = 0;
  while ((match = STANDARD_RELIC_REGEX.exec(line.sanitizedLine)) !== null) {
    const canonical = canonicalizeKnownRelicName(`${match[1]} ${match[2]} Relic`);
    const validated = canonical ? knownRelics.get(normalizeRelicKey(canonical)) || null : null;
    fragments.push({
      text: validated || canonical || `${match[1]} ${match[2]} Relic`,
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      lineIndex: line.lineIndex,
      rarity: normalizeRarity(match[3]),
      valid: !!validated
    });
  }

  REQUIEM_RELIC_REGEX.lastIndex = 0;
  while ((match = REQUIEM_RELIC_REGEX.exec(line.sanitizedLine)) !== null) {
    const canonical = match[2] ? canonicalizeKnownRelicName(`Requiem ${match[2]} Relic`) : null;
    const validated = canonical ? knownRelics.get(normalizeRelicKey(canonical)) || null : null;
    fragments.push({
      text: validated || normalizeWhitespace(match[0]) || 'Requiem Relic',
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      lineIndex: line.lineIndex,
      rarity: normalizeRarity(match[3]),
      valid: !!validated
    });
  }

  return fragments.sort((a, b) => a.start - b.start);
};

const extractRefinementFragments = (line: RelicRowLine): Array<{ rarity: RelicRarity; start: number; lineIndex: number }> => {
  const refinements: Array<{ rarity: RelicRarity; start: number; lineIndex: number }> = [];
  let match: RegExpExecArray | null;
  REFINEMENT_REGEX.lastIndex = 0;
  while ((match = REFINEMENT_REGEX.exec(line.sanitizedLine)) !== null) {
    const rarity = normalizeRarity(match[1]);
    if (!rarity) continue;
    refinements.push({
      rarity,
      start: match.index ?? 0,
      lineIndex: line.lineIndex
    });
  }
  return refinements;
};

const extractQuantityStarts = (line: RelicRowLine): Array<{ quantity: number; start: number }> => {
  if (!line.quantityOnly) return [];
  const matches: Array<{ quantity: number; start: number }> = [];
  const regex = /[x×]?\s*(\d+)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line.rawLine)) !== null) {
    matches.push({
      quantity: parseInt(match[1], 10),
      start: match.index ?? 0
    });
  }
  return matches.filter((entry) => entry.quantity >= 0);
};

const inferRelicColumnLayout = (
  groups: RelicRowGroup[],
  knownRelics: Map<string, string>
): ColumnLayout | null => {
  const starts = groups.flatMap((group) => group.lines.flatMap((line) => extractRelicFragments(line, knownRelics).map((fragment) => fragment.start)));
  const columnStarts = clusterStarts(starts);
  if (columnStarts.length < 2) return null;

  const diffs = columnStarts.slice(1).map((start, index) => start - columnStarts[index]).filter((diff) => diff >= 8 && diff <= 28);
  const width = diffs.length > 0 ? median(diffs) : 18;
  return { columnStarts, width };
};

const quantizeToColumn = (start: number, layout: ColumnLayout, rightBias = false): number | null => {
  const probe = rightBias ? start + layout.width * 0.25 : start;
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
  if (bestDistance > Math.max(6, layout.width * 0.8)) return null;
  return bestIndex;
};

const buildSlotRect = (
  group: RelicRowGroup,
  layout: ColumnLayout,
  slotIndex: number,
  pageBounds: WhisperPageBounds | null
): SlotRect | null => {
  const referenceLine = group.lines
    .filter((line) => line.bounds && line.rawLine.length > 0)
    .sort((a, b) => (b.bounds?.width || 0) - (a.bounds?.width || 0))[0];

  if (!referenceLine?.bounds) return null;

  const charLength = Math.max(referenceLine.rawLine.length, 1);
  const columnStart = layout.columnStarts[slotIndex];
  const nextColumn = layout.columnStarts[slotIndex + 1] ?? (columnStart + layout.width);
  const startChar = Math.max(0, columnStart - layout.width * 0.22);
  const endChar = nextColumn - layout.width * 0.08;
  const estimatedCardTopPadding = Math.max(referenceLine.bounds.height * 6, 260);
  const estimatedBottomPadding = Math.max(referenceLine.bounds.height * 1.5, 80);

  const x1 = referenceLine.bounds.x + (startChar / charLength) * referenceLine.bounds.width;
  const x2 = referenceLine.bounds.x + (endChar / charLength) * referenceLine.bounds.width;

  const width = Math.max(80, Math.round(x2 - x1));
  const x = Math.max(0, Math.round(x1));
  const y = Math.max(
    0,
    Math.round(
      Math.min(group.minY - 24, referenceLine.bounds.y - estimatedCardTopPadding)
    )
  );
  const height = Math.max(180, Math.round(group.maxY - y + estimatedBottomPadding));

  return {
    x,
    y,
    width,
    height,
    pageWidth: pageBounds?.width || referenceLine.bounds.width,
    pageHeight: pageBounds?.height || Math.max(group.maxY, y + height)
  };
};

const parseRelicCropResult = (
  whisperResult: WhisperResult,
  knownRelics: Map<string, string>,
  fallbackRarity: RelicRarity
): VoidRelic | null => {
  const text = getWhisperExtractedText(whisperResult);
  if (!text.trim()) return null;

  const lines = text
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const relicMatches = new Map<string, VoidRelic>();
  let quantity = 1;
  let rarity: RelicRarity = fallbackRarity;

  lines.forEach((line) => {
    const quantityMatch = line.match(/^[x×]?\s*(\d+)$/i) || line.match(/^[x×](\d+)\s+/i) || line.match(/\s+[x×](\d+)$/i);
    if (quantityMatch) {
      quantity = Math.max(quantity, parseInt(quantityMatch[1], 10));
    }

    const fragments = extractRelicFragments({
      lineIndex: 0,
      rawLine: line,
      sanitizedLine: sanitizePreserveSpacing(line),
      normalizedLine: normalizeWhitespace(line),
      quantityOnly: false,
      hasRelicAnchor: true,
      hasRefinement: REFINEMENT_REGEX.test(line),
      bounds: null
    }, knownRelics);

    fragments.forEach((fragment) => {
      if (!fragment.valid) return;
      relicMatches.set(normalizeRelicKey(fragment.text), {
        id: '',
        category: 'relics',
        name: fragment.text,
        quantity: 1,
        rarity: fragment.rarity || fallbackRarity,
        status: 'loading'
      });
      if (fragment.rarity) {
        rarity = fragment.rarity;
      }
    });

    const lineRarity = normalizeRarity((line.match(REFINEMENT_REGEX)?.[1]) || null);
    if (lineRarity) {
      rarity = lineRarity;
    }
  });

  if (relicMatches.size !== 1) return null;
  const item = Array.from(relicMatches.values())[0];
  return {
    ...item,
    quantity: Math.max(1, quantity),
    rarity
  };
};

const loadImageSource = async (imageFile: File): Promise<LoadedImageSource | null> => {
  if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(imageFile);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => {
          if (typeof (bitmap as ImageBitmap).close === 'function') {
            (bitmap as ImageBitmap).close();
          }
        },
        createCanvas: async (width: number, height: number) => {
          if (typeof document === 'undefined') return null;
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          return canvas;
        }
      };
    }

    const url = URL.createObjectURL(imageFile);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = url;
    });

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => URL.revokeObjectURL(url),
      createCanvas: async (width: number, height: number) => {
        if (typeof document === 'undefined') return null;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
      }
    };
  }

  try {
    const { createCanvas, loadImage } = await import('canvas');
    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const image = await loadImage(imageBuffer);

    return {
      source: image,
      width: image.width,
      height: image.height,
      cleanup: () => {},
      createCanvas: async (width: number, height: number) => createCanvas(width, height) as unknown as CanvasLike
    };
  } catch (error) {
    ocrLogger.warn('Parsing', 'Canvas runtime unavailable for relic crop fallback', {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
};

const buildSlotCanvas = async (image: LoadedImageSource, rect: SlotRect): Promise<CanvasLike | null> => {
  const scaleX = image.width / Math.max(rect.pageWidth, 1);
  const scaleY = image.height / Math.max(rect.pageHeight, 1);

  const x = Math.max(0, Math.min(Math.round(rect.x * scaleX), image.width - 1));
  const y = Math.max(0, Math.min(Math.round(rect.y * scaleY), image.height - 1));
  const width = Math.max(1, Math.min(Math.round(rect.width * scaleX), image.width - x));
  const height = Math.max(1, Math.min(Math.round(rect.height * scaleY), image.height - y));

  const canvas = await image.createCanvas(width, height);
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(image.source, x, y, width, height, 0, 0, width, height);
  return canvas;
};

const canvasToFile = async (canvas: CanvasLike, fileName: string): Promise<File | null> => {
  if (typeof canvas.toBlob === 'function') {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob!(resolve, 'image/png'));
    if (!blob) return null;
    return new File([blob], fileName, { type: 'image/png' });
  }

  if (typeof canvas.toBuffer === 'function') {
    const buffer = canvas.toBuffer('image/png');
    return new File([buffer], fileName, { type: 'image/png' });
  }

  return null;
};

const detectHiddenMarker = (canvas: CanvasLike): boolean => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const sampleX = Math.max(0, Math.floor(canvas.width * 0.1));
  const sampleY = 0;
  const sampleWidth = Math.max(24, Math.floor(canvas.width * 0.16));
  const sampleHeight = Math.max(14, Math.floor(canvas.height * 0.1));
  const { data } = ctx.getImageData(sampleX, sampleY, sampleWidth, sampleHeight);

  let warmGoldPixels = 0;
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];
    if (a < 100) continue;
    if (r > 90 && g > 70 && b < 95 && r > g * 0.9 && g > b * 1.1) {
      warmGoldPixels += 1;
    }
  }

  return warmGoldPixels > Math.max(10, (sampleWidth * sampleHeight) * 0.012);
};

const shouldCropCandidate = (candidate: ResolvedRelicCandidate): boolean => {
  return !candidate.item || candidate.suspicious;
};

const isCropImprovement = (current: ResolvedRelicCandidate, cropItem: VoidRelic | null): boolean => {
  if (!cropItem) return false;
  if (!current.item) return true;
  if (normalizeRelicKey(current.item.name) !== normalizeRelicKey(cropItem.name)) {
    return current.suspicious;
  }
  if ((current.item.quantity || 1) === 1 && (cropItem.quantity || 1) > 1) {
    return true;
  }
  return (current.item.rarity || 'intact') === 'intact' && cropItem.rarity !== 'intact';
};

const resolveRelicSlots = (
  group: RelicRowGroup,
  groupIndex: number,
  layout: ColumnLayout,
  knownRelics: Map<string, string>,
  pageBounds: WhisperPageBounds | null
): ResolvedRelicCandidate[] => {
  const slots: RelicSlot[] = Array.from({ length: layout.columnStarts.length }, () => ({
    relics: [],
    refinements: [],
    quantities: []
  }));

  group.lines.forEach((line) => {
    extractRelicFragments(line, knownRelics).forEach((fragment) => {
      const columnIndex = quantizeToColumn(fragment.start, layout);
      if (columnIndex === null) return;
      slots[columnIndex].relics.push(fragment);
    });

    extractRefinementFragments(line).forEach((fragment) => {
      const columnIndex = quantizeToColumn(fragment.start, layout);
      if (columnIndex === null) return;
      slots[columnIndex].refinements.push(fragment);
    });

    extractQuantityStarts(line).forEach(({ quantity, start }) => {
      const columnIndex = quantizeToColumn(start, layout, true);
      if (columnIndex === null) return;
      slots[columnIndex].quantities.push({ quantity, start, lineIndex: line.lineIndex });
    });
  });

  return slots.map((slot, slotIndex) => {
    const uniqueValid = new Map<string, PhraseFragment>();
    const uniqueInvalid = new Map<string, PhraseFragment>();

    slot.relics
      .sort((a, b) => a.lineIndex === b.lineIndex ? a.start - b.start : a.lineIndex - b.lineIndex)
      .forEach((fragment) => {
        const key = normalizeRelicKey(fragment.text);
        if (fragment.valid) {
          if (!uniqueValid.has(key)) uniqueValid.set(key, fragment);
          return;
        }
        if (!uniqueInvalid.has(key)) uniqueInvalid.set(key, fragment);
      });

    const quantity = slot.quantities.length > 0
      ? Math.max(...slot.quantities.map((entry) => entry.quantity))
      : 1;
    const explicitQuantity = slot.quantities.length > 0;

    const validFragments = Array.from(uniqueValid.values());
    const invalidFragments = Array.from(uniqueInvalid.values());
    const chosenFragment = validFragments[0] || invalidFragments[0] || null;
    const refinement = slot.refinements[0]?.rarity || chosenFragment?.rarity || 'intact';

    const item = chosenFragment
      ? {
          id: '',
          category: 'relics' as const,
          name: chosenFragment.text,
          quantity,
          rarity: refinement,
          status: 'loading' as const
        }
      : null;

    const suspicious = !item
      || !chosenFragment?.valid
      || validFragments.length > 1
      || invalidFragments.length > 0
      || item?.name === 'Requiem Relic';

    return {
      item,
      suspicious,
      explicitQuantity,
      slotIndex,
      groupIndex,
      xStart: layout.columnStarts[slotIndex],
      lineIndex: chosenFragment?.lineIndex ?? group.lines[0].lineIndex,
      rect: buildSlotRect(group, layout, slotIndex, pageBounds)
    };
  });
};

const applyRuntimeRelicFallbacks = async (
  candidates: ResolvedRelicCandidate[],
  imageFile: File,
  knownRelics: Map<string, string>
): Promise<VoidRelic[]> => {
  const image = await loadImageSource(imageFile);
  if (!image) {
    return candidates
      .map((candidate) => candidate.item)
      .filter((item): item is VoidRelic => !!item);
  }

  try {
    const resolved: VoidRelic[] = [];
    const canCrop = isLLMWhispererConfigured();
    const explicitQuantityCountsByGroup = new Map<number, number>();

    candidates.forEach((candidate) => {
      if (!candidate.explicitQuantity) return;
      explicitQuantityCountsByGroup.set(
        candidate.groupIndex,
        (explicitQuantityCountsByGroup.get(candidate.groupIndex) || 0) + 1
      );
    });

    for (const candidate of candidates) {
      let current = candidate.item ? { ...candidate.item } : null;
      const rect = candidate.rect;

      if (!rect) {
        if (current) resolved.push(current);
        continue;
      }

      const canvas = await buildSlotCanvas(image, rect);
      if (!canvas) {
        if (current) resolved.push(current);
        continue;
      }

      const groupExplicitQuantities = explicitQuantityCountsByGroup.get(candidate.groupIndex) || 0;
      const shouldCheckHiddenMarker = !candidate.explicitQuantity && groupExplicitQuantities <= 1;

      if (shouldCheckHiddenMarker && detectHiddenMarker(canvas)) {
        continue;
      }

      if (canCrop && shouldCropCandidate(candidate)) {
        const cropFile = await canvasToFile(canvas, `relic-slot-${candidate.groupIndex}-${candidate.slotIndex}.png`);
        if (cropFile) {
          try {
            const cropResult = await extractTextWithLLMWhisperer(cropFile, {
              label: `relic-slot-${candidate.groupIndex}-${candidate.slotIndex}`,
              logRawResponse: false,
              quiet: true
            });
            const cropItem = parseRelicCropResult(cropResult, knownRelics, (current?.rarity as RelicRarity) || 'intact');
            if (isCropImprovement(candidate, cropItem)) {
              current = cropItem;
            }
          } catch (error) {
            ocrLogger.warn('Parsing', 'Relic slot crop fallback failed', {
              slotIndex: candidate.slotIndex,
              groupIndex: candidate.groupIndex,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }

      if (current) {
        resolved.push(current);
      }
    }

    return resolved;
  } finally {
    image.cleanup();
  }
};

const mergeRelics = (items: VoidRelic[]): VoidRelic[] => {
  const merged = new Map<string, VoidRelic>();

  items.forEach((item) => {
    const key = `${normalizeRelicKey(item.name)}:${item.rarity || 'intact'}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...item,
        quantity: Math.max(0, item.quantity || 1)
      });
      return;
    }

    merged.set(key, {
      ...existing,
      quantity: Math.max(existing.quantity || 1, item.quantity || 1)
    });
  });

  return Array.from(merged.values()).map((item, index) => ({
    ...item,
    id: `relic-meta-${index}`
  }));
};

const isLikelyRelicGridScreen = (text: string, groups: RelicRowGroup[], layout: ColumnLayout | null): boolean => {
  const lower = text.toLowerCase();
  const anchorCount = (text.match(/\b(?:Lith|Meso|Neo|Axi)\s+[A-Z]\d+\b/gi)?.length || 0)
    + (text.match(/\bRequiem(?:\s+[IVX]+)?(?:\s+Relic)?\b/gi)?.length || 0);
  return (
    lower.includes('void relics') ||
    lower.includes('refinement') ||
    (anchorCount >= 2 && !!layout && layout.columnStarts.length >= 2)
  );
};

export const parseRelicsFromWhisperResult = async (
  whisperResult: WhisperResult,
  imageFile?: File
): Promise<VoidRelic[]> => {
  const extractedText = getWhisperExtractedText(whisperResult);
  if (!extractedText.trim()) {
    return [];
  }

  const knownRelics = await getKnownRelicNameMap();
  const relevantLines = buildRelevantRelicLines(whisperResult);
  const rowGroups = splitRelicRowGroups(relevantLines);
  const layout = inferRelicColumnLayout(rowGroups, knownRelics);
  const pageBounds = getWhisperPageBounds(whisperResult);

  if (!isLikelyRelicGridScreen(extractedText, rowGroups, layout)) {
    return parseGenericItemsFromText(extractedText, 'relics') as VoidRelic[];
  }

  if (!layout) {
    return parseGenericItemsFromText(extractedText, 'relics') as VoidRelic[];
  }

  const pageCandidates = rowGroups.flatMap((group, groupIndex) => resolveRelicSlots(group, groupIndex, layout, knownRelics, pageBounds));
  const resolved = imageFile
    ? await applyRuntimeRelicFallbacks(pageCandidates, imageFile, knownRelics)
    : pageCandidates
        .map((candidate) => candidate.item)
        .filter((item): item is VoidRelic => !!item);

  const merged = mergeRelics(
    resolved.filter((item) => item.quantity !== 0)
  );

  ocrLogger.info('Parsing', 'Metadata-aware relic grid parsing completed', {
    rowGroups: rowGroups.length,
    columns: layout.columnStarts.length,
    parsedItems: merged.map((item) => `${item.name} x${item.quantity || 1} (${item.rarity || 'intact'})`)
  });

  return merged;
};
