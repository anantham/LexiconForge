import { useMemo, useRef, useEffect } from 'react';
import {
  tokenizeTranslation,
  TranslationToken,
  TranslationParagraph,
  TokenizationResult,
} from '../components/chapter/translationTokens';

const emptyResult: TokenizationResult = {
  tokens: [],
  nodes: [],
  paragraphs: [],
};

export const useTranslationTokens = (
  viewMode: 'original' | 'fan' | 'english',
  repairedTranslation: string,
  chapterId?: string | null,
) => {
  const data = useMemo(() => {
    if (viewMode !== 'english') {
      return emptyResult;
    }
    return tokenizeTranslation(repairedTranslation, chapterId ?? 'chapter');
  }, [viewMode, repairedTranslation, chapterId]);

  const tokensRef = useRef<TranslationToken[]>(data.tokens);
  useEffect(() => {
    tokensRef.current = data.tokens;
  }, [data.tokens]);

  return { translationTokensData: data, translationTokensRef: tokensRef };
};
