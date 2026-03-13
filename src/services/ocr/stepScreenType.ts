import { ocrLogger } from '../ocrLogger';

export type OcrScreenType = 'prime_parts' | 'relics' | 'syndicate' | 'mods' | 'unknown';

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
  /^\s*[@#$%^&*|\\[\]{}:~\-]+\s*$/,
  /^\s*[ivxlcdm]+\s*$/i
];

export const isUINoiseText = (line: string): boolean => {
  const trimmed = line.trim();

  const isQuantityOrMarker =
    /^([x×])?(\d+)$/i.test(trimmed) ||
    /^[\(\[]?[Oo0ØVv@©®\-\s][\)\]]?$/.test(trimmed) ||
    trimmed === '()' || trimmed === '[]' || trimmed === 'x' || trimmed === '×';

  if (isQuantityOrMarker) return false;
  if (trimmed.length < 2) return true;

  const alphaNum = trimmed.replace(/[^a-zA-Z0-9]/g, '').length;
  if (trimmed.length > 3 && alphaNum < trimmed.length * 0.3) return true;

  return UI_NOISE_PATTERNS.some(pattern => pattern.test(trimmed));
};

export const determineScreenType = (text: string): OcrScreenType => {
  ocrLogger.debug('ScreenType', 'Determining screen type from extracted text', {
    textLength: text.length,
    textPreview: text.substring(0, 200)
  });

  const lowerText = text.toLowerCase();

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

  if (
    lowerText.includes('void relics') ||
    lowerText.includes('relic') ||
    /\b(lith|meso|neo|axi)\s+[a-z]\d+/i.test(text)
  ) {
    ocrLogger.info('ScreenType', 'Detected screen type: relics');
    return 'relics';
  }

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

  if (
    /\bmods?\b/i.test(text) ||
    /\b(drain|capacity)\s*:?\s*\d+/i.test(text) ||
    /\d+\s*\/\s*\d+\s*\(drain/i.test(text)
  ) {
    ocrLogger.info('ScreenType', 'Detected screen type: mods');
    return 'mods';
  }

  if (lowerText.includes('prime') || lowerText.includes('blueprint')) {
    ocrLogger.info('ScreenType', 'Detected screen type: prime_parts');
    return 'prime_parts';
  }

  ocrLogger.warn('ScreenType', 'Could not determine screen type, defaulting to unknown', {
    textPreview: text.substring(0, 500)
  });
  return 'unknown';
};
