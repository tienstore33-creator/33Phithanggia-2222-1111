export function getModelSortWeight(modelId: string): number {
  const name = modelId.toLowerCase();
  
  // 1. Base tier weight
  let tierWeight = 0;
  
  if (name.includes('opus') || name.includes('o1') || name.includes('reasoner') || name.includes('thinking')) {
    tierWeight = 5000;
  } else if (name.includes('pro') || name.includes('sonnet') || name.includes('gpt-4') || name.includes('large') || name.includes('deepseek-chat') || name.includes('v3') || name.includes('r1')) {
    tierWeight = 3000;
  } else if (name.includes('flash') || name.includes('gpt-3.5') || name.includes('mini') || name.includes('small') || name.includes('sonar') || name.includes('grok-2')) {
    tierWeight = 1000;
  } else if (name.includes('lite') || name.includes('haiku') || name.includes('micro')) {
    tierWeight = 200;
  } else {
    // Default tier weight if unknown
    tierWeight = 500;
  }

  // 2. Version weight (higher version is newer/better within the same family/tier)
  let versionWeight = 0;
  // Match version decimal like 4.6, 3.5, 3.1, 2.5, 2.0, 1.5
  const versionMatch = name.match(/(?:claude-|gemini-|gpt-|grok-|llama-)?(\d+\.\d+|\d+)/);
  if (versionMatch) {
    versionWeight = parseFloat(versionMatch[1]) * 100;
  }

  // 3. Fake/Alternative prefix penalty:
  // Usually stream, bypass, fake or non-native models should follow the native ones
  let prefixPenalty = 0;
  if (name.includes('假流') || name.includes('fake') || name.includes('stream') || name.includes('agent')) {
    prefixPenalty = -50;
  }

  return tierWeight + versionWeight + prefixPenalty;
}

export function sortModelObjects<T extends { id: string }>(models: T[]): T[] {
  return [...models].sort((a, b) => {
    const wA = getModelSortWeight(a.id);
    const wB = getModelSortWeight(b.id);
    if (wB !== wA) {
      return wB - wA; // Descending
    }
    return a.id.localeCompare(b.id); // Stable alphabetical sort
  });
}

export function sortModelIds(modelIds: string[]): string[] {
  return [...modelIds].sort((a, b) => {
    const wA = getModelSortWeight(a);
    const wB = getModelSortWeight(b);
    if (wB !== wA) {
      return wB - wA; // Descending
    }
    return a.localeCompare(b);
  });
}
