import { KnowledgeBase, GameMessage } from '../types';
import { VIETNAMESE, TURNS_PER_PAGE } from '../constants';

export const getMessagesForPage = (
  pageNumber: number,
  knowledgeBase: KnowledgeBase,
  allGameMessages: GameMessage[]
): GameMessage[] => {
  if (!knowledgeBase.currentPageHistory || knowledgeBase.currentPageHistory.length === 0) {
    return allGameMessages; 
  }
  const turnStartOfPage = knowledgeBase.currentPageHistory[pageNumber -1];
  const turnEndOfPage = (pageNumber < knowledgeBase.currentPageHistory.length) 
                          ? knowledgeBase.currentPageHistory[pageNumber] - 1 
                          : knowledgeBase.playerStats.turn;

  const messages = allGameMessages.filter(msg => 
    msg.turnNumber >= turnStartOfPage && msg.turnNumber <= turnEndOfPage
  );
  
  // NEW LOGIC: Prepend summary from previous page.
  const summaryForPreviousPage = knowledgeBase.pageSummaries?.[pageNumber - 1];
  if (summaryForPreviousPage) {
     const isChapterSummary = summaryForPreviousPage.startsWith('CHAPTER_SUMMARY::');
     const content = isChapterSummary ? summaryForPreviousPage.replace('CHAPTER_SUMMARY::', '') : summaryForPreviousPage;
     // FIX: Corrected chapter number calculation. It should be based on the page number being summarized.
     const chapterNumber = Math.floor((pageNumber - 1) / 5);
     const title = isChapterSummary ? `Tóm Tắt Chương ${chapterNumber}` : VIETNAMESE.pageSummaryTitle(pageNumber - 1);

     messages.unshift({
         id: `page-summary-display-${pageNumber - 1}-at-start-of-${pageNumber}`,
         type: 'page_summary',
         content: `${title}: ${content}`,
         timestamp: Date.now(), 
         turnNumber: turnStartOfPage
     });
  }
  return messages;
};


export const calculateTotalPages = (knowledgeBase: KnowledgeBase): number => {
  return Math.max(1, knowledgeBase.currentPageHistory?.length || 1);
};
