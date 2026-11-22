import { GroundingData, GroundingSource } from '../types/chatbot';

export function extractGroundingDataFromResponse(metadata: any): GroundingData | undefined {
  if (!metadata) return undefined;

  const rawQueries = metadata.webSearchQueries || metadata.searchQueries || metadata.queries;
  const queries: string[] = Array.isArray(rawQueries) 
    ? rawQueries.filter((q: any) => typeof q === 'string' && q.trim() !== '')
    : [];

  const sources: GroundingSource[] = [];
  const seenUrls = new Set<string>();

  const addSource = (rawUrl: string, rawTitle?: string) => {
    if (!rawUrl || typeof rawUrl !== 'string') return;
    const url = rawUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) return;
    if (seenUrls.has(url)) return;
    
    seenUrls.add(url);
    let domain = '';
    try {
      domain = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      domain = url;
    }
    sources.push({
      title: (rawTitle && rawTitle.trim()) || domain,
      url,
      domain
    });
  };

  // 1. Check metadata.groundingChunks (Google GenAI format)
  if (Array.isArray(metadata.groundingChunks)) {
    for (const chunk of metadata.groundingChunks) {
      if (chunk?.web?.uri) {
        addSource(chunk.web.uri, chunk.web.title);
      } else if (chunk?.uri) {
        addSource(chunk.uri, chunk.title);
      }
    }
  }

  // 2. Check metadata.sources (Alternate sources format)
  if (Array.isArray(metadata.sources)) {
    for (const item of metadata.sources) {
      if (typeof item === 'string') {
        addSource(item);
      } else if (item && typeof item === 'object') {
        addSource(item.url || item.uri || item.link, item.title || item.name);
      }
    }
  }

  // 3. Check metadata.references (Alternate references format)
  if (Array.isArray(metadata.references)) {
    for (const item of metadata.references) {
      if (typeof item === 'string') {
        addSource(item);
      } else if (item && typeof item === 'object') {
        addSource(item.url || item.uri || item.link, item.title || item.name);
      }
    }
  }

  if (sources.length === 0 && queries.length === 0) {
    return undefined;
  }

  return {
    webSearchQueries: queries,
    sources,
    searchEntryPointHtml: metadata.searchEntryPoint?.renderedContent
  };
}
