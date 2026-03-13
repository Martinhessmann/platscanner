import { DetectedItem } from '../../types';
import { WhisperResult } from '../llmWhispererService';
import { parseGenericItemsFromText } from './stepGenericItemsParser';
import { parsePrimePartsFromText } from './stepPrimePartsParser';
import { determineScreenType, OcrScreenType } from './stepScreenType';
import { getWhisperExtractedText } from './stepTextExtraction';

export interface ExpectedOcrItem {
  name: string;
  quantity: number;
}

export interface OcrStepSnapshot {
  extractedText: string;
  screenType: OcrScreenType;
  parsedItems: Array<{ name: string; quantity: number; category: DetectedItem['category'] }>;
}

export interface OcrComparisonReport {
  pass: boolean;
  expectedCount: number;
  actualCount: number;
  missing: ExpectedOcrItem[];
  unexpected: ExpectedOcrItem[];
  quantityMismatches: Array<{ name: string; expected: number; actual: number }>;
}

const normalizeItemName = (value: string): string => value.trim().toLowerCase();

const toExpectedShape = (items: Array<{ name: string; quantity: number }>): ExpectedOcrItem[] => {
  return items
    .map((item) => ({ name: item.name.trim(), quantity: Math.max(1, item.quantity || 1) }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const buildStepSnapshotFromWhisperResult = (whisperResult: WhisperResult): OcrStepSnapshot => {
  const extractedText = getWhisperExtractedText(whisperResult);
  const screenType = determineScreenType(extractedText);

  const parsed = screenType === 'prime_parts'
    ? parsePrimePartsFromText(extractedText)
    : parseGenericItemsFromText(extractedText, screenType);

  return {
    extractedText,
    screenType,
    parsedItems: parsed.map((item) => ({
      name: item.name,
      quantity: Math.max(1, item.quantity || 1),
      category: item.category
    }))
  };
};

export const compareSnapshotWithExpected = (
  snapshot: OcrStepSnapshot,
  expectedItems: ExpectedOcrItem[]
): OcrComparisonReport => {
  const expected = toExpectedShape(expectedItems);
  const actual = toExpectedShape(snapshot.parsedItems);

  const expectedMap = new Map(expected.map((item) => [normalizeItemName(item.name), item.quantity]));
  const actualMap = new Map(actual.map((item) => [normalizeItemName(item.name), item.quantity]));

  const missing: ExpectedOcrItem[] = [];
  const unexpected: ExpectedOcrItem[] = [];
  const quantityMismatches: Array<{ name: string; expected: number; actual: number }> = [];

  expected.forEach((item) => {
    const key = normalizeItemName(item.name);
    const actualQuantity = actualMap.get(key);

    if (actualQuantity === undefined) {
      missing.push(item);
      return;
    }

    if (actualQuantity !== item.quantity) {
      quantityMismatches.push({
        name: item.name,
        expected: item.quantity,
        actual: actualQuantity
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
    pass: missing.length === 0 && unexpected.length === 0 && quantityMismatches.length === 0,
    expectedCount: expected.length,
    actualCount: actual.length,
    missing,
    unexpected,
    quantityMismatches
  };
};
