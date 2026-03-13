import { DetectedItem, VoidRelic } from '../../types';
import { determineModRarity } from '../modService';
import { ocrLogger } from '../ocrLogger';
import { OcrScreenType, isUINoiseText } from './stepScreenType';

const parseQuantity = (line: string): { quantity: number; cleanLine: string } => {
  let quantity = 1;
  let cleanLine = line.trim();

  let match = cleanLine.match(/^(\d+)\s*[x×]\s+(.+)$/i);
  if (match) {
    quantity = parseInt(match[1], 10);
    cleanLine = match[2].trim();
    return { quantity, cleanLine };
  }

  match = cleanLine.match(/^(.+?)\s+[x×](\d+)$/i);
  if (match) {
    cleanLine = match[1].trim();
    quantity = parseInt(match[2], 10);
    return { quantity, cleanLine };
  }

  match = cleanLine.match(/^[x×](\d+)\s*(.+)$/i);
  if (match) {
    quantity = parseInt(match[1], 10);
    cleanLine = match[2].trim();
    return { quantity, cleanLine };
  }

  match = cleanLine.match(/^(.+?)[x×](\d+)$/i);
  if (match) {
    cleanLine = match[1].trim();
    quantity = parseInt(match[2], 10);
    return { quantity, cleanLine };
  }

  const isPureQuantity = /^([x×])?(\d+)$/i.test(cleanLine);
  if (isPureQuantity) {
    const qtyMatch = cleanLine.match(/^([x×])?(\d+)$/i);
    if (qtyMatch) {
      return { quantity: parseInt(qtyMatch[2], 10), cleanLine: '' };
    }
  }

  const isRelicPattern = /\b(Lith|Meso|Neo|Axi)\s+[A-Z]\d+$/i.test(cleanLine);
  if (!isRelicPattern) {
    match = cleanLine.match(/^(.+?)\s+(\d+)$/i);
    if (match) {
      const potentialName = match[1].trim();
      const potentialQty = parseInt(match[2], 10);
      if (potentialQty < 100) {
        cleanLine = potentialName;
        quantity = potentialQty;
      }
    }
  }

  return { quantity, cleanLine };
};

export const parseGenericItemsFromText = (
  text: string,
  screenType: OcrScreenType
): DetectedItem[] => {
  const detectedItems: DetectedItem[] = [];
  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);

  ocrLogger.debug('Parsing', `Split text into ${lines.length} lines`);

  const pendingBadges: number[] = [];

  lines.forEach((line, index) => {
    if (isUINoiseText(line)) {
      ocrLogger.debug('Parsing', `Skipping noise: "${line}"`);
      return;
    }

    const { quantity, cleanLine } = parseQuantity(line);

    if (cleanLine === '' || cleanLine === 'x' || cleanLine === '×') {
      if (quantity > 1) {
        pendingBadges.push(quantity);
      } else if (
        line.match(/^[\(\[]?[Oo0ØVv@©®\-\s][\)\]]?$/) ||
        line === '()' ||
        line === '[]'
      ) {
        pendingBadges.push(0);
      }
      return;
    }

    let matchedName: string | null = null;
    let itemCategory: DetectedItem['category'] = 'relics';
    let extraData: Partial<DetectedItem> = {};

    if (cleanLine.includes('Relic') || /\b(Lith|Meso|Neo|Axi)\s+[A-Z]\d+/i.test(cleanLine)) {
      itemCategory = 'relics';
      let relicName = cleanLine;
      let rarity: VoidRelic['rarity'] = 'intact';

      const rarityMatch =
        cleanLine.match(/[\(\[](Intact|Exceptional|Flawless|Radiant)[\)\]]/i) ||
        cleanLine.match(/\b(Intact|Exceptional|Flawless|Radiant)\b/i);

      if (rarityMatch) {
        rarity = rarityMatch[1].toLowerCase() as VoidRelic['rarity'];
        relicName = cleanLine
          .replace(/[\(\[](Intact|Exceptional|Flawless|Radiant)[\)\]]/gi, '')
          .replace(/\b(Intact|Exceptional|Flawless|Radiant)\b/gi, '')
          .trim()
          .replace(/\s+/g, ' ');
      }

      if (!relicName.toLowerCase().includes('relic')) {
        relicName += ' Relic';
      }

      matchedName = relicName;
      extraData = { rarity };
    } else if (screenType === 'mods') {
      const rarity = determineModRarity(cleanLine);
      const isKnown = rarity !== 'uncommon';
      const looksLikeName = cleanLine.length > 5 && !/^\d+$/.test(cleanLine) && !cleanLine.includes('|');

      if (isKnown || looksLikeName) {
        itemCategory = 'mods';

        const pipeMatch = cleanLine.match(/^(.+?)\s*\|\s*(\d+)\s*\|\s*(\d+)/);
        const rankMatch = cleanLine.match(/^(.+?)\s+(?:Rank|r)\s*(\d+)\/\d+\s*(?:\(Drain\s*(\d+)\))?/i);
        const standaloneDrainMatch = cleanLine.match(/^(.+?)\s+(\d+)$/);

        if (pipeMatch) {
          matchedName = pipeMatch[1].trim();
          extraData = { rank: parseInt(pipeMatch[2], 10), drain: parseInt(pipeMatch[3], 10) };
        } else if (rankMatch) {
          matchedName = rankMatch[1].trim();
          extraData = {
            rank: parseInt(rankMatch[2], 10),
            drain: rankMatch[3] ? parseInt(rankMatch[3], 10) : undefined
          };
        } else if (standaloneDrainMatch) {
          matchedName = standaloneDrainMatch[1].trim();
          const potentialDrain = parseInt(standaloneDrainMatch[2], 10);
          if (potentialDrain > 1 && potentialDrain < 20) {
            extraData = { drain: potentialDrain };
          }
        } else {
          matchedName = cleanLine;
        }

        matchedName = matchedName.replace(/[.·*•-]$/, '').trim();
      }
    }

    if (!matchedName) {
      return;
    }

    let finalQuantity = quantity;
    if (pendingBadges.length > 0) {
      finalQuantity = pendingBadges.shift() || 1;
    }

    if (finalQuantity === 0) {
      return;
    }

    const item: DetectedItem = {
      id: `${itemCategory}-${Date.now()}-${index}`,
      name: matchedName,
      category: itemCategory,
      quantity: finalQuantity,
      status: 'loading',
      ...extraData
    } as DetectedItem;

    detectedItems.push(item);
  });

  ocrLogger.info('Parsing', `Parsed ${detectedItems.length} items from ${lines.length} lines`);
  return detectedItems;
};
