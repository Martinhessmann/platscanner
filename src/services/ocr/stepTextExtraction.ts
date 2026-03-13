import { WhisperResult } from '../llmWhispererService';

export const getWhisperExtractedText = (result: WhisperResult): string => {
  return result.extracted_text || result.text || result.result_text || '';
};
