
// FIX: Add React import to resolve namespace errors.
import React, { useCallback, useState } from 'react';
import { KnowledgeBase, GameMessage, GameScreen, Item, AuctionItem, AuctionCommentaryEntry, AuctionSlave, Slave, Prisoner, NPC } from '../../types';
import { generateAuctionData, runAuctionTurn, runAuctioneerCall, generateSlaveAuctionData, runSlaveAuctionTurn, runSlaveAuctioneerCall } from '../../services/geminiService';
import { extractSatelliteTags } from '../../services/satelliteTagExtractor';
import { performTagProcessing, calculateItemValue, calculateSlaveValue } from '../../utils/gameLogicUtils';
import { VIETNAMESE } from '../../constants';

interface UseAuctionActionsProps {
  knowledgeBase: KnowledgeBase;
  setKnowledgeBase: React.Dispatch<React.SetStateAction<KnowledgeBase>>;
  isLoadingApi: boolean;
  setIsLoadingApi: React.Dispatch<React.SetStateAction<boolean>>;
  resetApiError: () => void;
  showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  setCurrentScreen: (screen: GameScreen) => void;
  setSentEconomyPromptsLog: React.Dispatch<React.SetStateAction<string[]>>;
  setReceivedEconomyResponsesLog: React.Dispatch<React.SetStateAction<string[]>>;
  logNpcAvatarPromptCallback?: (prompt: string) => void;
  setApiErrorWithTimeout: (message: string | null) => void;
  addMessageAndUpdateState: (newMessages: GameMessage[], newKnowledgeBase: KnowledgeBase, startingCurrency?: number, callback?: () => void) => void;
}

const NPC_TAUNTS = [
    "Nhái con mà cũng đòi đập tiền à!",
    "Người mà dám trả thêm một xu nữa thì cẩn thận đường về!",
    "Vật này hôm nay ta phải giành được!",
    "Nếu các hạ ngừng tay thì tại hạ sẽ coi đó là một ân tình.",
    "Hút cạn gia sản ta cũng phải mua!",
    "Muốn thi gan với ta sao? Lên nữa đi!",
    "Có thế này cũng gọi là đấu giá sao? Trả thêm đi!"
];

const NPC_SLAVE_TAUNTS = [
    ...NPC_TAUNTS,
    "Hôm nay ta muốn lên giường với vưu vật này!",
    "Khụ khụ... Đỉnh lò này không tồi đâu, ta lấy!",
    "Tội nghiệp thay... nhưng nàng là của ta!",
    "Thật là một tuyệt sắc giai nhân, ta không thể nhường được!"
];

export const useAuctionActions = ({
    knowledgeBase,
    setKnowledgeBase,
    isLoadingApi,
    setIsLoadingApi,
    resetApiError,
    showNotification,
    setCurrentScreen,
    setSentEconomyPromptsLog,
    setReceivedEconomyResponsesLog,
    logNpcAvatarPromptCallback,
    setApiErrorWithTimeout,
    addMessageAndUpdateState,
}: UseAuctionActionsProps) => {

    const handleStartAuction = useCallback(async (locationId: string, playerItemIds: string[] = []) => {
        setIsLoadingApi(true);
        resetApiError();
        showNotification("Đang chuẩn bị phiên đấu giá...", 'info');
        
        let workingKb = JSON.parse(JSON.stringify(knowledgeBase));
        
        const playerAuctionItems: AuctionItem[] = [];
        if (playerItemIds.length > 0) {
            playerItemIds.forEach(itemId => {
                const item = workingKb.inventory.find((i: Item) => i.id === itemId);
                if (item) {
                    const itemValue = calculateItemValue(item, workingKb.realmProgressionList);
                    const originalStartingPrice = Math.floor(itemValue * 0.5);
                    const baitPriceRatio = Math.random() * 0.3 + 0.1; // 10% - 40%
                    const baitPrice = Math.floor(originalStartingPrice * baitPriceRatio);

                    const playerAuctionItem: AuctionItem = {
                        ...item,
                        ownerId: 'player', 
                        originalStartingPrice: originalStartingPrice,
                        baitPriceRatio: baitPriceRatio,
                        npcBidCount: 0,
                        startingPrice: baitPrice,
                        currentBid: baitPrice,
                        buyoutPrice: Math.floor(itemValue * 2.5),
                        highestBidderId: undefined,
                    };
                    playerAuctionItems.push(playerAuctionItem);
                }
            });
        }

        workingKb.auctionState = {
            isOpen: true,
            items: [],
            auctionNPCs: [],
            currentItemIndex: 0,
            auctioneerCommentary: [],
            lastBidTime: Date.now(),
            auctioneerCallCount: 0,
            secondCallCount: 0,
            itemExhausted: false,
            locationId: locationId,
        };

        try {
            const { response, rawText } = await generateAuctionData(
                workingKb,
                (prompt) => setSentEconomyPromptsLog(prev => [prompt, ...prev].slice(0, 10))
            );
            setReceivedEconomyResponsesLog(prev => [rawText, ...prev].slice(0, 10));

            const tagsToProcess = extractSatelliteTags(rawText, response?.tags);
            const { newKb, systemMessagesFromTags } = await performTagProcessing(
                workingKb, 
                tagsToProcess, 
                workingKb.playerStats.turn, 
                logNpcAvatarPromptCallback
            );
            
            workingKb = newKb;
            
            if (workingKb.auctionState) {
                workingKb.auctionState.items.push(...playerAuctionItems);
                workingKb.auctionState.items.sort(() => Math.random() - 0.5); // Shuffle all items
                
                if (!workingKb.auctionState.auctionNPCs || workingKb.auctionState.auctionNPCs.length === 0) {
                    workingKb.auctionState.auctionNPCs = [
                        { id: `backup-auc-npc-1-${Date.now()}`, name: 'Lý Phú Hộ', realm: 'Trúc Cơ Nhất Trọng', currency: 150000, personality: 'aggressive' },
                        { id: `backup-auc-npc-2-${Date.now()}`, name: 'Vạn Tam Thiên', realm: 'Trúc Cơ Cửu Trọng', currency: 350000, personality: 'high_roller' },
                        { id: `backup-auc-npc-3-${Date.now()}`, name: 'Yêu Nữ Áo Đỏ', realm: 'Luyện Khí Viên Mãn', currency: 90000, personality: 'cautious' },
                    ];
                }
            }

            if (workingKb.auctionState && workingKb.auctionState.items) {
                workingKb.auctionState.items.forEach((item: AuctionItem) => {
                    if (item.ownerId !== 'player') { // Only set prices for AI items
                        const itemValue = item.value || 0;
                        const originalStartingPrice = Math.floor(itemValue * 0.5);
                        const baitPriceRatio = Math.random() * 0.3 + 0.1; // 10% - 40%
                        const baitPrice = Math.floor(originalStartingPrice * baitPriceRatio);
                        
                        item.originalStartingPrice = originalStartingPrice;
                        item.baitPriceRatio = baitPriceRatio;
                        item.npcBidCount = 0;
                        item.startingPrice = baitPrice;
                        item.currentBid = baitPrice;
                        item.buyoutPrice = Math.floor(itemValue * 2.5);
                    }
                });
            }

            if(response.systemMessage) {
                 workingKb.auctionState!.auctioneerCommentary.push({ id: `commentary-init-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: response.systemMessage, timestamp: Date.now() });
            }
            
            setKnowledgeBase(workingKb);
            setCurrentScreen(GameScreen.Auction);

        } catch (error) {
            const errorMsg = `Lỗi chuẩn bị đấu giá: ${error instanceof Error ? error.message : String(error)}`;
            setApiErrorWithTimeout(errorMsg);
            setKnowledgeBase(prev => ({...prev, auctionState: null}));
        } finally {
            setIsLoadingApi(false);
        }
    }, [knowledgeBase, setKnowledgeBase, showNotification, setCurrentScreen, setSentEconomyPromptsLog, setReceivedEconomyResponsesLog, logNpcAvatarPromptCallback, setApiErrorWithTimeout, resetApiError, setIsLoadingApi]);

    const handlePlayerAuctionAction = useCallback(async (itemId: string, bidAmount: number) => {
        setIsLoadingApi(true);
        resetApiError();

        // Explicitly cast to AuctionItem since we know we are in standard auction
        const item = knowledgeBase.auctionState?.items.find(i => i.id === itemId) as AuctionItem | undefined;
        if (!item) {
            showNotification("Lỗi: Vật phẩm đấu giá không tồn tại.", 'error');
            setIsLoadingApi(false);
            return;
        }
        
        let workingKb = JSON.parse(JSON.stringify(knowledgeBase));
        
        if (workingKb.auctionState) {
            const itemIndex = workingKb.auctionState.items.findIndex((i: any) => i.id === itemId);
            if (itemIndex > -1) {
                workingKb.auctionState.items[itemIndex].currentBid = bidAmount;
                workingKb.auctionState.items[itemIndex].highestBidderId = 'player';
            }
            workingKb.auctionState.lastBidTime = Date.now();
            workingKb.auctionState.auctioneerCallCount = 0;
            const newCommentary: AuctionCommentaryEntry = {id: `player-bid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: `Bạn đã ra giá ${bidAmount.toLocaleString()}...`, timestamp: Date.now()};
            workingKb.auctionState.auctioneerCommentary.push(newCommentary);
        }
        setKnowledgeBase(workingKb);
        setIsLoadingApi(false);
    }, [knowledgeBase, setKnowledgeBase, showNotification, resetApiError, setIsLoadingApi]);

    const handleAuctioneerCall = useCallback(async () => {
        if (isLoadingApi || !knowledgeBase.auctionState || !knowledgeBase.auctionState.isOpen) return;
    
        setIsLoadingApi(true);
        const { currentItemIndex, auctioneerCallCount } = knowledgeBase.auctionState;
        let workingKb = JSON.parse(JSON.stringify(knowledgeBase));
        const items = workingKb.auctionState.items;
        const currentItem = items[currentItemIndex] as AuctionItem;
    
        const newCallCount = auctioneerCallCount + 1;
        const isExhausted = workingKb.auctionState.itemExhausted || ((workingKb.auctionState.secondCallCount || 0) >= 3 && newCallCount >= 3);
        if (isExhausted) {
            workingKb.auctionState.itemExhausted = true;
        }
    
        // Check if item should be sold
        if (newCallCount > 3) {
            const winnerId = currentItem.highestBidderId;
            const finalPrice = currentItem.currentBid;
            let systemMessageContent = "";
            const isPlayerOwner = currentItem.ownerId === 'player';
            const currencyName = workingKb.worldConfig?.currencyName || "Tiền";
    
            if (winnerId === 'player') {
                let wonSuccessfully = false;
                if (isPlayerOwner) {
                    const fee = Math.floor(finalPrice * 0.15);
                    if (workingKb.playerStats.currency >= fee) {
                        workingKb.playerStats.currency -= fee;
                        systemMessageContent = `Bạn đã mua lại vật phẩm của chính mình "${currentItem.name}" với giá ${finalPrice.toLocaleString()} ${currencyName}. Bạn đã trả một khoản phí 15% là ${fee.toLocaleString()} ${currencyName}.`;
                        showNotification(systemMessageContent, 'warning');
                        wonSuccessfully = true;
                    } else {
                        const itemIndex = workingKb.inventory.findIndex((i: Item) => i.id === currentItem.id);
                        if (itemIndex > -1) workingKb.inventory.splice(itemIndex, 1);
                        systemMessageContent = `Bạn đã thắng đấu giá vật phẩm của mình nhưng không đủ tiền trả phí! Nhà đấu giá đã tịch thu vật phẩm "${currentItem.name}".`;
                        showNotification(systemMessageContent, 'error');
                    }
                } else {
                    if (workingKb.playerStats.currency >= finalPrice) {
                        workingKb.playerStats.currency -= finalPrice;
                        const { startingPrice, currentBid, buyoutPrice, highestBidderId, ownerId, ...baseItem } = currentItem;
                        // FIX: Ensure baseItem has necessary Item properties
                        const newItemForInventory: Item = { ...baseItem, id: `item-${baseItem.name.replace(/\s/g, '-')}-${Date.now()}` } as Item;
                        const existingInvItem = workingKb.inventory.find((i: Item) => i.name === newItemForInventory.name && i.stackable !== false);
                        if (existingInvItem) {
                            existingInvItem.quantity += newItemForInventory.quantity;
                        } else {
                            workingKb.inventory.push(newItemForInventory);
                        }
                        systemMessageContent = `Chúc mừng! Bạn đã thắng đấu giá vật phẩm ${currentItem.name} với giá ${finalPrice.toLocaleString()} ${currencyName}.`;
                        showNotification(systemMessageContent, 'success');
                        wonSuccessfully = true;
                    } else {
                         systemMessageContent = `Bạn không đủ tiền để mua ${currentItem.name}. Vật phẩm được bán cho người trả giá cao thứ hai (nếu có) hoặc được giữ lại.`;
                         showNotification(systemMessageContent, 'error');
                    }
                }

                if (wonSuccessfully && Math.random() < 0.3) {
                    if (!workingKb.playerStats.activeStatusEffects) {
                        workingKb.playerStats.activeStatusEffects = [];
                    }
                    const debuffName = "Bị theo dõi sau đấu giá";
                    const newDebuff = {
                        id: `debuff-theo-doi-${Date.now()}`,
                        name: debuffName,
                        description: "Hành tung bị bại lộ sau đấu giá bảo vật, 50% nguy cơ gặp kịch bản chặn đường cướp bóc vô cùng nguy hiểm mỗi lượt chơi.",
                        type: 'debuff' as const,
                        durationTurns: 5,
                        statModifiers: {},
                        specialEffects: ['stalked_after_auction'],
                    };
                    workingKb.playerStats.activeStatusEffects = [
                        ...workingKb.playerStats.activeStatusEffects.filter((eff: any) => eff.name !== debuffName),
                        newDebuff
                    ];
                    workingKb.auctionState.auctioneerCommentary.push({
                        id: `debuff-commentary-${Date.now()}`,
                        text: `Có vẻ như bạn đã bị một số luồng nhãn thần bất thiện dòm ngó... Nhận ẩn trạng [${debuffName}]!`,
                        timestamp: Date.now()
                    });
                }
            } else { // An NPC won
                const winnerName = workingKb.auctionState?.auctionNPCs.find((n: any) => n.id === winnerId)?.name || workingKb.discoveredNPCs.find((n: any) => n.id === winnerId)?.name || 'một người mua bí ẩn';
                if (isPlayerOwner) {
                    const profit = Math.floor(finalPrice * 0.85);
                    workingKb.playerStats.currency += profit;
                    const itemIndex = workingKb.inventory.findIndex((i: Item) => i.id === currentItem.id);
                    if (itemIndex > -1) workingKb.inventory.splice(itemIndex, 1);
                    systemMessageContent = `Vật phẩm của bạn, "${currentItem.name}", đã được bán cho ${winnerName} với giá ${finalPrice.toLocaleString()} ${currencyName}. Sau khi trừ phí, bạn nhận được ${profit.toLocaleString()} ${currencyName}.`;
                    showNotification(systemMessageContent, 'success');
                } else {
                    systemMessageContent = `Vật phẩm ${currentItem.name} đã được bán cho ${winnerName} với giá ${finalPrice.toLocaleString()} ${currencyName}.`;
                    showNotification(systemMessageContent, 'info');
                }
            }
            
            const nextItemIndex = currentItemIndex + 1;
            if (nextItemIndex >= items.length) {
                workingKb.auctionState.isOpen = false;
                workingKb.auctionState.auctioneerCommentary.push({id: `commentary-end-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: "Phiên đấu giá đã kết thúc! Cảm ơn quý vị đã tham gia.", timestamp: Date.now()});
            } else {
                workingKb.auctionState.currentItemIndex = nextItemIndex;
                workingKb.auctionState.auctioneerCallCount = 0;
                workingKb.auctionState.secondCallCount = 0;
                workingKb.auctionState.itemExhausted = false;
                workingKb.auctionState.lastBidTime = Date.now();
                // Cast next item to get name
                const nextItem = items[nextItemIndex] as AuctionItem | AuctionSlave;
                workingKb.auctionState.auctioneerCommentary.push({id: `commentary-next-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: `Tiếp theo là vật phẩm: ${nextItem.name}!`, timestamp: Date.now()});
            }
            
            const winnerName = winnerId ? (workingKb.auctionState?.auctionNPCs.find((n: any) => n.id === winnerId)?.name || workingKb.discoveredNPCs.find((n: any) => n.id === winnerId)?.name || 'một người mua bí ẩn') : '';
            const playerName = workingKb.worldConfig?.playerName || "Người chơi";

            const transactionStatus = winnerId === 'player'
                ? (isPlayerOwner ? `${playerName} mua lại vật phẩm của chính mình (có trừ phí 15%)` : `${playerName} mua thành công`)
                : (winnerId ? (isPlayerOwner ? `${playerName} bán thành công vật phẩm cho ${winnerName}` : `NPC khác đấu giá thắng (${winnerName})`) : "Không có ai mua (vật phẩm bị thu hồi hoặc trả lại)");

            const summaryTitle = (isPlayerOwner && winnerId && winnerId !== 'player') ? '[TỔNG KẾT BÁN VẬT PHẨM ĐẤU GIÁ]' : '[TỔNG KẾT ĐẤU GIÁ VẬT PHẨM]';
            const inGameDateStr = `Ngày ${workingKb.worldDate?.day || 1} Tháng ${workingKb.worldDate?.month || 1} Năm ${workingKb.worldDate?.year || 1} (${workingKb.worldDate?.timeOfDay || 'Sáng'})`;
            const auctionLocation = workingKb.auctionState?.locationId || "Sảnh Đấu Giá Bảo Vật";

            const detailForAi = (winnerId === 'player' && !isPlayerOwner) 
                ? `AI mô tả MC thắng đấu giá vật phẩm ${currentItem.name} với giá ${finalPrice.toLocaleString()} ${currencyName}.`
                : (winnerId === 'player' && isPlayerOwner)
                ? `AI mô tả MC mua lại vật phẩm của chính mình.`
                : (isPlayerOwner && winnerId)
                ? `AI mô tả MC bán thành công vật phẩm "${currentItem.name}" cho ${winnerName} với giá ${finalPrice.toLocaleString()} ${currencyName}.`
                : systemMessageContent;

            const eventSummaryContent = `${summaryTitle}
- Số lượt chơi hiện tại (turnNumber): Lượt ${workingKb.playerStats.turn}
- Ngày tháng giao dịch: ${inGameDateStr}
- Địa điểm giao dịch: ${auctionLocation}
- Tên vật phẩm đã giao dịch: ${currentItem.name} (Độ hiếm: ${currentItem.rarity || 'Thường'})
- Mức giá cuối cùng (finalPrice): ${finalPrice.toLocaleString()} ${currencyName}
- Trạng thái giao dịch: ${transactionStatus}

Chi tiết diễn biến: ${detailForAi}`;

            setKnowledgeBase(workingKb); 
            addMessageAndUpdateState([{
                id: `auction-sold-${currentItem.id}`,
                type: 'event_summary',
                content: eventSummaryContent,
                timestamp: Date.now(),
                turnNumber: workingKb.playerStats.turn
            }], workingKb);
    
            setIsLoadingApi(false);
            return;
        }
    
        const onPromptConstructedForLog = (prompt: string) => {
            setSentEconomyPromptsLog(prev => [prompt, ...prev].slice(0, 10));
        };

        // mechanical logic with NPC Personalities, Budgets, and Proxy Bids
        let chosenNpc: any = null;
        let chosenNpcBid = 0;
        let personalityUsed = 'high_roller';
        let over3xBuyout = false;
        
        if (currentItem.highestBidderId === 'player' && currentItem.currentBid >= currentItem.buyoutPrice * 3) {
            over3xBuyout = true;
        }

        const npcs = workingKb.auctionState.auctionNPCs || [];
        if (!isExhausted && !over3xBuyout && currentItem.highestBidderId !== 'system' && npcs.length > 0) {
            // Filter candidates based on budget and personality limits
            const candidates = npcs.filter((npc: any) => {
                if (currentItem.highestBidderId === npc.id) return false;
                
                const minExpectedBid = Math.floor(currentItem.currentBid * 1.02);
                if (npc.currency < minExpectedBid) return false;

                const npcPers = npc.personality || 'high_roller';
                if (npcPers === 'cautious') {
                    if (currentItem.currentBid > 1.2 * currentItem.buyoutPrice) {
                        return false;
                    }
                }
                return true;
            });

            // Shuffle candidates to give everyone equal randomized opportunity
            const shuffledCandidates = [...candidates].sort(() => Math.random() - 0.5);

            for (const npc of shuffledCandidates) {
                const npcPers = npc.personality || 'high_roller';
                const npcBidCount = currentItem.npcBidCount || 0;
                const ratio = currentItem.baitPriceRatio || 0.1;
                const baseChance = 1 - ratio;
                
                let actualChance = baseChance;
                if (npcPers === 'high_roller') {
                    // High roller ignores npcBidCount degradation
                    actualChance = baseChance;
                } else if (npcPers === 'aggressive') {
                    actualChance = baseChance - (0.04 * npcBidCount);
                } else if (npcPers === 'cautious') {
                    actualChance = baseChance - (0.08 * npcBidCount);
                }

                if (actualChance < 0.05) actualChance = 0.05;

                if (Math.random() < actualChance) {
                    let mult = 1.05;
                    if (npcPers === 'aggressive') {
                        mult = 1.10 + Math.random() * 0.05;
                    } else if (npcPers === 'cautious') {
                        mult = 1.02 + Math.random() * 0.01;
                    } else {
                        mult = 1.05 + Math.random() * 0.03;
                    }

                    let nextBid = Math.floor(currentItem.currentBid * mult);
                    if (nextBid <= currentItem.currentBid) {
                        nextBid = currentItem.currentBid + Math.ceil(currentItem.currentBid * 0.02);
                    }

                    if (nextBid > npc.currency) {
                        nextBid = npc.currency;
                    }

                    if (nextBid > currentItem.currentBid) {
                        chosenNpc = npc;
                        chosenNpcBid = nextBid;
                        personalityUsed = npcPers;
                        break;
                    }
                }
            }
        }

        if (chosenNpc) {
            const currencyName = workingKb.worldConfig?.currencyName || "Nguyên";
            const taunt = Math.random() < 0.6 ? NPC_TAUNTS[Math.floor(Math.random() * NPC_TAUNTS.length)] : null;
            
            const persLabel = personalityUsed === 'aggressive' ? 'Hùng Hổ' : personalityUsed === 'cautious' ? 'Dè Dặt' : 'Đại Gia';
            let message = `[${chosenNpc.name}] (${persLabel}) tung tiền ra giá ${chosenNpcBid.toLocaleString()} ${currencyName}!`;
            if (taunt) message += ` Khách lớn giọng: "${taunt}"`;
            
            workingKb.auctionState.auctioneerCommentary.push({id: `npc-bid-${chosenNpc.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: message, timestamp: Date.now()});

            // Proxy Bidding check
            const proxyLimit = currentItem.playerMaxBidLimit;
            if (proxyLimit && proxyLimit > 0) {
                const proxyBiddingExpectedPrice = Math.floor(chosenNpcBid * 1.05);
                if (proxyBiddingExpectedPrice <= proxyLimit && workingKb.playerStats.currency >= proxyBiddingExpectedPrice) {
                    currentItem.currentBid = proxyBiddingExpectedPrice;
                    currentItem.highestBidderId = 'player';
                    currentItem.npcBidCount = (currentItem.npcBidCount || 0) + 1;
                    
                    workingKb.auctionState.lastBidTime = Date.now();
                    workingKb.auctionState.auctioneerCallCount = 0;
                    
                    const proxyMessage = `[Uỷ thác] Hệ thống tự động đặt thầu thay bạn ở mức ${proxyBiddingExpectedPrice.toLocaleString()} ${currencyName}! (Đã thiết lập giá tối đa: ${proxyLimit.toLocaleString()} ${currencyName})`;
                    workingKb.auctionState.auctioneerCommentary.push({id: `proxy-bid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: proxyMessage, timestamp: Date.now()});
                } else {
                    currentItem.currentBid = chosenNpcBid;
                    currentItem.highestBidderId = chosenNpc.id;
                    currentItem.npcBidCount = (currentItem.npcBidCount || 0) + 1;
                    
                    workingKb.auctionState.lastBidTime = Date.now();
                    workingKb.auctionState.auctioneerCallCount = 0;
                    
                    const failReason = workingKb.playerStats.currency < proxyBiddingExpectedPrice
                        ? "Số dư linh thạch của bạn không đủ để tự động theo thầu!"
                        : "Giá thầu mới đã vượt quá giới hạn ủy thác thầu của bạn!";
                    const warnMessage = `[Uỷ thác] Dừng đặt thầu tự động! Lý do: ${failReason}`;
                    workingKb.auctionState.auctioneerCommentary.push({id: `proxy-fail-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: warnMessage, timestamp: Date.now()});
                }
            } else {
                currentItem.currentBid = chosenNpcBid;
                currentItem.highestBidderId = chosenNpc.id;
                currentItem.npcBidCount = (currentItem.npcBidCount || 0) + 1;
                
                workingKb.auctionState.lastBidTime = Date.now();
                workingKb.auctionState.auctioneerCallCount = 0;
            }
        } else {
            workingKb.auctionState.auctioneerCallCount = newCallCount;
            if (newCallCount === 2) {
                workingKb.auctionState.secondCallCount = (workingKb.auctionState.secondCallCount || 0) + 1;
            }
            const currencyName = workingKb.worldConfig?.currencyName || "Nguyên";
            let hammerMsg = `Đấu giá sư: "${currentItem.currentBid.toLocaleString()} ${currencyName} lần thứ ${newCallCount}..."`;
            if (over3xBuyout) {
                hammerMsg = `Đấu giá sư run rẩy: "Đã vượt xa giá trị... Không ai dám theo nữa! Lần thứ ${newCallCount}!"`;
            } else if (isExhausted) {
                hammerMsg = `Đấu giá sư dõng dạc: "${currentItem.currentBid.toLocaleString()} ${currencyName} lần thứ ba (lần cuối cùng)!"`;
            }
            workingKb.auctionState.auctioneerCommentary.push({id: `hammer-${newCallCount}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: hammerMsg, timestamp: Date.now()});
        }

        setKnowledgeBase(workingKb);
        setIsLoadingApi(false);
    }, [knowledgeBase, addMessageAndUpdateState, setKnowledgeBase, showNotification, setApiErrorWithTimeout, setIsLoadingApi]);
  
    const handleSkipAuctionItem = useCallback(async () => {
        if (isLoadingApi || !knowledgeBase.auctionState || !knowledgeBase.auctionState.isOpen) return;

        setIsLoadingApi(true);

        let workingKb = JSON.parse(JSON.stringify(knowledgeBase)) as KnowledgeBase;
        const { items, currentItemIndex } = workingKb.auctionState!;
        const nextItemIndex = currentItemIndex + 1;
        // Cast to get name
        const currentItem = items[currentItemIndex] as AuctionItem | AuctionSlave;
        let systemMessageContent = `Bạn đã bỏ qua vật phẩm "${currentItem.name}".`;

        if (nextItemIndex >= items.length) {
            // End of auction
            workingKb.auctionState!.isOpen = false;
            workingKb.auctionState!.auctioneerCommentary.push({ id: `skip-end-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: "Phiên đấu giá đã kết thúc! Cảm ơn quý vị đã tham gia.", timestamp: Date.now() });
            systemMessageContent += " Đây là vật phẩm cuối cùng, phiên đấu giá kết thúc.";
        } else {
            // Move to next item
            workingKb.auctionState!.currentItemIndex = nextItemIndex;
            workingKb.auctionState!.auctioneerCallCount = 0;
            workingKb.auctionState!.lastBidTime = Date.now();
            const nextItem = items[nextItemIndex] as AuctionItem | AuctionSlave;
            const commentaryText = `Bỏ qua vật phẩm trước. Tiếp theo là: ${nextItem.name}! Giá khởi điểm ${nextItem.startingPrice.toLocaleString()} ${workingKb.worldConfig?.currencyName || "Tiền"}.`;
            workingKb.auctionState!.auctioneerCommentary.push({ id: `skip-next-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: commentaryText, timestamp: Date.now() });
            systemMessageContent += ` Chuyển sang vật phẩm tiếp theo: ${nextItem.name}.`;
        }
        
        setKnowledgeBase(workingKb); 
        addMessageAndUpdateState([{
            id: `auction-skipped-${currentItem.id}`,
            type: 'system',
            content: systemMessageContent,
            timestamp: Date.now(),
            turnNumber: workingKb.playerStats.turn
        }], workingKb);

        setIsLoadingApi(false);

    }, [knowledgeBase, setKnowledgeBase, addMessageAndUpdateState, setIsLoadingApi, isLoadingApi]);
  
    const handleSetPlayerMaxBid = useCallback((maxBid: number) => {
        let workingKb = JSON.parse(JSON.stringify(knowledgeBase)) as KnowledgeBase;
        const state = workingKb.auctionState;
        if (!state) return;
        const item = state.items[state.currentItemIndex];
        if (!item) return;
        
        item.playerMaxBidLimit = maxBid;
        setKnowledgeBase(workingKb);
        showNotification(`Đã thiết lập uỷ thác tự động đặt giá tối đa đến ${maxBid.toLocaleString()} cho vật phẩm này.`, 'success');
    }, [knowledgeBase, setKnowledgeBase, showNotification]);

    const handleInfluenceBaitRatio = useCallback((type: 'rumor' | 'trap') => {
        let workingKb = JSON.parse(JSON.stringify(knowledgeBase)) as KnowledgeBase;
        const state = workingKb.auctionState;
        if (!state) return;
        const item = state.items[state.currentItemIndex];
        if (!item) return;

        const cost = type === 'rumor' ? 1000 : 1500;
        const currencyName = workingKb.worldConfig?.currencyName || "Nguyên";
        if (workingKb.playerStats.currency < cost) {
            showNotification(`Bạn không đủ ${cost} ${currencyName} để sử dụng kỹ năng này!`, 'error');
            return;
        }

        // Deduct cost
        workingKb.playerStats.currency -= cost;

        if (type === 'rumor') {
            item.baitPriceRatio = Math.max(0.01, (item.baitPriceRatio || 0.1) - 0.15);
            const msg = `[Mưu mẹo] Bạn chi thêm ${cost.toLocaleString()} ${currencyName} phao tin đồn thổi! Đấu giá sư la lớn: "Nghe đồn món bảo vật này chứa đại bí mật thượng cổ!" Các NPC hăng máu chấn động, tăng mạnh ý định ra giá thầu!`;
            state.auctioneerCommentary.push({ id: `rumor-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: msg, timestamp: Date.now() });
        } else {
            item.baitPriceRatio = Math.min(0.9, (item.baitPriceRatio || 0.1) + 0.20);
            const msg = `[Mưu mẹo] Bạn chi thêm ${cost.toLocaleString()} ${currencyName} gài bẫy tì vết! Đấu giá sư ngập ngừng: "Có người truyền âm báo vật phẩm này tựa hồ có chút lỗi khuyết..." Quần hùng do dự, có xu hướng rút lui thầu sớm!`;
            state.auctioneerCommentary.push({ id: `trap-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: msg, timestamp: Date.now() });
        }

        setKnowledgeBase(workingKb);
        showNotification(`Sử dụng mưu mẹo đấu giá thành công!`, 'success');
    }, [knowledgeBase, setKnowledgeBase, showNotification]);

  return {
    handleStartAuction,
    handlePlayerAuctionAction,
    handleAuctioneerCall,
    handleSkipAuctionItem,
    handleSetPlayerMaxBid,
    handleInfluenceBaitRatio,
  };
};

export const useSlaveAuctionActions = ({
    knowledgeBase,
    setKnowledgeBase,
    isLoadingApi,
    setIsLoadingApi,
    resetApiError,
    showNotification,
    setCurrentScreen,
    setSentEconomyPromptsLog,
    setReceivedEconomyResponsesLog,
    logNpcAvatarPromptCallback,
    setApiErrorWithTimeout,
    addMessageAndUpdateState,
}: UseAuctionActionsProps) => {

    const handleStartSlaveAuction = useCallback(async (locationId: string, playerSlaveIds: string[] = []) => {
        setIsLoadingApi(true);
        resetApiError();
        showNotification("Đang chuẩn bị phiên đấu giá nô lệ...", 'info');
        
        let workingKb = JSON.parse(JSON.stringify(knowledgeBase));

        const playerAuctionSlaves: AuctionSlave[] = [];
        if (playerSlaveIds.length > 0) {
            playerSlaveIds.forEach(slaveId => {
                const slaveIndex = workingKb.slaves.findIndex((s: Slave) => s.id === slaveId);
                if (slaveIndex > -1) {
                    const slave = workingKb.slaves[slaveIndex];
                    const slaveRaceSystem = workingKb.worldConfig?.raceCultivationSystems.find((rs: { raceName: any; }) => rs.raceName === slave.race)?.realmSystem || workingKb.realmProgressionList.join(' - ');
                    const slaveRealmProgression = slaveRaceSystem.split(' - ').map((s: string) => s.trim());
                    const slaveValue = calculateSlaveValue(slave, slaveRealmProgression);
                    const originalStartingPrice = Math.floor(slaveValue * 0.5);
                    const baitPriceRatio = Math.random() * 0.3 + 0.1;
                    const baitPrice = Math.floor(originalStartingPrice * baitPriceRatio);
                    
                    const playerAuctionSlave: AuctionSlave = {
                        ...slave,
                        ownerId: 'player', 
                        value: slaveValue,
                        originalStartingPrice: originalStartingPrice,
                        baitPriceRatio: baitPriceRatio,
                        npcBidCount: 0,
                        startingPrice: baitPrice,
                        currentBid: baitPrice,
                        buyoutPrice: Math.floor(slaveValue * 2.5),
                        highestBidderId: undefined,
                    };
                    playerAuctionSlaves.push(playerAuctionSlave);
                    // Remove slave from player's list to prevent them being sold twice
                    workingKb.slaves.splice(slaveIndex, 1);
                }
            });
        }
        
        workingKb.slaveAuctionState = {
            isOpen: true,
            items: [],
            auctionNPCs: [],
            currentItemIndex: 0,
            auctioneerCommentary: [],
            lastBidTime: Date.now(),
            auctioneerCallCount: 0,
            secondCallCount: 0,
            itemExhausted: false,
            locationId: locationId,
        };
    
        try {
            const { response, rawText } = await generateSlaveAuctionData(
                workingKb,
                (prompt) => setSentEconomyPromptsLog(prev => [prompt, ...prev].slice(0, 10))
            );
            setReceivedEconomyResponsesLog(prev => [rawText, ...prev].slice(0, 10));
    
            const slaveTagsToProcess = extractSatelliteTags(rawText, response?.tags);
            const { newKb, systemMessagesFromTags } = await performTagProcessing(
                workingKb, 
                slaveTagsToProcess, 
                workingKb.playerStats.turn, 
                logNpcAvatarPromptCallback
            );
            
            workingKb = newKb;
    
            if (workingKb.slaveAuctionState) {
                workingKb.slaveAuctionState.items.push(...playerAuctionSlaves);
                workingKb.slaveAuctionState.items.sort(() => Math.random() - 0.5); // Shuffle all items
                
                if (!workingKb.slaveAuctionState.auctionNPCs || workingKb.slaveAuctionState.auctionNPCs.length === 0) {
                    workingKb.slaveAuctionState.auctionNPCs = [
                        { id: `backup-slave-npc-1-${Date.now()}`, name: 'Ma công tử', realm: 'Trúc Cơ Nhị Trọng', currency: 180000, personality: 'high_roller' },
                        { id: `backup-slave-npc-2-${Date.now()}`, name: 'Điền Viên Ngoại', realm: 'Phàm Nhân', currency: 80000, personality: 'cautious' },
                        { id: `backup-slave-npc-3-${Date.now()}`, name: 'Lý Trưởng Lão', realm: 'Trúc Cơ Ngũ Trọng', currency: 250000, personality: 'aggressive' },
                    ];
                }
            }

            if (response.systemMessage) {
                 workingKb.slaveAuctionState!.auctioneerCommentary.push({ id: `slave-commentary-init-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: response.systemMessage, timestamp: Date.now() });
            }
            
            setKnowledgeBase(workingKb);
            setCurrentScreen(GameScreen.SlaveAuction);
    
        } catch (error) {
            const errorMsg = `Lỗi chuẩn bị đấu giá nô lệ: ${error instanceof Error ? error.message : String(error)}`;
            setApiErrorWithTimeout(errorMsg);
            setKnowledgeBase(prev => ({...prev, slaveAuctionState: null}));
        } finally {
            setIsLoadingApi(false);
        }
    }, [knowledgeBase, setIsLoadingApi, resetApiError, showNotification, setSentEconomyPromptsLog, setReceivedEconomyResponsesLog, setKnowledgeBase, logNpcAvatarPromptCallback, setCurrentScreen, setApiErrorWithTimeout]);
    
    const handlePlayerSlaveAuctionAction = useCallback(async (slaveId: string, bidAmount: number) => {
        setIsLoadingApi(true);
        resetApiError();
    
        // Explicitly cast to AuctionSlave
        const item = knowledgeBase.slaveAuctionState?.items.find(i => i.id === slaveId) as AuctionSlave | undefined;
        if (!item) {
            showNotification("Lỗi: Nô lệ đấu giá không tồn tại.", 'error');
            setIsLoadingApi(false);
            return;
        }
        
        let workingKb = JSON.parse(JSON.stringify(knowledgeBase));
        
        if (workingKb.slaveAuctionState) {
            const itemIndex = workingKb.slaveAuctionState.items.findIndex((i: any) => i.id === slaveId);
            if (itemIndex > -1) {
                workingKb.slaveAuctionState.items[itemIndex].currentBid = bidAmount;
                workingKb.slaveAuctionState.items[itemIndex].highestBidderId = 'player';
            }
            workingKb.slaveAuctionState.lastBidTime = Date.now();
            workingKb.slaveAuctionState.auctioneerCallCount = 0;
            const newCommentary: AuctionCommentaryEntry = {id: `player-slave-bid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: `Bạn kiên định ra giá ${bidAmount.toLocaleString()}...`, timestamp: Date.now()};
            workingKb.slaveAuctionState.auctioneerCommentary.push(newCommentary);
        }
        setKnowledgeBase(workingKb);
        setIsLoadingApi(false);
    }, [knowledgeBase, setKnowledgeBase, showNotification, resetApiError, setIsLoadingApi]);
    
    const handleSlaveAuctioneerCall = useCallback(async () => {
        if (isLoadingApi || !knowledgeBase.slaveAuctionState || !knowledgeBase.slaveAuctionState.isOpen) return;
    
        setIsLoadingApi(true);
        const { currentItemIndex, auctioneerCallCount } = knowledgeBase.slaveAuctionState;
        let workingKb = JSON.parse(JSON.stringify(knowledgeBase));
        const items = workingKb.slaveAuctionState.items;
        const currentItem = items[currentItemIndex] as AuctionSlave;
    
        const newCallCount = auctioneerCallCount + 1;
        const isExhausted = workingKb.slaveAuctionState.itemExhausted || ((workingKb.slaveAuctionState.secondCallCount || 0) >= 3 && newCallCount >= 3);
        if (isExhausted) {
            workingKb.slaveAuctionState.itemExhausted = true;
        }
    
        if (newCallCount > 3) {
            const winnerId = currentItem.highestBidderId;
            const finalPrice = currentItem.currentBid;
            let systemMessageContent = "";
            const isPlayerOwner = currentItem.ownerId === 'player';
            const currencyName = workingKb.worldConfig?.currencyName || "Tiền";
    
            if (winnerId === 'player') {
                let wonSuccessfully = false;
                if (isPlayerOwner) {
                    const fee = Math.floor(finalPrice * 0.15);
                    if (workingKb.playerStats.currency >= fee) {
                        workingKb.playerStats.currency -= fee;
                        const { startingPrice, currentBid, buyoutPrice, highestBidderId, ownerId, ...baseSlave } = currentItem;
                        workingKb.slaves.push(baseSlave);
                        systemMessageContent = `Bạn đã mua lại nô lệ của chính mình "${currentItem.name}" với giá ${finalPrice.toLocaleString()} ${currencyName}. Bạn đã trả một khoản phí 15% là ${fee.toLocaleString()} ${currencyName}.`;
                        showNotification(systemMessageContent, 'warning');
                        wonSuccessfully = true;
                    } else {
                        systemMessageContent = `Bạn đã thắng đấu giá nô lệ của mình nhưng không đủ tiền trả phí! Nhà đấu giá đã tịch thu nô lệ "${currentItem.name}".`;
                        showNotification(systemMessageContent, 'error');
                    }
                } else {
                    if (workingKb.playerStats.currency >= finalPrice) {
                        workingKb.playerStats.currency -= finalPrice;
                        const { startingPrice, currentBid, buyoutPrice, highestBidderId, ownerId, ...baseSlave } = currentItem;
                        const newSlaveForPlayer: Slave = { ...baseSlave, id: `slave-${baseSlave.name.replace(/\s/g, '-')}-${Date.now()}`};
                        workingKb.slaves.push(newSlaveForPlayer);
                        systemMessageContent = `Chúc mừng! Bạn đã thắng đấu giá nô lệ ${currentItem.name} với giá ${finalPrice.toLocaleString()} ${currencyName}.`;
                        showNotification(systemMessageContent, 'success');
                        wonSuccessfully = true;
                    } else {
                         systemMessageContent = `Bạn không đủ tiền để mua ${currentItem.name}.`;
                         showNotification(systemMessageContent, 'error');
                    }
                }

                if (wonSuccessfully && Math.random() < 0.3) {
                    if (!workingKb.playerStats.activeStatusEffects) {
                        workingKb.playerStats.activeStatusEffects = [];
                    }
                    const debuffName = "Bị theo dõi sau đấu giá";
                    const newDebuff = {
                        id: `debuff-theo-doi-${Date.now()}`,
                        name: debuffName,
                        description: "Hành tung bị bại lộ sau đấu giá bảo vật, 50% nguy cơ gặp kịch bản chặn đường cướp bóc vô cùng nguy hiểm mỗi lượt chơi.",
                        type: 'debuff' as const,
                        durationTurns: 5,
                        statModifiers: {},
                        specialEffects: ['stalked_after_auction'],
                    };
                    workingKb.playerStats.activeStatusEffects = [
                        ...workingKb.playerStats.activeStatusEffects.filter((eff: any) => eff.name !== debuffName),
                        newDebuff
                    ];
                    workingKb.slaveAuctionState.auctioneerCommentary.push({
                        id: `debuff-commentary-${Date.now()}`,
                        text: `Có vẻ như bạn đã bị một số luồng nhãn thần bất thiện dòm ngó... Nhận ẩn trạng [${debuffName}]!`,
                        timestamp: Date.now()
                    });
                }
            } else if (winnerId) {
                const winnerName = workingKb.slaveAuctionState?.auctionNPCs.find((n: any) => n.id === winnerId)?.name || 'một người mua bí ẩn';
                if (isPlayerOwner) {
                    const profit = Math.floor(finalPrice * 0.85);
                    workingKb.playerStats.currency += profit;
                    systemMessageContent = `Nô lệ của bạn, "${currentItem.name}", đã được bán cho ${winnerName} với giá ${finalPrice.toLocaleString()} ${currencyName}. Sau khi trừ phí, bạn nhận được ${profit.toLocaleString()} ${currencyName}.`;
                    showNotification(systemMessageContent, 'success');
                } else {
                    systemMessageContent = `Nô lệ ${currentItem.name} đã được bán cho ${winnerName} với giá ${finalPrice.toLocaleString()} ${currencyName}.`;
                    showNotification(systemMessageContent, 'info');
                }
            } else {
                if (isPlayerOwner) {
                    const { startingPrice, currentBid, buyoutPrice, highestBidderId, ownerId, ...baseSlave } = currentItem;
                    workingKb.slaves.push(baseSlave);
                    systemMessageContent = `Không ai trả giá cho nô lệ "${currentItem.name}" của bạn. Nô lệ được trả lại cho bạn.`;
                } else {
                    systemMessageContent = `Không ai trả giá cho ${currentItem.name}. Vật phẩm bị thu hồi.`
                }
                showNotification(systemMessageContent, 'info');
            }
            
            const nextItemIndex = currentItemIndex + 1;
            if (nextItemIndex >= items.length) {
                workingKb.slaveAuctionState.isOpen = false;
                workingKb.slaveAuctionState.auctioneerCommentary.push({id: `slave-commentary-end-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: "Phiên đấu giá đã kết thúc! Cảm ơn quý vị đã tham gia.", timestamp: Date.now()});
            } else {
                workingKb.slaveAuctionState.currentItemIndex = nextItemIndex;
                workingKb.slaveAuctionState.auctioneerCallCount = 0;
                workingKb.slaveAuctionState.secondCallCount = 0;
                workingKb.slaveAuctionState.itemExhausted = false;
                workingKb.slaveAuctionState.lastBidTime = Date.now();
                const nextItem = items[nextItemIndex] as AuctionSlave;
                workingKb.slaveAuctionState.auctioneerCommentary.push({id: `slave-commentary-next-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: `Tiếp theo là: ${nextItem.name}!`, timestamp: Date.now()});
            }
            
            const winnerName = winnerId ? (workingKb.slaveAuctionState?.auctionNPCs.find((n: any) => n.id === winnerId)?.name || 'một người mua bí ẩn') : '';
            const playerName = workingKb.worldConfig?.playerName || "Người chơi";

            const transactionStatus = winnerId === 'player'
                ? (isPlayerOwner ? `${playerName} mua lại nô lệ của chính mình (có trừ phí 15%)` : `${playerName} mua thành công`)
                : (winnerId ? (isPlayerOwner ? `${playerName} bán thành công nô lệ cho ${winnerName}` : `NPC khác đấu giá thắng (${winnerName})`) : "Không có ai mua (vật phẩm bị thu hồi hoặc trả lại)");

            const summaryTitle = (isPlayerOwner && winnerId && winnerId !== 'player') ? '[TỔNG KẾT BÁN NÔ LỆ ĐẤU GIÁ]' : '[TỔNG KẾT ĐẤU GIÁ NÔ LỆ]';
            const inGameDateStr = `Ngày ${workingKb.worldDate?.day || 1} Tháng ${workingKb.worldDate?.month || 1} Năm ${workingKb.worldDate?.year || 1} (${workingKb.worldDate?.timeOfDay || 'Sáng'})`;
            const slaveGender = currentItem.gender || "Không rõ";
            const auctionLocation = workingKb.slaveAuctionState?.locationId || "Sảnh Đấu Giá Nô Lệ";

            const detailForAi = (winnerId === 'player' && !isPlayerOwner) 
                ? `AI mô tả MC thắng đấu giá nô lệ ${currentItem.name} với giá ${finalPrice.toLocaleString()} ${currencyName}.`
                : (winnerId === 'player' && isPlayerOwner)
                ? `AI mô tả MC mua lại nô lệ của chính mình.`
                : (isPlayerOwner && winnerId)
                ? `AI mô tả MC bán thành công nô lệ "${currentItem.name}" cho ${winnerName} với giá ${finalPrice.toLocaleString()} ${currencyName}.`
                : systemMessageContent;

            const eventSummaryContent = `${summaryTitle}
- Số lượt chơi hiện tại (turnNumber): Lượt ${workingKb.playerStats.turn}
- Ngày tháng giao dịch: ${inGameDateStr}
- Địa điểm giao dịch: ${auctionLocation}
- Tên nô lệ đã giao dịch: ${currentItem.name} (Giới tính: ${slaveGender})
- Mức giá cuối cùng (finalPrice): ${finalPrice.toLocaleString()} ${currencyName}
- Trạng thái giao dịch: ${transactionStatus}

Chi tiết diễn biến: ${detailForAi}`;

            setKnowledgeBase(workingKb); 
            addMessageAndUpdateState([{
                id: `auction-sold-${currentItem.id}`,
                type: 'event_summary',
                content: eventSummaryContent,
                timestamp: Date.now(),
                turnNumber: workingKb.playerStats.turn
            }], workingKb);
    
            setIsLoadingApi(false);
            return;
        }
    
        // mechanical logic with NPC Personalities, Budgets, and Proxy Bids
        let chosenNpc: any = null;
        let chosenNpcBid = 0;
        let personalityUsed = 'high_roller';
        let over3xBuyout = false;
        
        if (currentItem.highestBidderId === 'player' && currentItem.currentBid >= currentItem.buyoutPrice * 3) {
            over3xBuyout = true;
        }

        const npcs = workingKb.slaveAuctionState.auctionNPCs || [];
        if (!isExhausted && !over3xBuyout && currentItem.highestBidderId !== 'system' && npcs.length > 0) {
            // Filter candidates based on budget and personality limits
            const candidates = npcs.filter((npc: any) => {
                if (currentItem.highestBidderId === npc.id) return false;
                
                const minExpectedBid = Math.floor(currentItem.currentBid * 1.02);
                if (npc.currency < minExpectedBid) return false;

                const npcPers = npc.personality || 'high_roller';
                if (npcPers === 'cautious') {
                    if (currentItem.currentBid > 1.2 * currentItem.buyoutPrice) {
                        return false;
                    }
                }
                return true;
            });

            // Shuffle candidates to give everyone equal randomized opportunity
            const shuffledCandidates = [...candidates].sort(() => Math.random() - 0.5);

            for (const npc of shuffledCandidates) {
                const npcPers = npc.personality || 'high_roller';
                const npcBidCount = currentItem.npcBidCount || 0;
                const ratio = currentItem.baitPriceRatio || 0.1;
                const baseChance = 1 - ratio;
                
                let actualChance = baseChance;
                if (npcPers === 'high_roller') {
                    // High roller ignores npcBidCount degradation
                    actualChance = baseChance;
                } else if (npcPers === 'aggressive') {
                    actualChance = baseChance - (0.04 * npcBidCount);
                } else if (npcPers === 'cautious') {
                    actualChance = baseChance - (0.08 * npcBidCount);
                }

                if (actualChance < 0.05) actualChance = 0.05;

                if (Math.random() < actualChance) {
                    let mult = 1.05;
                    if (npcPers === 'aggressive') {
                        mult = 1.10 + Math.random() * 0.05;
                    } else if (npcPers === 'cautious') {
                        mult = 1.02 + Math.random() * 0.01;
                    } else {
                        mult = 1.05 + Math.random() * 0.03;
                    }

                    let nextBid = Math.floor(currentItem.currentBid * mult);
                    if (nextBid <= currentItem.currentBid) {
                        nextBid = currentItem.currentBid + Math.ceil(currentItem.currentBid * 0.02);
                    }

                    if (nextBid > npc.currency) {
                        nextBid = npc.currency;
                    }

                    if (nextBid > currentItem.currentBid) {
                        chosenNpc = npc;
                        chosenNpcBid = nextBid;
                        personalityUsed = npcPers;
                        break;
                    }
                }
            }
        }

        if (chosenNpc) {
            const currencyName = workingKb.worldConfig?.currencyName || "Nguyên";
            const taunt = Math.random() < 0.6 ? NPC_SLAVE_TAUNTS[Math.floor(Math.random() * NPC_SLAVE_TAUNTS.length)] : null;
            
            const persLabel = personalityUsed === 'aggressive' ? 'Hùng Hổ' : personalityUsed === 'cautious' ? 'Dè Dặt' : 'Đại Gia';
            let message = `[${chosenNpc.name}] (${persLabel}) tung tiền ra giá ${chosenNpcBid.toLocaleString()} ${currencyName}!`;
            if (taunt) message += ` Mắt kẻ này đỏ lừ: "${taunt}"`;
            
            workingKb.slaveAuctionState.auctioneerCommentary.push({id: `slave-npc-bid-${chosenNpc.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: message, timestamp: Date.now()});

            // Proxy Bidding check
            const proxyLimit = currentItem.playerMaxBidLimit;
            if (proxyLimit && proxyLimit > 0) {
                const proxyBiddingExpectedPrice = Math.floor(chosenNpcBid * 1.05);
                if (proxyBiddingExpectedPrice <= proxyLimit && workingKb.playerStats.currency >= proxyBiddingExpectedPrice) {
                    currentItem.currentBid = proxyBiddingExpectedPrice;
                    currentItem.highestBidderId = 'player';
                    currentItem.npcBidCount = (currentItem.npcBidCount || 0) + 1;
                    
                    workingKb.slaveAuctionState.lastBidTime = Date.now();
                    workingKb.slaveAuctionState.auctioneerCallCount = 0;
                    
                    const proxyMessage = `[Uỷ thác] Hệ thống tự động đặt thầu thay bạn ở mức ${proxyBiddingExpectedPrice.toLocaleString()} ${currencyName}! (Đã thiết lập giá tối đa: ${proxyLimit.toLocaleString()} ${currencyName})`;
                    workingKb.slaveAuctionState.auctioneerCommentary.push({id: `slave-proxy-bid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: proxyMessage, timestamp: Date.now()});
                } else {
                    currentItem.currentBid = chosenNpcBid;
                    currentItem.highestBidderId = chosenNpc.id;
                    currentItem.npcBidCount = (currentItem.npcBidCount || 0) + 1;
                    
                    workingKb.slaveAuctionState.lastBidTime = Date.now();
                    workingKb.slaveAuctionState.auctioneerCallCount = 0;
                    
                    const failReason = workingKb.playerStats.currency < proxyBiddingExpectedPrice
                        ? "Số dư linh thạch của bạn không đủ để tự động theo thầu!"
                        : "Giá thầu mới đã vượt quá giới hạn ủy thác thầu của bạn!";
                    const warnMessage = `[Uỷ thác] Dừng đặt thầu tự động! Lý do: ${failReason}`;
                    workingKb.slaveAuctionState.auctioneerCommentary.push({id: `slave-proxy-fail-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: warnMessage, timestamp: Date.now()});
                }
            } else {
                currentItem.currentBid = chosenNpcBid;
                currentItem.highestBidderId = chosenNpc.id;
                currentItem.npcBidCount = (currentItem.npcBidCount || 0) + 1;
                
                workingKb.slaveAuctionState.lastBidTime = Date.now();
                workingKb.slaveAuctionState.auctioneerCallCount = 0;
            }
        } else {
            workingKb.slaveAuctionState.auctioneerCallCount = newCallCount;
            if (newCallCount === 2) {
                workingKb.slaveAuctionState.secondCallCount = (workingKb.slaveAuctionState.secondCallCount || 0) + 1;
            }
            const currencyName = workingKb.worldConfig?.currencyName || "Nguyên";
            let hammerMsg = `Đấu giá sư: "${currentItem.currentBid.toLocaleString()} ${currencyName} lần thứ ${newCallCount}..."`;
            if (over3xBuyout) {
                hammerMsg = `Đấu giá sư lau mồ hôi: "Cái giá quá khủng khiếp... Không ai dám theo nữa! Lần thứ ${newCallCount}!"`;
            } else if (isExhausted) {
                hammerMsg = `Đấu giá sư dõng dạc: "${currentItem.currentBid.toLocaleString()} ${currencyName} lần thứ ba (lần cuối cùng)!"`;
            }
            workingKb.slaveAuctionState.auctioneerCommentary.push({id: `slave-hammer-${newCallCount}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: hammerMsg, timestamp: Date.now()});
        }

        setKnowledgeBase(workingKb);
        setIsLoadingApi(false);
    }, [knowledgeBase, addMessageAndUpdateState, setKnowledgeBase, showNotification, setApiErrorWithTimeout, setIsLoadingApi]);
    
    const handleSkipSlaveAuctionItem = useCallback(async () => {
        if (isLoadingApi || !knowledgeBase.slaveAuctionState || !knowledgeBase.slaveAuctionState.isOpen) return;
        setIsLoadingApi(true);
        let workingKb = JSON.parse(JSON.stringify(knowledgeBase)) as KnowledgeBase;
        const { items, currentItemIndex } = workingKb.slaveAuctionState!;
        const nextItemIndex = currentItemIndex + 1;
        const currentItem = items[currentItemIndex] as AuctionSlave;
        let systemMessageContent = `Bạn đã bỏ qua nô lệ "${currentItem.name}".`;
    
        if (nextItemIndex >= items.length) {
            workingKb.slaveAuctionState!.isOpen = false;
            workingKb.slaveAuctionState!.auctioneerCommentary.push({ id: `slave-skip-end-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: "Phiên đấu giá đã kết thúc! Cảm ơn quý vị.", timestamp: Date.now() });
        } else {
            workingKb.slaveAuctionState!.currentItemIndex = nextItemIndex;
            workingKb.slaveAuctionState!.auctioneerCallCount = 0;
            workingKb.slaveAuctionState!.lastBidTime = Date.now();
            const nextItem = items[nextItemIndex] as AuctionSlave;
            workingKb.slaveAuctionState!.auctioneerCommentary.push({ id: `slave-skip-next-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: `Tiếp theo là: ${nextItem.name}!`, timestamp: Date.now() });
        }
        setKnowledgeBase(workingKb); 
        addMessageAndUpdateState([], workingKb);
        setIsLoadingApi(false);
    }, [knowledgeBase, setKnowledgeBase, addMessageAndUpdateState, setIsLoadingApi, isLoadingApi]);

    const handleSetPlayerMaxBidSlave = useCallback((maxBid: number) => {
        let workingKb = JSON.parse(JSON.stringify(knowledgeBase)) as KnowledgeBase;
        const state = workingKb.slaveAuctionState;
        if (!state) return;
        const item = state.items[state.currentItemIndex];
        if (!item) return;
        
        item.playerMaxBidLimit = maxBid;
        setKnowledgeBase(workingKb);
        showNotification(`Đã thiết lập uỷ thác tự động đặt giá tối đa đến ${maxBid.toLocaleString()} cho nô lệ này.`, 'success');
    }, [knowledgeBase, setKnowledgeBase, showNotification]);

    const handleInfluenceBaitRatioSlave = useCallback((type: 'rumor' | 'trap') => {
        let workingKb = JSON.parse(JSON.stringify(knowledgeBase)) as KnowledgeBase;
        const state = workingKb.slaveAuctionState;
        if (!state) return;
        const item = state.items[state.currentItemIndex];
        if (!item) return;

        const cost = type === 'rumor' ? 1000 : 1500;
        const currencyName = workingKb.worldConfig?.currencyName || "Nguyên";
        if (workingKb.playerStats.currency < cost) {
            showNotification(`Bạn không đủ ${cost} ${currencyName} để sử dụng kỹ năng này!`, 'error');
            return;
        }

        // Deduct cost
        workingKb.playerStats.currency -= cost;

        if (type === 'rumor') {
            item.baitPriceRatio = Math.max(0.01, (item.baitPriceRatio || 0.1) - 0.15);
            const msg = `[Mưu mẹo] Bạn chi thêm ${cost.toLocaleString()} ${currencyName} phao tin đồn thổi! Đấu giá sư la lớn: "Nghe đồn nô lệ tụ hội đại gia thế lừng lẫy ẩn tàng!" Các NPC hăng máu chấn động, tăng mạnh ý định ra giá thầu!`;
            state.auctioneerCommentary.push({ id: `slave-rumor-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: msg, timestamp: Date.now() });
        } else {
            item.baitPriceRatio = Math.min(0.9, (item.baitPriceRatio || 0.1) + 0.20);
            const msg = `[Mưu mẹo] Bạn chi thêm ${cost.toLocaleString()} ${currencyName} gài bẫy tì vết! Đấu giá sư ngập ngừng: "Có người truyền âm báo nô lệ này dường như ngầm mắc bệnh kín khó giải..." Quần hùng do dự, có xu hướng rút lui thầu sớm!`;
            state.auctioneerCommentary.push({ id: `slave-trap-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: msg, timestamp: Date.now() });
        }

        setKnowledgeBase(workingKb);
        showNotification(`Sử dụng mưu mẹo đấu giá thành công!`, 'success');
    }, [knowledgeBase, setKnowledgeBase, showNotification]);

  return {
    handleStartSlaveAuction,
    handlePlayerSlaveAuctionAction,
    handleSlaveAuctioneerCall,
    handleSkipSlaveAuctionItem,
    handleSetPlayerMaxBidSlave,
    handleInfluenceBaitRatioSlave,
  };
};