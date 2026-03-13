import { PrimePart } from '../../types';
import { ocrLogger } from '../ocrLogger';
import { getPrimeSetsCache } from '../staticDataService';
import { isUINoiseText } from './stepScreenType';

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

const sanitizePrimeTextPreserveSpacing = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\f/g, ' ')
    .replace(/[^A-Za-z0-9&'\-\s]/g, ' ');
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

type OcrCell = {
  text: string;
  start: number;
  end: number;
  center: number;
};

type PrimeColumnCandidate = {
  candidate: string;
  lineIndex: number;
  cellIndex: number;
  xCenter: number;
};

type PrimeItemAnchor = {
  itemName: string;
  lineIndex: number;
  cellIndex: number;
  xCenter: number;
};

type PrimeExtractionResult = {
  items: PrimePart[];
  anchors: PrimeItemAnchor[];
};

type QuantityBadge = {
  quantity: number;
  lineIndex: number;
  cellIndex: number;
  xCenter: number;
};

const splitIntoOcrCellsWithBounds = (line: string): OcrCell[] => {
  const normalizedLine = line.replace(/\f/g, ' ');
  const cells: OcrCell[] = [];
  let cursor = 0;

  while (cursor < normalizedLine.length) {
    while (cursor < normalizedLine.length && normalizedLine[cursor] === ' ') {
      cursor++;
    }
    if (cursor >= normalizedLine.length) break;

    const start = cursor;
    while (cursor < normalizedLine.length) {
      if (normalizedLine[cursor] !== ' ') {
        cursor++;
        continue;
      }

      let gapCursor = cursor;
      while (gapCursor < normalizedLine.length && normalizedLine[gapCursor] === ' ') {
        gapCursor++;
      }

      if (gapCursor - cursor >= 2) {
        break;
      }

      cursor = gapCursor;
    }

    const end = cursor;
    const text = normalizePrimeText(normalizedLine.slice(start, end));
    if (text) {
      cells.push({
        text,
        start,
        end,
        center: start + (end - start) / 2
      });
    }
  }

  return cells;
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

const parsePrimeCandidateForValidation = (
  candidateRaw: string
): { setName: string; component: string; includeBlueprint: boolean } | null => {
  const candidate = normalizePrimeText(candidateRaw);
  if (!candidate) return null;

  const match = candidate.match(
    new RegExp(`^(.+?\\s+Prime)\\s+(${PRIME_COMPONENT_PATTERN})(?:\\s+Blueprint)?$`, 'i')
  );
  if (!match) return null;

  const setName = match[1].trim();
  const component = match[2].replace(/\s+/g, ' ').trim();
  const includeBlueprint = /\bBlueprint\b/i.test(candidate) && component.toLowerCase() !== 'blueprint';

  if (!setName || !component) return null;
  return { setName, component, includeBlueprint };
};

const extractColumnPairedPrimeCandidates = (text: string): PrimeColumnCandidate[] => {
  const lines = text.split('\n').map(line => line.replace(/\f/g, ' '));
  const candidates: PrimeColumnCandidate[] = [];

  for (let i = 0; i < lines.length - 1; i++) {
    const nameCells = splitIntoOcrCellsWithBounds(lines[i]);
    const componentCells = splitIntoOcrCellsWithBounds(lines[i + 1]);

    if (nameCells.length === 0 || componentCells.length === 0) continue;
    if (!nameCells.some(cell => isLikelyPrimeNameCell(cell.text))) continue;
    if (!componentCells.some(cell => isPrimeComponentCell(cell.text))) continue;

    const pairCount = Math.min(nameCells.length, componentCells.length);
    for (let j = 0; j < pairCount; j++) {
      const nameCell = nameCells[j];
      const componentCell = componentCells[j];
      if (!isLikelyPrimeNameCell(nameCell.text) || !isPrimeComponentCell(componentCell.text)) continue;

      const combined = combinePrimeNameAndComponentCell(nameCell.text, componentCell.text);
      if (combined) {
        candidates.push({
          candidate: combined,
          lineIndex: i,
          cellIndex: j,
          xCenter: nameCell.center
        });
      }
    }
  }

  return candidates;
};

const extractStandaloneQuantityBadges = (text: string): QuantityBadge[] => {
  const lines = text.split('\n').map(line => line.replace(/\f/g, ' '));
  const badges: QuantityBadge[] = [];

  lines.forEach((line, lineIndex) => {
    const cells = splitIntoOcrCellsWithBounds(line);
    if (cells.length === 0) return;

    const allQuantityCells = cells
      .map((cell, cellIndex) => {
        const quantity = isStandaloneQuantityLine(cell.text);
        if (quantity === null) return null;
        return {
          quantity,
          lineIndex,
          cellIndex,
          xCenter: cell.center
        };
      })
      .filter((badge): badge is QuantityBadge => badge !== null);

    if (allQuantityCells.length === 0) return;

    const containsHeaderNumeric = cells.some(cell => /[,]/.test(cell.text));
    if (containsHeaderNumeric) return;

    if (allQuantityCells.length === cells.length) {
      badges.push(...allQuantityCells);
      return;
    }

    const firstNonBadgeIndex = cells.findIndex(cell => isStandaloneQuantityLine(cell.text) === null);
    if (firstNonBadgeIndex <= 0) return;

    const leadingBadgeCells = cells.slice(0, firstNonBadgeIndex);
    const allLeadingAreBadges = leadingBadgeCells.every(cell => isStandaloneQuantityLine(cell.text) !== null);
    if (!allLeadingAreBadges) return;

    const trailingText = cells
      .slice(firstNonBadgeIndex)
      .map(cell => cell.text)
      .join(' ')
      .toLowerCase();

    if (/(sell items|only sellable|exit|total)/.test(trailingText)) return;

    const hasUiSuffix = /(tap|hold|select|info|search)/.test(trailingText);
    if (!hasUiSuffix) return;

    leadingBadgeCells.forEach((cell, cellIndex) => {
      const quantity = isStandaloneQuantityLine(cell.text);
      if (quantity === null) return;
      badges.push({
        quantity,
        lineIndex,
        cellIndex,
        xCenter: cell.center
      });
    });
  });

  return badges;
};

const applyPrimeQuantityBadges = (
  items: PrimePart[],
  text: string,
  anchors: PrimeItemAnchor[] = []
): PrimePart[] => {
  if (items.length === 0) return items;

  const quantityBadges = extractStandaloneQuantityBadges(text);
  if (quantityBadges.length === 0) return items;

  const adjustedItems = items.map(item => ({ ...item }));
  const itemIndexByKey = new Map<string, number>();
  adjustedItems.forEach((item, index) => {
    itemIndexByKey.set(normalizePrimeText(item.name).toLowerCase(), index);
  });

  const knownAnchors: Array<PrimeItemAnchor & { anchorIndex: number }> = anchors
    .map((anchor, anchorIndex) => ({ ...anchor, anchorIndex }))
    .filter((anchor): anchor is PrimeItemAnchor & { anchorIndex: number } =>
      itemIndexByKey.has(normalizePrimeText(anchor.itemName).toLowerCase())
    );

  const sortedBadges = [...quantityBadges].sort((a, b) =>
    a.lineIndex === b.lineIndex ? a.xCenter - b.xCenter : a.lineIndex - b.lineIndex
  );

  if (knownAnchors.length === 0) {
    let itemCursor = 0;
    sortedBadges.forEach(badge => {
      while (itemCursor < adjustedItems.length && (adjustedItems[itemCursor].quantity || 1) > 1) {
        itemCursor++;
      }
      if (itemCursor >= adjustedItems.length) return;
      adjustedItems[itemCursor].quantity = badge.quantity;
      itemCursor++;
    });

    ocrLogger.debug('Parsing', 'Applied quantity badges (sequential fallback)', {
      quantityBadges: sortedBadges.map(badge => badge.quantity),
      adjustedItems: adjustedItems.map(item => ({ name: item.name, quantity: item.quantity || 1 }))
    });

    return adjustedItems;
  }

  const usedAnchors = new Set<number>();
  const assignments = new Map<string, number>();
  const assignedBadgeIndexes = new Set<number>();

  sortedBadges.forEach((badge, badgeIndex) => {
    let bestAnchor: (PrimeItemAnchor & { anchorIndex: number }) | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    knownAnchors.forEach(anchor => {
      if (usedAnchors.has(anchor.anchorIndex)) return;

      const lineDelta = anchor.lineIndex - badge.lineIndex;
      if (lineDelta < -1 || lineDelta > 4) return;

      const horizontalDelta = Math.abs(anchor.xCenter - badge.xCenter);
      const linePenalty = lineDelta < 0 ? Math.abs(lineDelta) * 120 : lineDelta * 90;
      const score = horizontalDelta + linePenalty;

      if (score < bestScore) {
        bestScore = score;
        bestAnchor = anchor;
      }
    });

    if (!bestAnchor) return;

    usedAnchors.add(bestAnchor.anchorIndex);
    const key = normalizePrimeText(bestAnchor.itemName).toLowerCase();
    const currentAssigned = assignments.get(key) || 1;
    assignments.set(key, Math.max(currentAssigned, badge.quantity));
    assignedBadgeIndexes.add(badgeIndex);
  });

  assignments.forEach((quantity, key) => {
    const itemIndex = itemIndexByKey.get(key);
    if (itemIndex === undefined) return;
    adjustedItems[itemIndex].quantity = Math.max(adjustedItems[itemIndex].quantity || 1, quantity);
  });

  const anchorByKey = new Map<string, PrimeItemAnchor>();
  knownAnchors.forEach((anchor) => {
    const key = normalizePrimeText(anchor.itemName).toLowerCase();
    const existing = anchorByKey.get(key);
    if (!existing) {
      anchorByKey.set(key, anchor);
      return;
    }
    const existingRank = existing.lineIndex * 10_000 + existing.xCenter;
    const nextRank = anchor.lineIndex * 10_000 + anchor.xCenter;
    if (nextRank < existingRank) {
      anchorByKey.set(key, anchor);
    }
  });

  const itemOrder = adjustedItems
    .map((item, index) => {
      const key = normalizePrimeText(item.name).toLowerCase();
      const anchor = anchorByKey.get(key);
      return {
        key,
        index,
        rank: anchor ? anchor.lineIndex * 10_000 + anchor.xCenter : 9_999_999 + index
      };
    })
    .sort((a, b) => a.rank - b.rank);

  let orderCursor = 0;
  const unassignedBadges = sortedBadges.filter((_, idx) => !assignedBadgeIndexes.has(idx));
  unassignedBadges.forEach((badge) => {
    while (orderCursor < itemOrder.length) {
      const target = itemOrder[orderCursor];
      const currentAssigned = assignments.get(target.key) || adjustedItems[target.index].quantity || 1;
      if (currentAssigned <= 1) {
        break;
      }
      orderCursor++;
    }
    if (orderCursor >= itemOrder.length) return;
    const target = itemOrder[orderCursor];
    adjustedItems[target.index].quantity = Math.max(adjustedItems[target.index].quantity || 1, badge.quantity);
    assignments.set(target.key, adjustedItems[target.index].quantity || 1);
    orderCursor++;
  });

  ocrLogger.debug('Parsing', 'Applied quantity badges', {
    quantityBadges: sortedBadges.map(badge => ({
      quantity: badge.quantity,
      lineIndex: badge.lineIndex,
      xCenter: badge.xCenter
    })),
    anchorCount: knownAnchors.length,
    anchoredAssignments: assignments.size,
    unassignedBadgeCount: unassignedBadges.length,
    adjustedItems: adjustedItems.map(item => ({ name: item.name, quantity: item.quantity || 1 }))
  });

  return adjustedItems;
};

const extractPrimeItemsFromText = (text: string): PrimeExtractionResult => {
  const foundItems: PrimePart[] = [];
  const seenItems = new Set<string>();
  const pendingSetQueue: string[] = [];
  const orphanComponents: Array<{ component: string; includeBlueprint: boolean; lineIndex: number; xCenter: number }> = [];
  const anchors: PrimeItemAnchor[] = [];

  const addPrimeCandidate = (
    candidateRaw: string,
    threshold: number,
    source: string,
    expectedSetName?: string,
    componentHint?: string,
    includeBlueprint: boolean = false,
    strictComponentMatch: boolean = false,
    anchor?: Omit<PrimeItemAnchor, 'itemName'>
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
    if (anchor) {
      anchors.push({
        itemName: matchedName,
        lineIndex: anchor.lineIndex,
        cellIndex: anchor.cellIndex,
        xCenter: anchor.xCenter
      });
    }
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
    .map((rawLine, lineIndex) => {
      const rawLineNormalized = sanitizePrimeTextPreserveSpacing(rawLine);
      return {
        lineIndex,
        rawLine: rawLineNormalized,
        line: normalizePrimeText(rawLineNormalized)
      };
    })
    .filter(entry => entry.line.length > 0);

  const columnPairedCandidates = extractColumnPairedPrimeCandidates(text);
  columnPairedCandidates.forEach(candidate => {
    const parsed = parsePrimeCandidateForValidation(candidate.candidate);
    addPrimeCandidate(
      candidate.candidate,
      0.78,
      'column-paired-cells',
      parsed?.setName,
      parsed?.component,
      parsed?.includeBlueprint || false,
      !!parsed,
      {
        lineIndex: candidate.lineIndex,
        cellIndex: candidate.cellIndex,
        xCenter: candidate.xCenter
      }
    );
  });

  lines.forEach(({ rawLine, line, lineIndex }) => {
    if (isUINoiseText(line)) return;

    const setPrimeComponentRegex = new RegExp(
      `([A-Za-z][A-Za-z&'\\-]*(?:\\s+[A-Za-z][A-Za-z&'\\-]*)?)\\s+Prime\\s+(${PRIME_COMPONENT_PATTERN})(?:\\s+Blueprint)?`,
      'gi'
    );
    let match: RegExpExecArray | null;
    while ((match = setPrimeComponentRegex.exec(rawLine)) !== null) {
      const component = match[2].replace(/\s+/g, ' ').trim();
      const includeBlueprint = /\bBlueprint\b/i.test(match[0]) && component.toLowerCase() !== 'blueprint';
      const candidate = `${match[1]} Prime ${component}${includeBlueprint ? ' Blueprint' : ''}`;
      addPrimeCandidate(
        candidate,
        0.8,
        'set-prime-component',
        `${match[1]} Prime`,
        component,
        includeBlueprint,
        false,
        {
          lineIndex,
          cellIndex: match.index ?? -1,
          xCenter: (match.index ?? 0) + match[0].length / 2
        }
      );
    }

    const setComponentPrimeRegex = new RegExp(
      `([A-Za-z][A-Za-z&'\\-]*(?:\\s+[A-Za-z][A-Za-z&'\\-]*)?)\\s+(${PRIME_COMPONENT_PATTERN})(?:\\s+Blueprint)?\\s+Prime`,
      'gi'
    );
    while ((match = setComponentPrimeRegex.exec(rawLine)) !== null) {
      const component = match[2].replace(/\s+/g, ' ').trim();
      const includeBlueprint = /\bBlueprint\b/i.test(match[0]) && component.toLowerCase() !== 'blueprint';
      const candidate = `${match[1]} Prime ${component}${includeBlueprint ? ' Blueprint' : ''}`;
      addPrimeCandidate(
        candidate,
        0.8,
        'set-component-prime',
        `${match[1]} Prime`,
        component,
        includeBlueprint,
        false,
        {
          lineIndex,
          cellIndex: match.index ?? -1,
          xCenter: (match.index ?? 0) + match[0].length / 2
        }
      );
    }

    const componentSetPrimeRegex = new RegExp(
      `(${PRIME_COMPONENT_PATTERN})\\s+([A-Za-z][A-Za-z&'\\-]*(?:\\s+[A-Za-z][A-Za-z&'\\-]*)?)\\s+(?:Blueprint\\s+)?Prime`,
      'gi'
    );
    while ((match = componentSetPrimeRegex.exec(rawLine)) !== null) {
      const component = match[1].replace(/\s+/g, ' ').trim();
      const includeBlueprint = /\bBlueprint\b/i.test(match[0]) && component.toLowerCase() !== 'blueprint';
      const candidate = `${match[2]} Prime ${component}${includeBlueprint ? ' Blueprint' : ''}`;
      addPrimeCandidate(
        candidate,
        0.8,
        'component-set-prime',
        `${match[2]} Prime`,
        component,
        includeBlueprint,
        false,
        {
          lineIndex,
          cellIndex: match.index ?? -1,
          xCenter: (match.index ?? 0) + match[0].length / 2
        }
      );
    }

    const setOnlyRegex = /([A-Za-z][A-Za-z&'\-]*(?:\s+[A-Za-z][A-Za-z&'\-]*)?)\s+Prime\b/gi;
    while ((match = setOnlyRegex.exec(rawLine)) !== null) {
      const setNameWithoutComponent = stripTrailingPrimeComponentWords(match[1]);
      if (!setNameWithoutComponent) continue;
      const setCandidate = `${setNameWithoutComponent} Prime`;
      const matchedSet = findBestPrimeSetMatch(setCandidate, 0.85);
      if (!matchedSet) continue;
      pendingSetQueue.push(matchedSet);
    }

    const componentOnlyRegex = new RegExp(`\\b(${PRIME_COMPONENT_PATTERN})(?:\\s+Blueprint)?\\b`, 'gi');
    while ((match = componentOnlyRegex.exec(rawLine)) !== null) {
      const component = match[1].replace(/\s+/g, ' ').trim();
      const includeBlueprint = /\bBlueprint\b/i.test(match[0]) && component.toLowerCase() !== 'blueprint';
      orphanComponents.push({
        component,
        includeBlueprint,
        lineIndex,
        xCenter: (match.index ?? 0) + match[0].length / 2
      });
    }
  });

  if (pendingSetQueue.length > 0 || orphanComponents.length > 0) {
    ocrLogger.debug('Parsing', 'Prime pending set queue', { pendingSetQueue });
    ocrLogger.debug('Parsing', 'Prime orphan components', { orphanComponents });
  }

  let componentCursor = 0;
  pendingSetQueue.forEach(setName => {
    let matchedForSet = false;
    for (let i = componentCursor; i < orphanComponents.length; i++) {
      const { component, includeBlueprint, lineIndex, xCenter } = orphanComponents[i];
      const candidate = `${setName} ${component}${includeBlueprint ? ' Blueprint' : ''}`;
      const matched = addPrimeCandidate(
        candidate,
        0.78,
        'pending-set-component',
        setName,
        component,
        includeBlueprint,
        true,
        {
          lineIndex,
          cellIndex: i,
          xCenter
        }
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

  return { items: foundItems, anchors };
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

// Cache for valid prime item names (built from primesets.json)
let validPrimeItemsCache: Set<string> | null = null;
let validPrimeItemsBySetCache: Map<string, string[]> | null = null;

const buildValidPrimeItems = (): Set<string> => {
  if (validPrimeItemsCache) return validPrimeItemsCache;

  const primeSets = getPrimeSetsCache();
  const validItems = new Set<string>();

  if (primeSets && primeSets.length > 0) {
    primeSets.forEach((set: any) => {
      const setName = set.name;
      validItems.add(setName.toLowerCase());

      if (set.components) {
        set.components.forEach((comp: any) => {
          const compName = comp.name;
          validItems.add(`${setName} ${compName}`.toLowerCase());
          if (['Chassis', 'Neuroptics', 'Systems'].includes(compName)) {
            validItems.add(`${setName} ${compName} Blueprint`.toLowerCase());
          }
        });
      }
    });
  }

  validPrimeItemsCache = validItems;
  validPrimeItemsBySetCache = null;
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

export const parsePrimePartsFromText = (text: string): PrimePart[] => {
  const primeExtraction = extractPrimeItemsFromText(text);
  if (primeExtraction.items.length === 0) {
    ocrLogger.warn('Parsing', 'Prime extraction returned 0 items');
    return [];
  }

  const quantityAwareItems = applyPrimeQuantityBadges(primeExtraction.items, text, primeExtraction.anchors);
  const normalizedPrimeItems = normalizeBlueprintablePrimeItems(quantityAwareItems);

  ocrLogger.info('Parsing', `Prime extraction found ${primeExtraction.items.length} items`, {
    normalizedItems: normalizedPrimeItems.length,
    itemNames: normalizedPrimeItems.map(item => `${item.name} x${item.quantity || 1}`)
  });

  return normalizedPrimeItems;
};

export const normalizePrimeItemName = normalizePrimeText;
