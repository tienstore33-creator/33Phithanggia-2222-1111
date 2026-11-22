import { KnowledgeBase } from '../types';

export const fastCloneKb = (kb: KnowledgeBase): KnowledgeBase => {
    if (!kb) {
        console.error("fastCloneKb called with null/undefined KnowledgeBase!");
        return {} as KnowledgeBase; // Return empty object instead of null to prevent dot-property crashes
    }
    // We do a shallow copy first
    const cloned = { ...kb };
    
    // For heavy things like ragVectorStore, we just share the reference or shallow clone the object
    if (kb.ragVectorStore) {
        cloned.ragVectorStore = {
            ...kb.ragVectorStore,
            vectors: [...kb.ragVectorStore.vectors]
        };
    }
    
    // For the rest, we can use JSON.parse(JSON.stringify) since they are relatively small,
    // but we remove the heavy properties before stringifying to save massive CPU time.
    const tempStore = cloned.ragVectorStore;
    delete (cloned as any).ragVectorStore;
    
    const stringified = JSON.stringify(cloned);
    const deepClonedRest = JSON.parse(stringified);
    
    deepClonedRest.ragVectorStore = tempStore;
    
    return deepClonedRest as KnowledgeBase;
};
