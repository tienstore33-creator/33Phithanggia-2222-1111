import { useState, useMemo } from 'react';
import { SaveGameMeta } from '../types';

/**
 * Hook to manage the selection and bulk deletion of save games.
 */
export const useSaveGameManager = (saves: SaveGameMeta[]) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      if (prev.size === saves.length) {
        return new Set();
      } else {
        return new Set(saves.map(s => s.id));
      }
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const deleteSelected = async (onDelete: (ids: string[]) => Promise<void>) => {
    if (selectedIds.size === 0) return;
    
    setIsDeleting(true);
    try {
      await onDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    } finally {
      setIsDeleting(false);
    }
  };

  const isAllSelected = saves.length > 0 && selectedIds.size === saves.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < saves.length;

  return {
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    deleteSelected,
    isDeleting,
    isAllSelected,
    isSomeSelected
  };
};
