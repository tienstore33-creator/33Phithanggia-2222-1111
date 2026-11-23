import React from 'react';
import { KnowledgeBase, PlayerActionInputType, ResponseLength } from '../types';
import { streamNextTurn, StoryStreamCallbacks } from './storyStreamService';

export interface RewriteNarrationContext {
  knowledgeBase?: KnowledgeBase;
  arcStateSnapshot?: KnowledgeBase['arcState'];
  playerAction?: string;
  inputType?: PlayerActionInputType;
  responseLength?: ResponseLength;
  currentPageMessagesLog?: string;
  previousPageSummaries?: string[];
  lastNarrationFromPreviousPage?: string;
  retrievedContext?: string;
  dynamicContextLayers?: { priority: number; content: string }[];
  customPromptOverride?: string;
  turnNumber: number;
  logSentPrompt?: (prompt: string, turnNumber?: number) => void;
}

interface ExecuteRewriteParams {
  modelToUse: string;
  context: RewriteNarrationContext;
  callbacks: StoryStreamCallbacks;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  onResetStream?: () => void;
}

/**
 * Viết lại lời kể từ đầu bằng một model AI khác (hoặc model hiện tại),
 * khôi phục lại arcState trước lượt để tránh cộng dồn sai số lượt arc.
 */
export async function executeRewriteNarrationFromScratch({
  modelToUse,
  context,
  callbacks,
  abortControllerRef,
  onResetStream,
}: ExecuteRewriteParams): Promise<{ response: any; rawText: string }> {
  if (!context.knowledgeBase) {
    throw new Error('Thiếu ngữ cảnh KnowledgeBase để viết lại lời kể từ đầu.');
  }

  // Khôi phục lại arcState trước khi lượt hiện tại bắt đầu để không bị tăng kép turnCount
  context.knowledgeBase.arcState = context.arcStateSnapshot
    ? structuredClone(context.arcStateSnapshot)
    : undefined;

  abortControllerRef.current = new AbortController();
  const signal = abortControllerRef.current.signal;

  return await streamNextTurn(
    context.knowledgeBase,
    context.playerAction || '',
    context.inputType || 'action',
    context.responseLength || 'short',
    context.currentPageMessagesLog || '',
    context.previousPageSummaries || [],
    context.lastNarrationFromPreviousPage,
    context.retrievedContext,
    callbacks,
    context.logSentPrompt
      ? (p) => context.logSentPrompt!(p, context.turnNumber)
      : undefined,
    signal,
    context.dynamicContextLayers,
    onResetStream,
    context.customPromptOverride,
    modelToUse
  );
}
