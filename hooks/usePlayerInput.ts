
// FIX: Add React import to resolve namespace errors.
import React, { useState, useRef, useCallback } from 'react';
import { PlayerActionInputType, ResponseLength } from '../types';

interface UsePlayerInputProps {
  onPlayerAction: (action: string, isChoice: boolean, inputType: PlayerActionInputType, responseLength: ResponseLength) => Promise<void>;
  isLoading: boolean;
  isSummarizing: boolean;
  isCurrentlyActivePage: boolean;
  messageIdBeingEdited: string | null;
  selectedResponseLength: ResponseLength;
  setSelectedResponseLength: (length: ResponseLength) => void;
  onCommand?: (command: string, args: string) => void;
}

export const usePlayerInput = ({ 
  onPlayerAction, 
  isLoading, 
  isSummarizing, 
  isCurrentlyActivePage, 
  messageIdBeingEdited,
  selectedResponseLength,
  setSelectedResponseLength,
  onCommand
}: UsePlayerInputProps) => {
  const [playerInput, setPlayerInput] = useState('');
  const [currentActionType, setCurrentActionType] = useState<PlayerActionInputType>('action');
  const [isActionTypeDropdownOpen, setIsActionTypeDropdownOpen] = useState(false);
  const [isResponseLengthDropdownOpen, setIsResponseLengthDropdownOpen] = useState(false);
  const [showAiSuggestions, setShowAiSuggestions] = useState(true);

  const actionTypeDropdownRef = useRef<HTMLDivElement | null>(null);
  const responseLengthDropdownRef = useRef<HTMLDivElement | null>(null);
  
  const handleChoiceClick = useCallback((choiceText: string, thought?: string) => {
    if (!isLoading && !isSummarizing && isCurrentlyActivePage) {
      if (thought) {
        setPlayerInput(`${choiceText}] /* ${thought}`);
      } else {
        setPlayerInput(choiceText);
      }
    }
  }, [isLoading, isSummarizing, isCurrentlyActivePage]);
  
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const input = playerInput.trim();
    if (input && !isLoading && !isSummarizing && isCurrentlyActivePage && !messageIdBeingEdited) {
      // Check for commands
      if (input.startsWith('/') && onCommand) {
        const parts = input.split(' ');
        const command = parts[0].substring(1).toLowerCase();
        const args = parts.slice(1).join(' ');
        onCommand(command, args);
        setPlayerInput('');
        return;
      }

      try {
        await onPlayerAction(input, false, currentActionType, selectedResponseLength);
        setPlayerInput(''); // Only clear if successful
      } catch (err: any) {
        // Keep input if error occurred
        if (err && err.message === "TIMELINE_INTERCEPTED") {
          console.warn("Player action intercepted: TIMELINE_INTERCEPTED");
        } else {
          console.error("Player action failed, preserving input:", err);
        }
      }
    }
  }, [playerInput, isLoading, isSummarizing, isCurrentlyActivePage, messageIdBeingEdited, onPlayerAction, currentActionType, selectedResponseLength, onCommand]);

  return {
    playerInput,
    setPlayerInput,
    currentActionType,
    setCurrentActionType,
    selectedResponseLength,
    setSelectedResponseLength,
    isActionTypeDropdownOpen,
    setIsActionTypeDropdownOpen,
    isResponseLengthDropdownOpen,
    setIsResponseLengthDropdownOpen,
    showAiSuggestions,
    setShowAiSuggestions,
    actionTypeDropdownRef,
    responseLengthDropdownRef,
    handleChoiceClick,
    handleSubmit,
  };
};
