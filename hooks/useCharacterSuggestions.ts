import { useState, useMemo } from 'react';
import { FanficWork, FanficCharacter } from '../src/types/fanfic';

export const useCharacterSuggestions = (selectedWork: FanficWork | null) => {
  const [searchQuery, setSearchQuery] = useState('');

  const suggestions = useMemo(() => {
    if (!selectedWork || !selectedWork.characters) return [];
    
    const query = searchQuery.toLowerCase().trim();
    if (!query) return selectedWork.characters;

    return selectedWork.characters.filter(char => 
      char.name.toLowerCase().includes(query) || 
      (char.role && char.role.toLowerCase().includes(query))
    );
  }, [selectedWork, searchQuery]);

  return {
    searchQuery,
    setSearchQuery,
    suggestions
  };
};
