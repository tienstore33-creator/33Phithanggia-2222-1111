
import React from 'react';
import { KnowledgeBase, StyleSettings, DIALOGUE_MARKER } from '../types';
import KeywordSpan from '../components/ui/KeywordSpan';
import { GameEntity, GameEntityType } from '../hooks/useGameplayModals';

const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const parseAndHighlightText = (
    textInput: string,
    kb: KnowledgeBase,
    styleSettings: StyleSettings,
    onKeywordClick: (event: React.MouseEvent<HTMLSpanElement>, entity: GameEntity, entityType: GameEntityType) => void,
    skipKeywords?: boolean
): React.ReactNode[] => {
    let text = textInput ? String(textInput) : "";
    if (!text) return [""];

    // Sửa lỗi cơ học: Thay thế các biến thể thô của DIALOGUE_MARKER (như $DIALOGUE_MARKER, {DIALOGUE_MARKER}, v.v.) thành ##
    text = text.replace(/\\?\$?\{?DIALOGUE_MARKER\}?/g, "##");

    const finalNodes: React.ReactNode[] = [];
    
    const dialogueHighlightStyle: React.CSSProperties = {};
    const dialogueSettings = styleSettings.dialogueHighlight;
    if (dialogueSettings) {
        if (dialogueSettings.textColor) dialogueHighlightStyle.color = dialogueSettings.textColor;
        if (dialogueSettings.fontFamily && dialogueSettings.fontFamily !== 'inherit') dialogueHighlightStyle.fontFamily = dialogueSettings.fontFamily;
        if (dialogueSettings.fontSize && dialogueSettings.fontSize !== 'inherit') dialogueHighlightStyle.fontSize = dialogueSettings.fontSize;
        if (dialogueSettings.backgroundColor && dialogueSettings.backgroundColor !== 'transparent') {
             dialogueHighlightStyle.backgroundColor = dialogueSettings.backgroundColor;
        } else {
             // Default bubble background if none set by user
             dialogueHighlightStyle.backgroundColor = 'rgba(0, 0, 0, 0.2)';
        }
    }
    
    const keywordHighlightStyle: React.CSSProperties = {};
    const keywordSettings = styleSettings.keywordHighlight;
    if (keywordSettings) {
        if (keywordSettings.textColor) keywordHighlightStyle.color = keywordSettings.textColor;
        if (keywordSettings.fontFamily && keywordSettings.fontFamily !== 'inherit') keywordHighlightStyle.fontFamily = keywordSettings.fontFamily;
        if (keywordSettings.fontSize && keywordSettings.fontSize !== 'inherit') keywordHighlightStyle.fontSize = keywordSettings.fontSize;
        if (keywordSettings.backgroundColor && keywordSettings.backgroundColor !== 'transparent') keywordHighlightStyle.backgroundColor = keywordSettings.backgroundColor;
    }

    const segments = text.split(DIALOGUE_MARKER);

    segments.forEach((segment, index) => {
        if (index % 2 === 1) {
            if (segment.length > 0) {
                // Apply Speech Bubble Styles
                const bubbleStyle: React.CSSProperties = {
                    ...dialogueHighlightStyle,
                    display: 'inline-block',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    border: `1px solid ${dialogueHighlightStyle.color || '#4ADE80'}`, // Border matches text color
                    margin: '2px 4px',
                    fontStyle: 'italic'
                };

                finalNodes.push(<span key={`dialogue-${finalNodes.length}`} style={bubbleStyle}>{segment}</span>);
            }
        } else {
            if (segment.length > 0) {
                const allKeywords: Array<{ name: string; type: GameEntityType; entity: GameEntity;}> = [];
                const playerName = kb.worldConfig?.playerName || kb.playerStats?.name;
                if (playerName && typeof playerName === 'string' && playerName.trim().length > 1) {
                    allKeywords.push({
                        name: playerName.trim(),
                        type: 'player',
                        entity: {
                            ...kb.playerStats,
                            entityType: 'player',
                            id: 'player',
                            name: playerName.trim()
                        } as any
                    });
                }
                kb.inventory.forEach(e => { if (typeof e.name === 'string' && e.name.trim().length > 2) allKeywords.push({ name: e.name.trim(), type: 'item', entity: e }); });
                kb.playerSkills.forEach(e => { if (typeof e.name === 'string' && e.name.trim().length > 2) allKeywords.push({ name: e.name.trim(), type: 'skill', entity: e }); });
                kb.allQuests.filter(q => q.status === 'active').forEach(e => { if (typeof e.title === 'string' && e.title.trim().length > 2) allKeywords.push({ name: e.title.trim(), type: 'quest', entity: e }); });
                kb.discoveredNPCs.forEach(e => { if (typeof e.name === 'string' && e.name.trim().length > 2) allKeywords.push({ name: e.name.trim(), type: 'npc', entity: e }); });
                kb.discoveredYeuThu.forEach(e => { if (typeof e.name === 'string' && e.name.trim().length > 2) allKeywords.push({ name: e.name.trim(), type: 'yeuThu', entity: e }); });
                kb.wives.forEach(e => { if (typeof e.name === 'string' && e.name.trim().length > 2) allKeywords.push({ name: e.name.trim(), type: 'wife', entity: e }); });
                kb.slaves.forEach(e => { if (typeof e.name === 'string' && e.name.trim().length > 2) allKeywords.push({ name: e.name.trim(), type: 'slave', entity: e }); });
                kb.prisoners.forEach(e => { if (typeof e.name === 'string' && e.name.trim().length > 2) allKeywords.push({ name: e.name.trim(), type: 'prisoner', entity: e }); });
                if (kb.master && typeof kb.master.name === 'string' && kb.master.name.trim().length > 2) allKeywords.push({ name: kb.master.name.trim(), type: 'master', entity: kb.master });
                if (kb.companions) {
                    kb.companions.forEach(e => { if (typeof e.name === 'string' && e.name.trim().length > 2) allKeywords.push({ name: e.name.trim(), type: 'companion', entity: e }); });
                }
                kb.discoveredLocations.forEach(e => { if (typeof e.name === 'string' && e.name.trim().length > 2) allKeywords.push({ name: e.name.trim(), type: 'location', entity: e }); });
                kb.worldLore.forEach(e => { if (typeof e.title === 'string' && e.title.trim().length > 2) allKeywords.push({ name: e.title.trim(), type: 'lore', entity: e }); });
                kb.discoveredFactions.forEach(e => { if (typeof e.name === 'string' && e.name.trim().length > 2) allKeywords.push({ name: e.name.trim(), type: 'faction', entity: e }); });

                if (allKeywords.length === 0 || skipKeywords) {
                    finalNodes.push(segment);
                } else {
                    allKeywords.sort((a, b) => b.name.length - a.name.length);
                    const keywordMap = new Map<string, { type: GameEntityType; entity: GameEntity }>();
                    allKeywords.forEach(kw => { if (!keywordMap.has(kw.name.toLowerCase())) keywordMap.set(kw.name.toLowerCase(), { type: kw.type, entity: kw.entity }); });
                    const uniqueNamesForRegex = Array.from(new Set(allKeywords.map(kw => escapeRegExp(kw.name))));

                    if (uniqueNamesForRegex.length === 0) {
                        finalNodes.push(segment);
                    } else {
                        const pattern = `\\b(${uniqueNamesForRegex.join('|')})\\b`;
                        const regex = new RegExp(pattern, 'gi');
                        
                        let lastIndex = 0;
                        let match;
                        while ((match = regex.exec(segment)) !== null) {
                            const keywordText = match[0];
                            const keywordInfo = keywordMap.get(keywordText.toLowerCase());
                            if (match.index > lastIndex) {
                                finalNodes.push(segment.substring(lastIndex, match.index));
                            }
                            if (keywordInfo) {
                                finalNodes.push(
                                <KeywordSpan
                                    key={`keyword-${keywordInfo.type}-${(keywordInfo.entity as any).id}-${finalNodes.length}`}
                                    keyword={keywordText}
                                    entityType={keywordInfo.type}
                                    entity={keywordInfo.entity}
                                    onClick={onKeywordClick}
                                    style={keywordHighlightStyle}
                                />
                                );
                            } else {
                                finalNodes.push(keywordText); 
                            }
                            lastIndex = regex.lastIndex;
                        }
                        if (lastIndex < segment.length) {
                            finalNodes.push(segment.substring(lastIndex));
                        }
                    }
                }
            }
        }
    });
    return finalNodes.length > 0 ? finalNodes : [""];
};
