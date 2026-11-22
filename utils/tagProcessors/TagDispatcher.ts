import React from 'react';
import { KnowledgeBase, VectorUpdate, Quest, Item } from '../../types';
import { processItemAcquired, processItemConsumed } from './itemTagProcessor';
import { processStatsUpdate } from './statsTagProcessor';
import { processRelationshipUpdate } from './relationshipTagProcessor';
import { processChangeTime } from './timeTagProcessor';
import { processStatsUpdate as processReputationChange } from './statsTagProcessor'; 
import { processNpc } from './npcTagProcessor';
import { processMoneyChange } from './currencyTagProcessor';

export { processMoneyChange };

/**
 * Helper to merge and deduplicate arrays of objects by their name or title.
 */
function mergeAndDeduplicateByName<T extends { name?: string; title?: string; id?: string }>(existing: T[], incoming: T[]): T[] {
    const map = new Map<string, T>();
    existing.forEach(item => map.set((item.id || item.name || item.title || '').toLowerCase(), item));
    incoming.forEach(item => map.set((item.id || item.name || item.title || '').toLowerCase(), item));
    return Array.from(map.values());
}

/**
 * Sanitizes an entity name for consistency.
 */
function sanitizeEntityName(name: string): string {
    return name.trim().replace(/['\\*]/g, '');
}


