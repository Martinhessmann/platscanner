import { DetectedItem, PrimePart, VoidRelic } from '../types';
import { getCategorizedInventory } from './inventoryService';
import { determineModRarity } from './modService';
import { ocrLogger } from './ocrLogger';
import { getPrimeSetsCache } from './staticDataService';
import {
  isLLMWhispererConfigured,
  extractTextWithLLMWhisperer,
  WhisperResult
} from './llmWhispererService';



// LLMWhisperer-only OCR pipeline

// UI text patterns to filter out (noise from Warframe UI)
const UI_NOISE_PATTERNS = [
  /^(inventory|sell|search|exit|total|tap|hold|select|info|price|items?|sort by|duplicates|fragments?|credits|endo)$/i,
  /inventory\/sell/i,
  /sell\s*(price|items)/i,
  /tap\s*(on|and)/i,
  /more\s*info/i,
  /only\s*sellable/i,
  /search\.\.\./i,
  /modding/i,
  /fusion/i,
  /transmute/i,
  /dissolve/i,
  /quick select/i,
  /filter/i,
  /riven capacity/i,
  /ayatan treasures/i,
  /no mod selected/i,
  /hold to preview/i,
  /tap to select/i,
  /^\s*[@#$%^&*|\\[\]{}:~\-]+\s*$/,  // Lines with only special chars
  /^\s*[ivxlcdm]+\s*$/i,  // Roman numerals only
];

// Check if a line is UI noise
const isUINoiseText = (line: string): boolean => {
  const trimmed = line.trim();

  // NEVER skip potential quantities or unowned markers
  const isQuantityOrMarker =
    /^([x×])?(\d+)$/i.test(trimmed) ||
    /^[\(\[]?[Oo0ØVv@©®\-\s][\)\]]?$/.test(trimmed) ||
    trimmed === '()' || trimmed === '[]' || trimmed === 'x' || trimmed === '×';

  if (isQuantityOrMarker) return false;

  // Too short (likely OCR noise if NOT a quantity/marker)
  if (trimmed.length < 2) return true;

  // Too many special characters relative to alphanumeric (increased tolerance for markers)
  const alphaNum = trimmed.replace(/[^a-zA-Z0-9]/g, '').length;
  if (trimmed.length > 3 && alphaNum < trimmed.length * 0.3) return true;

  // Matches known UI patterns
  return UI_NOISE_PATTERNS.some(pattern => pattern.test(trimmed));
};

// Determine screen type based on extracted text
const determineScreenType = (text: string): 'prime_parts' | 'relics' | 'syndicate' | 'mods' | 'unknown' => {
  ocrLogger.debug('ScreenType', 'Determining screen type from extracted text', {
    textLength: text.length,
    textPreview: text.substring(0, 200)
  });

  const lowerText = text.toLowerCase();

  // Check for syndicate indicators
  if (
    lowerText.includes('syndicate offerings') ||
    lowerText.includes('arbiters of hexis') ||
    lowerText.includes('steel meridian') ||
    lowerText.includes('cephalon suda') ||
    lowerText.includes('perrin sequence') ||
    lowerText.includes('red veil') ||
    lowerText.includes('new loka') ||
    lowerText.includes('arbitration honors')
  ) {
    ocrLogger.info('ScreenType', 'Detected screen type: syndicate');
    return 'syndicate';
  }

  // Check for relic indicators
  if (
    lowerText.includes('void relics') ||
    lowerText.includes('relic') ||
    /\b(lith|meso|neo|axi)\s+[a-z]\d+/i.test(text)
  ) {
    ocrLogger.info('ScreenType', 'Detected screen type: relics');
    return 'relics';
  }

  // Check for prime parts BEFORE mods (more specific patterns first)
  // "PRIME PARTS" header or multiple Prime item names
  if (
    lowerText.includes('prime parts') ||
    (lowerText.includes('prime') && (
      lowerText.includes('blueprint') ||
      lowerText.includes('chassis') ||
      lowerText.includes('neuroptics') ||
      lowerText.includes('systems') ||
      lowerText.includes('barrel') ||
      lowerText.includes('receiver') ||
      lowerText.includes('stock') ||
      lowerText.includes('blade') ||
      lowerText.includes('handle') ||
      lowerText.includes('link') ||
      lowerText.includes('boot') ||
      lowerText.includes('gauntlet')
    ))
  ) {
    ocrLogger.info('ScreenType', 'Detected screen type: prime_parts');
    return 'prime_parts';
  }

  // Check for mod indicators (polarity symbols, drain costs)
  // Be more specific to avoid false positives from OCR noise
  if (
    /\bmods?\b/i.test(text) ||
    /\b(drain|capacity)\s*:?\s*\d+/i.test(text) ||
    /\d+\s*\/\s*\d+\s*\(drain/i.test(text) // Rank format with drain
  ) {
    ocrLogger.info('ScreenType', 'Detected screen type: mods');
    return 'mods';
  }

  // Fallback check for prime parts (less specific)
  if (lowerText.includes('prime') || lowerText.includes('blueprint')) {
    ocrLogger.info('ScreenType', 'Detected screen type: prime_parts');
    return 'prime_parts';
  }

  ocrLogger.warn('ScreenType', 'Could not determine screen type, defaulting to unknown', {
    textPreview: text.substring(0, 500)
  });
  return 'unknown';
};

// Known component types for Prime items
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

const normalizePrimeText = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\f/g, ' ')
    .replace(/[^A-Za-z0-9&'\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const PRIME_COMPONENT_PATTERN = PRIME_COMPONENT_TYPES
  .slice()
  .sort((a, b) => b.length - a.length)
  .map(value => value.replace(/\s+/g, '\\s+'))
  .join('|');

const PRIME_COMPONENT_LOWER_SORTED = PRIME_COMPONENT_TYPES
  .map(component => component.toLowerCase())
  .sort((a, b) => b.length - a.length);

const PRIME_COMPONENTS_THAT_CAN_HAVE_BLUEPRINT = new Set(['chassis', 'neuroptics', 'systems']);
const DEBUG_UPLOAD_PATH_PREFIX = '/debug/';
const PRIME_GRID_FALLBACK_MIN_ITEMS = 24;
const PRIME_GRID_FALLBACK_CONFIG = {
  headerHeight: 0.17,
  sidebarWidth: 0.23,
  bottomHeight: 0.08,
  leftPadding: 0.02,
  columns: 8,
  rows: 4,
  columnOverlap: 0.02,
  rowOverlap: 0.03
} as const;

const isDebugFixtureImage = (file: File): boolean => {
  const path = (file as File & { path?: string }).path;
  return typeof path === 'string' && path.startsWith(DEBUG_UPLOAD_PATH_PREFIX);
};

const getWhisperExtractedText = (result: WhisperResult): string =>
  result.extracted_text || result.text || result.result_text || '';

const getPrimeSetName = (value: string): string => {
  return normalizePrimeText(value).toLowerCase().replace(/\s+prime.*$/i, '').trim();
};

// Cache of set-only names from static prime set data (e.g., "octavia prime")
let validPrimeSetNamesCache: string[] | null = null;
let primeSetComponentsBySetCache: Map<string, Set<string>> | null = null;

const buildValidPrimeSetNames = (): string[] => {
  if (validPrimeSetNamesCache) return validPrimeSetNamesCache;

  const primeSets = getPrimeSetsCache() || [];
  const setNames = primeSets
    .map((set: any) => normalizePrimeText(set.name).toLowerCase())
    .filter((name: string) => name.endsWith(' prime'));

  validPrimeSetNamesCache = Array.from(new Set(setNames));
  return validPrimeSetNamesCache;
};

const buildPrimeSetComponentsBySet = (): Map<string, Set<string>> => {
  if (primeSetComponentsBySetCache) return primeSetComponentsBySetCache;

  const bySet = new Map<string, Set<string>>();
  const primeSets = getPrimeSetsCache() || [];

  primeSets.forEach((set: any) => {
    const normalizedSetName = normalizePrimeText(set.name).toLowerCase();
    const componentSet = new Set<string>();
    (set.components || []).forEach((component: any) => {
      const normalizedComponent = normalizePrimeText(component.name).toLowerCase();
      if (normalizedComponent) {
        componentSet.add(normalizedComponent);
      }
    });

    bySet.set(normalizedSetName, componentSet);
  });

  primeSetComponentsBySetCache = bySet;
  return bySet;
};

const shouldNormalizeToBlueprint = (setName: string, component: 'chassis' | 'neuroptics' | 'systems'): boolean => {
  if (component === 'chassis' || component === 'neuroptics') {
    return true;
  }

  const componentsBySet = buildPrimeSetComponentsBySet();
  const setComponents = componentsBySet.get(setName);
  if (!setComponents) {
    return false;
  }

  // Convert "Systems" to "Systems Blueprint" only for warframe-style sets.
  return setComponents.has('chassis') && setComponents.has('neuroptics');
};

const toDisplayCase = (value: string): string =>
  value.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

const stripTrailingPrimeComponentWords = (value: string): string => {
  let normalized = normalizePrimeText(value).toLowerCase();
  let changed = true;

  while (changed && normalized.length > 0) {
    changed = false;
    for (const component of PRIME_COMPONENT_LOWER_SORTED) {
      if (normalized === component) {
        normalized = '';
        changed = true;
        break;
      }
      if (normalized.endsWith(` ${component}`)) {
        normalized = normalized.slice(0, -(component.length + 1)).trim();
        changed = true;
        break;
      }
    }
  }

  return normalized;
};

const PRIME_COMPONENT_CELL_REGEX = new RegExp(`^(${PRIME_COMPONENT_PATTERN})(?:\\s+Blueprint)?$`, 'i');

const splitIntoOcrCells = (line: string): string[] => {
  return line
    .replace(/\f/g, ' ')
    .split(/\s{2,}/)
    .map(cell => normalizePrimeText(cell))
    .filter(Boolean);
};

const isStandaloneQuantityLine = (line: string): number | null => {
  const trimmed = line.replace(/\f/g, ' ').trim();
  const match = trimmed.match(/^(?:[x×])?\s*(\d{1,2})$/i);
  if (!match) return null;
  const quantity = parseInt(match[1], 10);
  if (!Number.isFinite(quantity) || quantity <= 1) return null;
  return quantity;
};

const isPrimeComponentCell = (cell: string): boolean => {
  const normalized = normalizePrimeText(cell);
  if (!normalized) return false;

  if (/^prime\s+blueprint$/i.test(normalized)) return true;
  if (/^blueprint$/i.test(normalized)) return true;
  if (/^prime\s+/i.test(normalized)) {
    const withoutPrime = normalized.replace(/^prime\s+/i, '').trim();
    return withoutPrime.length > 0;
  }

  return PRIME_COMPONENT_CELL_REGEX.test(normalized);
};

const isLikelyPrimeNameCell = (cell: string): boolean => {
  const normalized = normalizePrimeText(cell);
  if (!normalized) return false;
  if (isPrimeComponentCell(normalized)) return false;
  if (/^\d+$/.test(normalized)) return false;
  return /[A-Za-z]/.test(normalized);
};

const combinePrimeNameAndComponentCell = (nameCell: string, componentCell: string): string | null => {
  const normalizedName = normalizePrimeText(nameCell);
  const normalizedComponent = normalizePrimeText(componentCell);
  if (!normalizedName || !normalizedComponent) return null;

  const hasPrimeInName = /\bprime\b/i.test(normalizedName);

  if (/^prime\s+blueprint$/i.test(normalizedComponent)) {
    return hasPrimeInName
      ? `${normalizedName} Blueprint`
      : `${normalizedName} Prime Blueprint`;
  }

  if (/^blueprint$/i.test(normalizedComponent)) {
    return hasPrimeInName
      ? `${normalizedName} Blueprint`
      : `${normalizedName} Prime Blueprint`;
  }

  if (/^prime\s+/i.test(normalizedComponent)) {
    return hasPrimeInName
      ? `${normalizedName} ${normalizedComponent.replace(/^prime\s+/i, '').trim()}`
      : `${normalizedName} ${normalizedComponent}`;
  }

  if (PRIME_COMPONENT_CELL_REGEX.test(normalizedComponent)) {
    return hasPrimeInName
      ? `${normalizedName} ${normalizedComponent}`
      : `${normalizedName} Prime ${normalizedComponent}`;
  }

  return null;
};

const extractColumnPairedPrimeCandidates = (text: string): string[] => {
  const lines = text
    .split('\n')
    .map(line => line.replace(/\f/g, ' ').trim())
    .filter(Boolean);

  const candidates: string[] = [];

  for (let i = 0; i < lines.length - 1; i++) {
    const nameCells = splitIntoOcrCells(lines[i]);
    const componentCells = splitIntoOcrCells(lines[i + 1]);

    if (nameCells.length === 0 || componentCells.length === 0) continue;
    if (!nameCells.some(isLikelyPrimeNameCell)) continue;
    if (!componentCells.some(isPrimeComponentCell)) continue;

    const pairCount = Math.min(nameCells.length, componentCells.length);
    for (let j = 0; j < pairCount; j++) {
      const nameCell = nameCells[j];
      const componentCell = componentCells[j];
      if (!isLikelyPrimeNameCell(nameCell) || !isPrimeComponentCell(componentCell)) continue;

      const combined = combinePrimeNameAndComponentCell(nameCell, componentCell);
      if (combined) {
        candidates.push(combined);
      }
    }
  }

  return candidates;
};

const applyCompactQuantityBadges = (items: PrimePart[], text: string): PrimePart[] => {
  const isCompactSnippet = text.length <= 700 && items.length > 0 && items.length <= 10;
  if (!isCompactSnippet) return items;

  const quantityBadges = text
    .split('\n')
    .map(isStandaloneQuantityLine)
    .filter((qty): qty is number => qty !== null);

  if (quantityBadges.length === 0) return items;

  const adjustedItems = items.map(item => ({ ...item }));
  let itemCursor = 0;

  quantityBadges.forEach(quantity => {
    while (itemCursor < adjustedItems.length && (adjustedItems[itemCursor].quantity || 1) > 1) {
      itemCursor++;
    }
    if (itemCursor >= adjustedItems.length) return;

    adjustedItems[itemCursor].quantity = quantity;
    itemCursor++;
  });

  ocrLogger.debug('Parsing', 'Applied compact quantity badges', {
    quantityBadges,
    adjustedItems: adjustedItems.map(item => ({ name: item.name, quantity: item.quantity || 1 }))
  });

  return adjustedItems;
};

const shouldSkipPrimeGridFallback = (
  imageFile: File,
  extractedText: string,
  baselineItems: PrimePart[]
): boolean => {
  const isSmallImage = imageFile.size <= 400_000;
  const isCompactText = extractedText.length <= 1_200;
  const hasStandaloneQuantityBadge = extractedText
    .split('\n')
    .some(line => isStandaloneQuantityLine(line) !== null);

  return (
    isSmallImage &&
    isCompactText &&
    baselineItems.length > 0 &&
    (baselineItems.length <= 3 || hasStandaloneQuantityBadge)
  );
};

const extractPrimeItemsFromText = (text: string): PrimePart[] => {
  const foundItems: PrimePart[] = [];
  const seenItems = new Set<string>();
  const pendingSetQueue: string[] = [];
  const orphanComponents: Array<{ component: string; includeBlueprint: boolean }> = [];

  const addPrimeCandidate = (
    candidateRaw: string,
    threshold: number,
    source: string,
    expectedSetName?: string,
    componentHint?: string,
    includeBlueprint: boolean = false,
    strictComponentMatch: boolean = false
  ): string | null => {
    const candidate = normalizePrimeText(candidateRaw);
    if (!candidate) return null;

    let matchedName: string | null = null;
    if (expectedSetName && componentHint) {
      matchedName = findPrimeMatchForSetAndComponent(
        candidate,
        expectedSetName,
        componentHint,
        includeBlueprint
      );

      if (!matchedName && strictComponentMatch) {
        return null;
      }
    }

    const resolveCandidate = (value: string): string | null => {
      if (expectedSetName) {
        return findBestPrimeMatchForSet(value, expectedSetName, threshold);
      }
      return findBestPrimeMatch(value, threshold);
    };

    if (!matchedName) {
      matchedName = resolveCandidate(candidate);
    }

    if (!matchedName) {
      const needsBlueprintSuffix =
        !/\bBlueprint\b/i.test(candidate) &&
        PRIME_COMPONENTS_THAT_CAN_HAVE_BLUEPRINT.has(candidate.split(' ').pop()?.toLowerCase() || '');

      if (needsBlueprintSuffix) {
        matchedName = resolveCandidate(`${candidate} Blueprint`);
      }
    }

    if (!matchedName) return null;

    if (expectedSetName) {
      const matchedSet = getPrimeSetName(matchedName);
      const expectedSet = getPrimeSetName(expectedSetName);
      const sameSet = matchedSet === expectedSet || stringSimilarity(matchedSet, expectedSet) >= 0.82;
      if (!sameSet) {
        ocrLogger.debug('Parsing', `Rejected cross-set match for "${candidateRaw}" → "${matchedName}"`);
        return null;
      }
    }

    const key = matchedName.toLowerCase();
    if (seenItems.has(key)) return matchedName;

    seenItems.add(key);
    foundItems.push({
      id: `prime-${Date.now()}-${foundItems.length}`,
      name: matchedName,
      category: 'prime_parts',
      quantity: 1,
      status: 'loading'
    });

    ocrLogger.debug('Parsing', `Prime extraction [${source}] "${candidateRaw}" → "${matchedName}"`);
    return matchedName;
  };

  const lines = text
    .split('\n')
    .map(normalizePrimeText)
    .filter(line => line.length > 0);

  const columnPairedCandidates = extractColumnPairedPrimeCandidates(text);
  columnPairedCandidates.forEach(candidate => {
    addPrimeCandidate(candidate, 0.78, 'column-paired-cells');
  });

  lines.forEach(line => {
    if (isUINoiseText(line)) return;

    const setPrimeComponentRegex = new RegExp(
      `([A-Za-z][A-Za-z&'\\-]*(?:\\s+[A-Za-z][A-Za-z&'\\-]*)?)\\s+Prime\\s+(${PRIME_COMPONENT_PATTERN})(?:\\s+Blueprint)?`,
      'gi'
    );
    let match: RegExpExecArray | null;
    while ((match = setPrimeComponentRegex.exec(line)) !== null) {
      const component = match[2].replace(/\s+/g, ' ').trim();
      const includeBlueprint = /\bBlueprint\b/i.test(match[0]) && component.toLowerCase() !== 'blueprint';
      const candidate = `${match[1]} Prime ${component}${includeBlueprint ? ' Blueprint' : ''}`;
      const matched = addPrimeCandidate(
        candidate,
        0.8,
        'set-prime-component',
        `${match[1]} Prime`,
        component,
        includeBlueprint
      );
    }

    const setComponentPrimeRegex = new RegExp(
      `([A-Za-z][A-Za-z&'\\-]*(?:\\s+[A-Za-z][A-Za-z&'\\-]*)?)\\s+(${PRIME_COMPONENT_PATTERN})(?:\\s+Blueprint)?\\s+Prime`,
      'gi'
    );
    while ((match = setComponentPrimeRegex.exec(line)) !== null) {
      const component = match[2].replace(/\s+/g, ' ').trim();
      const includeBlueprint = /\bBlueprint\b/i.test(match[0]) && component.toLowerCase() !== 'blueprint';
      const candidate = `${match[1]} Prime ${component}${includeBlueprint ? ' Blueprint' : ''}`;
      const matched = addPrimeCandidate(
        candidate,
        0.8,
        'set-component-prime',
        `${match[1]} Prime`,
        component,
        includeBlueprint
      );
    }

    const componentSetPrimeRegex = new RegExp(
      `(${PRIME_COMPONENT_PATTERN})\\s+([A-Za-z][A-Za-z&'\\-]*(?:\\s+[A-Za-z][A-Za-z&'\\-]*)?)\\s+(?:Blueprint\\s+)?Prime`,
      'gi'
    );
    while ((match = componentSetPrimeRegex.exec(line)) !== null) {
      const component = match[1].replace(/\s+/g, ' ').trim();
      const includeBlueprint = /\bBlueprint\b/i.test(match[0]) && component.toLowerCase() !== 'blueprint';
      const candidate = `${match[2]} Prime ${component}${includeBlueprint ? ' Blueprint' : ''}`;
      const matched = addPrimeCandidate(
        candidate,
        0.8,
        'component-set-prime',
        `${match[2]} Prime`,
        component,
        includeBlueprint
      );
    }

    const setOnlyRegex = /([A-Za-z][A-Za-z&'\-]*(?:\s+[A-Za-z][A-Za-z&'\-]*)?)\s+Prime\b/gi;
    while ((match = setOnlyRegex.exec(line)) !== null) {
      const setNameWithoutComponent = stripTrailingPrimeComponentWords(match[1]);
      if (!setNameWithoutComponent) continue;
      const setCandidate = `${setNameWithoutComponent} Prime`;
      const matchedSet = findBestPrimeSetMatch(setCandidate, 0.85);
      if (!matchedSet) continue;
      pendingSetQueue.push(matchedSet);
    }

    const componentOnlyRegex = new RegExp(`\\b(${PRIME_COMPONENT_PATTERN})(?:\\s+Blueprint)?\\b`, 'gi');
    while ((match = componentOnlyRegex.exec(line)) !== null) {
      const component = match[1].replace(/\s+/g, ' ').trim();
      const includeBlueprint = /\bBlueprint\b/i.test(match[0]) && component.toLowerCase() !== 'blueprint';
      orphanComponents.push({ component, includeBlueprint });
    }
  });

  ocrLogger.debug('Parsing', 'Prime pending set queue', { pendingSetQueue });
  ocrLogger.debug('Parsing', 'Prime orphan components', { orphanComponents });

  let componentCursor = 0;
  pendingSetQueue.forEach(setName => {
    let matchedForSet = false;
    for (let i = componentCursor; i < orphanComponents.length; i++) {
      const { component, includeBlueprint } = orphanComponents[i];
      const candidate = `${setName} ${component}${includeBlueprint ? ' Blueprint' : ''}`;
      const matched = addPrimeCandidate(
        candidate,
        0.78,
        'pending-set-component',
        setName,
        component,
        includeBlueprint,
        true
      );

      if (matched) {
        componentCursor = i + 1;
        matchedForSet = true;
        break;
      }
    }

    if (!matchedForSet) {
      ocrLogger.debug('Parsing', `No component match found for pending set "${setName}"`, {
        componentCursor,
        remainingComponents: orphanComponents.slice(componentCursor, componentCursor + 5)
      });
    }
  });

  return foundItems;
};

const mergePrimeItemsByName = (...groups: PrimePart[][]): PrimePart[] => {
  const merged = new Map<string, PrimePart>();

  groups.flat().forEach(item => {
    const key = item.name.toLowerCase();
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...item, quantity: item.quantity ?? 1 });
      return;
    }

    merged.set(key, {
      ...existing,
      quantity: Math.max(existing.quantity ?? 1, item.quantity ?? 1)
    });
  });

  return Array.from(merged.values()).map((item, index) => ({
    ...item,
    id: `prime-${Date.now()}-${index}`
  }));
};

const normalizeBlueprintablePrimeItems = (items: PrimePart[]): PrimePart[] => {
  const validItems = buildValidPrimeItems();

  const normalized = items.map(item => {
    const normalizedName = normalizePrimeText(item.name);
    const componentMatch = normalizedName.match(/^(.+?\s+prime)\s+(chassis|neuroptics|systems)$/i);
    const isBlueprintCapableComponent = !!componentMatch;
    const alreadyBlueprint = /\bBlueprint$/i.test(normalizedName);
    if (!isBlueprintCapableComponent || alreadyBlueprint) {
      return item;
    }

    const normalizedSetName = componentMatch![1].toLowerCase();
    const component = componentMatch![2].toLowerCase() as 'chassis' | 'neuroptics' | 'systems';
    if (!shouldNormalizeToBlueprint(normalizedSetName, component)) {
      return item;
    }

    const blueprintCandidate = `${normalizedName} blueprint`.toLowerCase();
    if (!validItems.has(blueprintCandidate)) {
      return item;
    }

    return {
      ...item,
      name: toDisplayCase(blueprintCandidate)
    };
  });

  return mergePrimeItemsByName(normalized);
};

const clampPercent = (value: number): number => Math.max(0, Math.min(1, value));

const cropImageRegion = async (
  imageFile: File,
  xPercent: number,
  yPercent: number,
  widthPercent: number,
  heightPercent: number
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context for grid crop.'));
          return;
        }

        const safeX = clampPercent(xPercent);
        const safeY = clampPercent(yPercent);
        const safeWidth = clampPercent(widthPercent);
        const safeHeight = clampPercent(heightPercent);

        const x = Math.floor(img.width * safeX);
        const y = Math.floor(img.height * safeY);
        const width = Math.max(1, Math.floor(img.width * safeWidth));
        const height = Math.max(1, Math.floor(img.height * safeHeight));

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, x, y, width, height, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob from grid crop.'));
            return;
          }

          const gridSlice = new File([blob], `grid-${Date.now()}-${x}-${y}.png`, {
            type: 'image/png',
            lastModified: Date.now()
          });
          resolve(gridSlice);
        }, 'image/png');
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Unknown error while cropping image.'));
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for grid crop.'));
    };

    img.src = objectUrl;
  });
};

const extractPrimeTextsFromGridSlices = async (
  imageFile: File,
  orientation: 'columns' | 'rows'
): Promise<string[]> => {
  const gridX = PRIME_GRID_FALLBACK_CONFIG.leftPadding;
  const gridY = PRIME_GRID_FALLBACK_CONFIG.headerHeight;
  const gridWidth = 1 - PRIME_GRID_FALLBACK_CONFIG.leftPadding - PRIME_GRID_FALLBACK_CONFIG.sidebarWidth;
  const gridHeight = 1 - PRIME_GRID_FALLBACK_CONFIG.headerHeight - PRIME_GRID_FALLBACK_CONFIG.bottomHeight;

  const slices = orientation === 'columns'
    ? PRIME_GRID_FALLBACK_CONFIG.columns
    : PRIME_GRID_FALLBACK_CONFIG.rows;
  const baseSliceSize = orientation === 'columns'
    ? gridWidth / PRIME_GRID_FALLBACK_CONFIG.columns
    : gridHeight / PRIME_GRID_FALLBACK_CONFIG.rows;
  const overlap = orientation === 'columns'
    ? PRIME_GRID_FALLBACK_CONFIG.columnOverlap
    : PRIME_GRID_FALLBACK_CONFIG.rowOverlap;

  const texts: string[] = [];
  ocrLogger.info('GridFallback', `Running ${orientation} fallback slices`, { slices });

  for (let index = 0; index < slices; index++) {
    const offset = baseSliceSize * index;
    const sliceStart = Math.max(0, offset - overlap / 2);
    const sliceSize = baseSliceSize + overlap;

    const x = orientation === 'columns' ? gridX + sliceStart : gridX;
    const y = orientation === 'columns' ? gridY : gridY + sliceStart;
    const width = orientation === 'columns' ? sliceSize : gridWidth;
    const height = orientation === 'columns' ? gridHeight : sliceSize;

    const clippedX = clampPercent(x);
    const clippedY = clampPercent(y);
    const clippedWidth = Math.min(clampPercent(width), 1 - clippedX);
    const clippedHeight = Math.min(clampPercent(height), 1 - clippedY);

    try {
      const sliceFile = await cropImageRegion(
        imageFile,
        clippedX,
        clippedY,
        clippedWidth,
        clippedHeight
      );
      const whisperResult = await extractTextWithLLMWhisperer(sliceFile, {
        logRawResponse: false,
        label: `prime-grid-${orientation}-${index + 1}`
      });
      const sliceText = getWhisperExtractedText(whisperResult).trim();
      if (sliceText) {
        texts.push(sliceText);
      }
    } catch (error) {
      ocrLogger.warn('GridFallback', `Failed ${orientation} slice ${index + 1}`, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return texts;
};

const runPrimeGridFallback = async (imageFile: File, baselineItems: PrimePart[]): Promise<PrimePart[]> => {
  try {
    const columnTexts = await extractPrimeTextsFromGridSlices(imageFile, 'columns');
    const columnItems = normalizeBlueprintablePrimeItems(mergePrimeItemsByName(
      ...columnTexts.map(sliceText => extractPrimeItemsFromText(sliceText))
    ));
    let mergedItems = normalizeBlueprintablePrimeItems(mergePrimeItemsByName(baselineItems, columnItems));

    ocrLogger.info('GridFallback', 'Column fallback result', {
      baseline: baselineItems.length,
      columnItems: columnItems.length,
      merged: mergedItems.length
    });

    if (mergedItems.length >= PRIME_GRID_FALLBACK_MIN_ITEMS) {
      return mergedItems;
    }

    const rowTexts = await extractPrimeTextsFromGridSlices(imageFile, 'rows');
    const rowItems = normalizeBlueprintablePrimeItems(mergePrimeItemsByName(
      ...rowTexts.map(sliceText => extractPrimeItemsFromText(sliceText))
    ));
    mergedItems = normalizeBlueprintablePrimeItems(mergePrimeItemsByName(mergedItems, rowItems));

    ocrLogger.info('GridFallback', 'Row fallback result', {
      baseline: baselineItems.length,
      rowItems: rowItems.length,
      merged: mergedItems.length
    });

    return mergedItems;
  } catch (error) {
    ocrLogger.warn('GridFallback', 'Prime grid fallback failed, keeping baseline results', {
      error: error instanceof Error ? error.message : String(error)
    });
    return baselineItems;
  }
};

// Helper to parse quantity from a line
const parseQuantity = (line: string): { quantity: number, cleanLine: string } => {
  let quantity = 1;
  let cleanLine = line.trim();

  // 1. Try "5 x Item" or "5 × Item" or "5X Item"
  let match = cleanLine.match(/^(\d+)\s*[x×]\s+(.+)$/i);
  if (match) {
    quantity = parseInt(match[1]);
    cleanLine = match[2].trim();
    return { quantity, cleanLine };
  }

  // 2. Try "Item x5" or "Item ×5" (explicitly with x/×)
  match = cleanLine.match(/^(.+?)\s+[x×](\d+)$/i);
  if (match) {
    cleanLine = match[1].trim();
    quantity = parseInt(match[2]);
    return { quantity, cleanLine };
  }

  // 3. Try "x5 Item" or "×5 Item" (no space)
  match = cleanLine.match(/^[x×](\d+)\s*(.+)$/i);
  if (match) {
    quantity = parseInt(match[1]);
    cleanLine = match[2].trim();
    return { quantity, cleanLine };
  }

  // 4. Try "Itemx5" or "Item×5" (no space)
  match = cleanLine.match(/^(.+?)[x×](\d+)$/i);
  if (match) {
    cleanLine = match[1].trim();
    quantity = parseInt(match[2]);
    return { quantity, cleanLine };
  }

  // 5. Check if the line is JUST a quantity (e.g., "x5" or "5")
  const isPureQuantity = /^([x×])?(\d+)$/i.test(cleanLine);
  if (isPureQuantity) {
    const qtyMatch = cleanLine.match(/^([x×])?(\d+)$/i);
    if (qtyMatch) {
      return { quantity: parseInt(qtyMatch[2]), cleanLine: '' };
    }
  }

  // 6. Explicitly handle the common "Item 5" case only if it's NOT a relic name pattern
  // Relic pattern example: "Lith A1" -> should NOT be Lith A quantity 1
  const isRelicPattern = /\b(Lith|Meso|Neo|Axi)\s+[A-Z]\d+$/i.test(cleanLine);
  if (!isRelicPattern) {
    match = cleanLine.match(/^(.+?)\s+(\d+)$/i);
    if (match) {
      const potentialName = match[1].trim();
      const potentialQty = parseInt(match[2]);
      // Only treat as quantity if it's a small number or if there's a large gap
      if (potentialQty < 100) {
        cleanLine = potentialName;
        quantity = potentialQty;
      }
    }
  }

  return { quantity, cleanLine };
};

// Cache for valid prime item names (built from primesets.json)
let validPrimeItemsCache: Set<string> | null = null;
let validPrimeItemsBySetCache: Map<string, string[]> | null = null;

// Build list of valid prime item names for validation
const buildValidPrimeItems = (): Set<string> => {
  if (validPrimeItemsCache) return validPrimeItemsCache;

  const primeSets = getPrimeSetsCache();
  const validItems = new Set<string>();

  if (primeSets && primeSets.length > 0) {
    primeSets.forEach((set: any) => {
      const setName = set.name; // e.g., "Acceltra Prime"
      validItems.add(setName.toLowerCase());

      // Add all component variations
      if (set.components) {
        set.components.forEach((comp: any) => {
          const compName = comp.name; // e.g., "Barrel", "Blueprint"
          // Full item name: "Acceltra Prime Barrel"
          validItems.add(`${setName} ${compName}`.toLowerCase());
          // With Blueprint suffix for warframe parts
          if (['Chassis', 'Neuroptics', 'Systems'].includes(compName)) {
            validItems.add(`${setName} ${compName} Blueprint`.toLowerCase());
          }
        });
      }
    });
  }

  validPrimeItemsCache = validItems;
  validPrimeItemsBySetCache = null; // Rebuild lazily when needed
  ocrLogger.debug('Validation', `Built valid prime items cache with ${validItems.size} items`);
  return validItems;
};

const buildValidPrimeItemsBySet = (): Map<string, string[]> => {
  if (validPrimeItemsBySetCache) return validPrimeItemsBySetCache;

  const bySet = new Map<string, string[]>();
  const validItems = buildValidPrimeItems();

  validItems.forEach((itemName) => {
    const setName = getPrimeSetName(itemName);
    if (!setName) return;

    const existing = bySet.get(setName) || [];
    existing.push(itemName);
    bySet.set(setName, existing);
  });

  validPrimeItemsBySetCache = bySet;
  return bySet;
};

// Simple string similarity (Levenshtein-based)
const stringSimilarity = (s1: string, s2: string): number => {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

const levenshteinDistance = (s1: string, s2: string): number => {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
};

// Find best matching valid prime item
// Higher threshold (0.85) to prevent false positives like "Gedo" → "Bronco"
const findBestPrimeMatch = (ocrText: string, threshold: number = 0.85): string | null => {
  const validItems = buildValidPrimeItems();
  const normalizedOcr = normalizePrimeText(ocrText).toLowerCase().trim();

  // Direct match first
  if (validItems.has(normalizedOcr)) {
    return toDisplayCase(normalizedOcr);
  }

  // Try to find fuzzy match
  let bestMatch: string | null = null;
  let bestScore = 0;

  validItems.forEach(validItem => {
    const score = stringSimilarity(normalizedOcr, validItem);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = toDisplayCase(validItem);
    }
  });

  if (bestMatch) {
    ocrLogger.debug('Validation', `Fuzzy matched "${ocrText}" → "${bestMatch}" (score: ${bestScore.toFixed(2)})`);
  }

  return bestMatch;
};

const findBestPrimeSetMatch = (ocrText: string, threshold: number = 0.84): string | null => {
  const validSetNames = buildValidPrimeSetNames();
  const normalizedOcr = normalizePrimeText(ocrText).toLowerCase().trim();
  if (!normalizedOcr) return null;

  if (validSetNames.includes(normalizedOcr)) {
    return toDisplayCase(normalizedOcr);
  }

  let bestMatch: string | null = null;
  let bestScore = 0;

  validSetNames.forEach(validSetName => {
    const score = stringSimilarity(normalizedOcr, validSetName);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = toDisplayCase(validSetName);
    }
  });

  if (bestMatch) {
    ocrLogger.debug('Validation', `Fuzzy set matched "${ocrText}" → "${bestMatch}" (score: ${bestScore.toFixed(2)})`);
  }

  return bestMatch;
};

const findBestPrimeMatchForSet = (
  ocrText: string,
  expectedSetName: string,
  threshold: number = 0.8
): string | null => {
  const itemsBySet = buildValidPrimeItemsBySet();
  const normalizedOcr = normalizePrimeText(ocrText).toLowerCase().trim();
  const expectedSet = getPrimeSetName(expectedSetName);

  if (!expectedSet || !normalizedOcr) return null;

  let candidateSetNames: string[] = [];

  itemsBySet.forEach((_items, setName) => {
    const score = setName === expectedSet ? 1 : stringSimilarity(setName, expectedSet);
    if (score >= 0.8) {
      candidateSetNames.push(setName);
    }
  });

  if (candidateSetNames.length === 0) {
    return null;
  }

  let bestMatch: string | null = null;
  let bestScore = 0;

  candidateSetNames.forEach(setName => {
    const setItems = itemsBySet.get(setName) || [];
    setItems.forEach(validItem => {
      const score = stringSimilarity(normalizedOcr, validItem);
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestMatch = toDisplayCase(validItem);
      }
    });
  });

  if (bestMatch) {
    ocrLogger.debug('Validation', `Set-scoped match "${ocrText}" (${expectedSetName}) → "${bestMatch}" (score: ${bestScore.toFixed(2)})`);
  }

  return bestMatch;
};

const findPrimeMatchForSetAndComponent = (
  ocrText: string,
  expectedSetName: string,
  componentHint: string,
  includeBlueprint: boolean,
  threshold: number = 0.74
): string | null => {
  const normalizedComponent = normalizePrimeText(componentHint).toLowerCase();
  if (!normalizedComponent || normalizedComponent === 'blueprint') {
    return null;
  }

  const itemsBySet = buildValidPrimeItemsBySet();
  const expectedSet = getPrimeSetName(expectedSetName);
  if (!expectedSet) return null;

  const candidateSetNames: string[] = [];
  itemsBySet.forEach((_items, setName) => {
    const score = setName === expectedSet ? 1 : stringSimilarity(setName, expectedSet);
    if (score >= 0.8) {
      candidateSetNames.push(setName);
    }
  });

  if (candidateSetNames.length === 0) return null;

  const componentVariants = new Set<string>([normalizedComponent]);
  if (includeBlueprint) {
    componentVariants.add(`${normalizedComponent} blueprint`);
  }
  if (PRIME_COMPONENTS_THAT_CAN_HAVE_BLUEPRINT.has(normalizedComponent)) {
    componentVariants.add(`${normalizedComponent} blueprint`);
  }

  const normalizedOcr = normalizePrimeText(ocrText).toLowerCase().trim();
  let bestMatch: string | null = null;
  let bestScore = 0;

  candidateSetNames.forEach(setName => {
    const setItems = itemsBySet.get(setName) || [];
    setItems.forEach(item => {
      const componentPart = item.replace(/^.+\sprime\s+/i, '').trim();
      const hasExpectedComponent = componentVariants.has(componentPart);

      if (!hasExpectedComponent) return;

      const score = stringSimilarity(normalizedOcr, item);
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestMatch = toDisplayCase(item);
      }
    });
  });

  if (bestMatch) {
    ocrLogger.debug('Validation', `Set+component match "${ocrText}" (${expectedSetName}, ${componentHint}) → "${bestMatch}" (score: ${bestScore.toFixed(2)})`);
  }

  return bestMatch;
};

const IMAGE_CACHE_KEY = 'platscanner_image_cache';
const CACHE_EXPIRY_HOURS = 24; // Cache results for 24 hours

// Cache structure for storing analysis results
interface ImageCacheEntry {
  hash: string;
  timestamp: number;
  screenType: 'prime_parts' | 'relics' | 'syndicate' | 'mods' | 'unknown';
  detectedItems: DetectedItem[];
}

// Generate a simple hash from image data for caching
export const generateImageHash = async (imageBase64: string): Promise<string> => {
  try {
    ocrLogger.debug('Hash', 'Generating image hash');
    const sample = imageBase64.substring(0, 1000);
    const encoder = new TextEncoder();
    const data = encoder.encode(sample);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    ocrLogger.debug('Hash', `Generated hash: ${hash}`);
    return hash;
  } catch (error) {
    ocrLogger.error('Hash', 'Failed to generate image hash', { error });
    throw error;
  }
};

// Get cached analysis result
const getCachedAnalysis = (imageHash: string): DetectedItem[] | null => {
  try {
    const cacheData = localStorage.getItem(IMAGE_CACHE_KEY);
    if (!cacheData) return null;

    const cache: ImageCacheEntry[] = JSON.parse(cacheData);
    const now = Date.now();
    const expiryTime = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;

    const entry = cache.find(e =>
      e.hash === imageHash &&
      (now - e.timestamp) < expiryTime
    );

    if (entry) {
      console.log(`>>> [OCR Cache] Found cached result for image hash ${imageHash} <<<`);
      return entry.detectedItems;
    }

    return null;
  } catch (error) {
    console.error('Failed to read image cache:', error);
    return null;
  }
};

/**
 * Clear cached result for a specific image hash (for retry functionality)
 */
export const clearCachedAnalysis = (imageHash: string): void => {
  try {
    const stored = localStorage.getItem(IMAGE_CACHE_KEY);
    if (!stored) return;

    const cache = JSON.parse(stored);
    const filteredCache = cache.filter((entry: any) => entry.hash !== imageHash);

    localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(filteredCache));
    console.log(`>>> [OCR Cache] Cleared cached result for image hash ${imageHash} <<<`);
  } catch (error) {
    console.error('Failed to clear image cache:', error);
  }
};

// Store analysis result in cache
const setCachedAnalysis = (imageHash: string, screenType: string, detectedItems: DetectedItem[]): void => {
  try {
    const cacheData = localStorage.getItem(IMAGE_CACHE_KEY);
    let cache: ImageCacheEntry[] = cacheData ? JSON.parse(cacheData) : [];

    const now = Date.now();
    const expiryTime = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
    cache = cache.filter(e => (now - e.timestamp) < expiryTime);

    const newEntry: ImageCacheEntry = {
      hash: imageHash,
      timestamp: now,
      screenType: screenType as any,
      detectedItems
    };

    cache.push(newEntry);

    if (cache.length > 50) {
      cache = cache.slice(-50);
    }

    localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(cache));
    console.log(`>>> [OCR Cache] Stored result for image hash ${imageHash} <<<`);
  } catch (error) {
    console.error('Failed to store image cache:', error);
  }
};

// Filter out items that are already in inventory to avoid duplicates
const filterNewItems = (detectedItems: DetectedItem[]): DetectedItem[] => {
  const inventory = getCategorizedInventory();
  const existingItems = new Set();

  inventory.prime_parts.forEach(item => existingItems.add(`${item.category}:${item.name}`));
  inventory.relics.forEach(item => existingItems.add(`${item.category}:${item.name}`));
  inventory.syndicate_rewards.forEach(item => existingItems.add(`${item.category}:${item.name}`));
  inventory.mods.forEach(item => {
    const r = (item as any).rank ?? 0;
    const d = (item as any).drain ?? '';
    existingItems.add(`${item.category}:${item.name}:r${r}:d${d}`);
  });

  const newItems = detectedItems.filter(item => {
    let itemKey = `${item.category}:${item.name}`;
    if (item.category === 'mods') {
      const m = item as any;
      const r = m.rank ?? 0;
      const d = m.drain ?? '';
      itemKey = `${item.category}:${item.name}:r${r}:d${d}`;
    }
    return !existingItems.has(itemKey);
  });

  if (newItems.length < detectedItems.length) {
    console.log(`>>> [OCR Filter] Filtered ${detectedItems.length - newItems.length} duplicate items, ${newItems.length} are new <<<`);
  }

  return newItems;
};

// Clear image cache (useful if user wants to force re-analysis)
export const clearImageCache = (): void => {
  try {
    localStorage.removeItem(IMAGE_CACHE_KEY);
    console.log('>>> [OCR Cache] Cleared image cache <<<');
  } catch (error) {
    console.error('Failed to clear image cache:', error);
  }
};

export const getCacheStats = (): { entries: number; oldestEntry?: Date; newestEntry?: Date } => {
  try {
    const cacheData = localStorage.getItem(IMAGE_CACHE_KEY);
    if (!cacheData) return { entries: 0 };

    const cache: ImageCacheEntry[] = JSON.parse(cacheData);
    if (cache.length === 0) return { entries: 0 };

    const timestamps = cache.map(e => e.timestamp).sort();
    return {
      entries: cache.length,
      oldestEntry: new Date(timestamps[0]),
      newestEntry: new Date(timestamps[timestamps.length - 1])
    };
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return { entries: 0 };
  }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    ocrLogger.debug('FileConversion', `Converting file to base64: ${file.name}`);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      try {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        ocrLogger.debug('FileConversion', `File converted successfully, base64 length: ${base64.length}`);
        resolve(base64);
      } catch (error) {
        ocrLogger.error('FileConversion', 'Failed to extract base64 from data URL', { error });
        reject(error);
      }
    };
    reader.onerror = (error) => {
      ocrLogger.error('FileConversion', 'FileReader error', { error: error.toString() });
      reject(error);
    };
  });
};

// Parse detected items from OCR text
const parseDetectedItems = (text: string, screenType?: string, whisperResult?: WhisperResult): DetectedItem[] => {
  ocrLogger.debug('Parsing', 'Starting item parsing', {
    screenType,
    textLength: text.length,
    textPreview: text.substring(0, 300)
  });

  if (screenType === 'prime_parts') {
    const primeItems = extractPrimeItemsFromText(text);
    if (primeItems.length > 0) {
      const normalizedPrimeItems = normalizeBlueprintablePrimeItems(primeItems);
      const quantityAwareItems = applyCompactQuantityBadges(normalizedPrimeItems, text);
      ocrLogger.info('Parsing', `Prime extraction found ${primeItems.length} items`, {
        normalizedItems: quantityAwareItems.length,
        itemNames: quantityAwareItems.map(item => `${item.name} x${item.quantity || 1}`)
      });
      return quantityAwareItems;
    }

    ocrLogger.warn('Parsing', 'Prime extraction returned 0 items, falling back to line parser');
  }

  const detectedItems: DetectedItem[] = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  ocrLogger.debug('Parsing', `Split text into ${lines.length} lines`);

  // State machine for sequential badge/item pairing
  const pendingBadges: number[] = [];
  let detectedSyndicate = 'Unknown';

  lines.forEach((line, index) => {
    // Skip UI noise
    if (isUINoiseText(line)) {
      ocrLogger.debug('Parsing', `Skipping noise: "${line}"`);
      return;
    }

    // Check for syndicate name
    if (line.includes('Arbiters of Hexis') || line.includes('Cephalon Suda') ||
      line.includes('Steel Meridian') || line.includes('New Loka') ||
      line.includes('Red Veil') || line.includes('Perrin Sequence') ||
      line.includes('Arbitration Honors') || line.match(/^SYNDICATE:\s*(.+)$/i)) {

      const match = line.match(/^SYNDICATE:\s*(.+)$/i);
      detectedSyndicate = match ? match[1].trim() : line.trim();
      console.log(`>>> [OCR Parsing] Detected syndicate: "${detectedSyndicate}" <<<`);
      return;
    }

    // Parse quantity
    const { quantity, cleanLine } = parseQuantity(line);

    // 1. If the line is JUST a badge (no text left), add it to pending
    if (cleanLine === '' || cleanLine === 'x' || cleanLine === '×') {
      if (quantity > 1) {
        pendingBadges.push(quantity);
        console.log(`>>> [OCR Parsing] Found standalone badge: x${quantity} <<<`);
      } else {
        // Known unowned glyph artifact?
        if (line.match(/^[\(\[]?[Oo0ØVv@©®\-\s][\)\]]?$/) || line === '()' || line === '[]') {
          console.log(`>>> [OCR Parsing] Found unowned marker glyph: "${line}" <<<`);
          pendingBadges.push(0);
        }
      }
      return;
    }

    // 2. Extract item details
    let matchedName: string | null = null;
    let itemCategory: DetectedItem['category'] = 'relics'; // Default, will change
    let extraData: any = {};

    // Relic Check
    if (cleanLine.includes('Relic') || /\b(Lith|Meso|Neo|Axi)\s+[A-Z]\d+/i.test(cleanLine)) {
      itemCategory = 'relics';
      let relicName = cleanLine;
      let rarity: VoidRelic['rarity'] = 'intact';

      const rarityMatch = cleanLine.match(/[\(\[](Intact|Exceptional|Flawless|Radiant)[\)\]]/i) ||
        cleanLine.match(/\b(Intact|Exceptional|Flawless|Radiant)\b/i);

      if (rarityMatch) {
        rarity = rarityMatch[1].toLowerCase() as VoidRelic['rarity'];
        relicName = cleanLine.replace(/[\(\[](Intact|Exceptional|Flawless|Radiant)[\)\]]/gi, '')
          .replace(/\b(Intact|Exceptional|Flawless|Radiant)\b/gi, '')
          .trim()
          .replace(/\s+/g, ' ');
      }

      if (!relicName.toLowerCase().includes('relic')) relicName += ' Relic';
      matchedName = relicName;
      extraData = { rarity };
    }
    // Prime Check
    else if (cleanLine.match(/([A-Z][a-zA-Z&\s]*?)\s*Prime\s+([A-Za-z]+(?:\s+Blueprint)?)/i) || cleanLine.includes('Prime')) {
      const match = cleanLine.match(/([A-Z][a-zA-Z&\s]*?)\s*Prime\s+([A-Za-z]+(?:\s+Blueprint)?)/i);
      const fullName = match ? `${match[1].trim()} Prime ${match[2].trim()}` : cleanLine;
      const matched = findBestPrimeMatch(fullName, 0.7);
      if (matched) {
        matchedName = matched;
        itemCategory = 'prime_parts';
      }
    }
    // Mod Check
    else if (screenType === 'mods') {
      const rarity = determineModRarity(cleanLine);
      const isKnown = rarity !== 'uncommon';
      const looksLikeName = cleanLine.length > 5 && !/^\d+$/.test(cleanLine) && !cleanLine.includes('|');

      if (isKnown || looksLikeName) {
        itemCategory = 'mods';

        // Mod parsing using internal regex for Rank/Drain
        const pipeMatch = cleanLine.match(/^(.+?)\s*\|\s*(\d+)\s*\|\s*(\d+)/);
        const rankMatch = cleanLine.match(/^(.+?)\s+(?:Rank|r)\s*(\d+)\/\d+\s*(?:\(Drain\s*(\d+)\))?/i);
        const standaloneDrainMatch = cleanLine.match(/^(.+?)\s+(\d+)$/);

        if (pipeMatch) {
          matchedName = pipeMatch[1].trim();
          extraData = { rank: parseInt(pipeMatch[2]), drain: parseInt(pipeMatch[3]) };
        } else if (rankMatch) {
          matchedName = rankMatch[1].trim();
          extraData = {
            rank: parseInt(rankMatch[2]),
            drain: rankMatch[3] ? parseInt(rankMatch[3]) : undefined
          };
        } else if (standaloneDrainMatch) {
          matchedName = standaloneDrainMatch[1].trim();
          const potentialDrain = parseInt(standaloneDrainMatch[2]);
          if (potentialDrain > 1 && potentialDrain < 20) {
            extraData = { drain: potentialDrain };
          }
        } else {
          matchedName = cleanLine;
        }

        matchedName = matchedName!.replace(/[.·*•-]$/, '').trim();
      }
    }

    if (matchedName) {
      // APPLY ADJACENCY INFERENCE
      let finalQuantity = quantity;

      // If we have pending badges, consume one
      if (pendingBadges.length > 0) {
        finalQuantity = pendingBadges.shift()!;
        console.log(`>>> [OCR Parsing] Pairing ${matchedName} with pending badge: x${finalQuantity} <<<`);
      }

      // Skip unowned items
      if (finalQuantity === 0) {
        ocrLogger.info('Parsing', `Skipping unowned item: ${matchedName}`);
        return;
      }

      const item: DetectedItem = {
        id: `${itemCategory}-${Date.now()}-${index}`,
        name: matchedName,
        category: itemCategory,
        quantity: finalQuantity,
        status: 'loading',
        ...extraData
      };

      detectedItems.push(item);
    }
  });

  ocrLogger.info('Parsing', `Parsed ${detectedItems.length} items from ${lines.length} lines`);
  return detectedItems;
};

// Main analysis function
export const analyzeImage = async (
  imageFile: File,
  forceRetry: boolean = false
): Promise<{ items: DetectedItem[]; screenType: string; wasCached: boolean }> => {
  const analysisStartTime = Date.now();
  const isDebugImage = isDebugFixtureImage(imageFile);
  const bypassCache = forceRetry || isDebugImage;
  ocrLogger.info('Analysis', `Starting image analysis`, {
    fileName: imageFile.name,
    fileSize: imageFile.size,
    fileType: imageFile.type,
    forceRetry,
    isDebugImage,
    bypassCache
  });

  try {
    const imageBase64 = await fileToBase64(imageFile);
    const imageHash = await generateImageHash(imageBase64);

    // Check cache
    if (!bypassCache) {
      const cachedResult = getCachedAnalysis(imageHash);
      if (cachedResult) {
        const items = filterNewItems(cachedResult);
        if (items.length > 0) {
          return { items, screenType: 'unknown', wasCached: true };
        }
      }
    } else {
      clearCachedAnalysis(imageHash);
      if (isDebugImage) {
        ocrLogger.info('Cache', 'Bypassing cache for debug upload image', {
          fileName: imageFile.name,
          imageHash
        });
      }
    }

    if (!isLLMWhispererConfigured()) {
      throw new Error('LLMWhisperer API key not configured.');
    }

    const whisperResult = await extractTextWithLLMWhisperer(imageFile);
    const extractedText = getWhisperExtractedText(whisperResult);

    ocrLogger.info('Analysis', 'OCR response fields', {
      hasExtractedText: !!whisperResult.extracted_text,
      extractedTextLength: whisperResult.extracted_text?.length || 0,
      hasText: !!whisperResult.text,
      textLength: whisperResult.text?.length || 0,
      hasResultText: !!whisperResult.result_text,
      resultTextLength: whisperResult.result_text?.length || 0
    });

    if (!extractedText.trim()) {
      ocrLogger.error('Analysis', 'OCR text missing in response', {
        topLevelKeys: Object.keys(whisperResult || {}),
        metadataKeys: whisperResult?.metadata ? Object.keys(whisperResult.metadata) : []
      });
      throw new Error('OCR extracted no text.');
    }

    const screenType = determineScreenType(extractedText);
    let detectedItems = parseDetectedItems(extractedText, screenType, whisperResult);

    if (screenType === 'prime_parts') {
      const baselinePrimeItems = detectedItems.filter((item): item is PrimePart => item.category === 'prime_parts');
      const skipGridFallback = shouldSkipPrimeGridFallback(imageFile, extractedText, baselinePrimeItems);
      if (skipGridFallback) {
        ocrLogger.info('Analysis', 'Skipping grid fallback for compact prime snippet', {
          baselineItems: baselinePrimeItems.length,
          imageSize: imageFile.size,
          textLength: extractedText.length
        });
      } else if (baselinePrimeItems.length < PRIME_GRID_FALLBACK_MIN_ITEMS) {
        ocrLogger.info('Analysis', 'Running grid fallback for prime parts', {
          baselineItems: baselinePrimeItems.length,
          threshold: PRIME_GRID_FALLBACK_MIN_ITEMS
        });

        const mergedPrimeItems = await runPrimeGridFallback(imageFile, baselinePrimeItems);
        if (mergedPrimeItems.length > baselinePrimeItems.length) {
          ocrLogger.info('Analysis', 'Grid fallback improved prime part detection', {
            before: baselinePrimeItems.length,
            after: mergedPrimeItems.length
          });
          detectedItems = mergedPrimeItems;
        } else {
          ocrLogger.info('Analysis', 'Grid fallback did not improve prime part detection', {
            baseline: baselinePrimeItems.length,
            merged: mergedPrimeItems.length
          });
        }
      }
    }

    if (!isDebugImage) {
      setCachedAnalysis(imageHash, screenType, detectedItems);
    } else {
      ocrLogger.info('Cache', 'Skipped storing OCR cache for debug upload image', {
        fileName: imageFile.name,
        imageHash
      });
    }
    const newItems = filterNewItems(detectedItems);

    const duration = Date.now() - analysisStartTime;
    ocrLogger.info('Analysis', `Completed in ${duration}ms`, { totalItems: detectedItems.length, newItems: newItems.length });

    return { items: newItems, screenType, wasCached: false };
  } catch (error) {
    const duration = Date.now() - analysisStartTime;
    ocrLogger.error('Analysis', 'Failed', { error: error instanceof Error ? error.message : String(error), duration });
    throw error;
  }
};

export const isOcrConfigured = (): boolean => {
  return isLLMWhispererConfigured();
};

export const setOcrApiKey = (apiKey: string): boolean => {
  try {
    setLLMWhispererApiKey(apiKey);
    return true;
  } catch (error) {
    console.error('Failed to store OCR API key:', error);
    return false;
  }
};

export const getOcrApiKey = (): string | null => {
  try {
    return localStorage.getItem('platscanner_llmwhisperer_api_key');
  } catch (error) {
    console.error('Failed to retrieve OCR API key:', error);
    return null;
  }
};

export { isLLMWhispererConfigured, setLLMWhispererApiKey } from './llmWhispererService';

// Helper functions are already defined above, no need to re-export
