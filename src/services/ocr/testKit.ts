import { DetectedItem } from '../../types';
import type { WhisperResult } from '../llmWhispererService';
import { parseGenericItemsFromText } from './stepGenericItemsParser';
import { parsePrimePartsFromWhisperResult } from './stepPrimePartsWhisperParser';
import { parseRelicsFromWhisperResult } from './stepRelicWhisperParser';
import { determineScreenType, OcrScreenType } from './stepScreenType';
import { getWhisperExtractedText } from './stepTextExtraction';

export interface ExpectedOcrItem {
  name: string;
  quantity: number;
  rarity?: string;
}

export interface OcrStepSnapshot {
  extractedText: string;
  screenType: OcrScreenType;
  parsedItems: Array<{ name: string; quantity: number; category: DetectedItem['category']; rarity?: string }>;
}

export interface OcrComparisonReport {
  pass: boolean;
  expectedCount: number;
  actualCount: number;
  missing: ExpectedOcrItem[];
  unexpected: ExpectedOcrItem[];
  quantityMismatches: Array<{ name: string; expected: number; actual: number }>;
  rarityMismatches: Array<{ name: string; expected: string; actual: string }>;
}

const normalizeItemName = (value: string): string => value.trim().toLowerCase();

const toExpectedShape = (items: Array<{ name: string; quantity: number; rarity?: string }>): ExpectedOcrItem[] => {
  return items
    .map((item) => ({
      name: item.name.trim(),
      quantity: Math.max(1, item.quantity || 1),
      rarity: item.rarity?.trim().toLowerCase()
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const buildStepSnapshotFromWhisperResult = async (
  whisperResult: WhisperResult,
  imageFile?: File
): Promise<OcrStepSnapshot> => {
  const extractedText = getWhisperExtractedText(whisperResult);
  const screenType = determineScreenType(extractedText);

  const parsed = screenType === 'prime_parts'
    ? parsePrimePartsFromWhisperResult(whisperResult)
    : screenType === 'relics'
      ? await parseRelicsFromWhisperResult(whisperResult, imageFile)
    : parseGenericItemsFromText(extractedText, screenType);

  return {
    extractedText,
    screenType,
    parsedItems: parsed.map((item) => ({
      name: item.name,
      quantity: Math.max(1, item.quantity || 1),
      category: item.category,
      rarity: 'rarity' in item && typeof item.rarity === 'string' ? item.rarity : undefined
    }))
  };
};

export const compareSnapshotWithExpected = (
  snapshot: OcrStepSnapshot,
  expectedItems: ExpectedOcrItem[]
): OcrComparisonReport => {
  const expected = toExpectedShape(expectedItems);
  const actual = toExpectedShape(snapshot.parsedItems);

  const expectedMap = new Map(expected.map((item) => [normalizeItemName(item.name), item]));
  const actualMap = new Map(actual.map((item) => [normalizeItemName(item.name), item]));

  const missing: ExpectedOcrItem[] = [];
  const unexpected: ExpectedOcrItem[] = [];
  const quantityMismatches: Array<{ name: string; expected: number; actual: number }> = [];
  const rarityMismatches: Array<{ name: string; expected: string; actual: string }> = [];

  expected.forEach((item) => {
    const key = normalizeItemName(item.name);
    const actualItem = actualMap.get(key);

    if (!actualItem) {
      missing.push(item);
      return;
    }

    if (actualItem.quantity !== item.quantity) {
      quantityMismatches.push({
        name: item.name,
        expected: item.quantity,
        actual: actualItem.quantity
      });
    }

    if (item.rarity && actualItem.rarity !== item.rarity) {
      rarityMismatches.push({
        name: item.name,
        expected: item.rarity,
        actual: actualItem.rarity || 'intact'
      });
    }
  });

  actual.forEach((item) => {
    const key = normalizeItemName(item.name);
    if (!expectedMap.has(key)) {
      unexpected.push(item);
    }
  });

  return {
    pass: missing.length === 0 && unexpected.length === 0 && quantityMismatches.length === 0 && rarityMismatches.length === 0,
    expectedCount: expected.length,
    actualCount: actual.length,
    missing,
    unexpected,
    quantityMismatches,
    rarityMismatches
  };
};
