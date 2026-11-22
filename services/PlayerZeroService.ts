import { KnowledgeBase, GameMessage, NPC, YeuThu } from '../types';
import { callGeminiAPI } from './apiService';
import { parseXmlPlayerZero } from '../utils/xmlDataParser';

export class PlayerZeroService {
    // List of basic fallback items for scavenging
    private static WEAPONS = [
        { name: 'Phá Sơn Đao', type: 'Vũ khí', bonusAtk: 15 },
        { name: 'Xích Long Kiếm', type: 'Vũ khí', bonusAtk: 25 },
        { name: 'Tử Tiêu Thương', type: 'Vũ khí', bonusAtk: 20 },
        { name: 'Vạn Cổ Thần Thư', type: 'Vũ khí', bonusAtk: 30 },
        { name: 'Thanh Thủy Chủy Thủ', type: 'Vũ khí', bonusAtk: 10 },
        { name: 'Lôi Đình Chưởng Pháp', type: 'Vũ khí', bonusAtk: 18 }
    ];

    private static ARMORS = [
        { name: 'Áo Vải Sơ Cấp', type: 'Phòng ngự', bonusHp: 100 },
        { name: 'Huyền Thiết Trọng Giáp', type: 'Phòng ngự', bonusHp: 350 },
        { name: 'Thanh Vân Pháp Bào', type: 'Phòng ngự', bonusHp: 200 },
        { name: 'Bách Chiến Giáp', type: 'Phòng ngự', bonusHp: 300 },
        { name: 'Linh Tơ Ngọc Bào', type: 'Phòng ngự', bonusHp: 150 }
    ];

    private static POTIONS = [
        { name: 'Tụ Khí Đan', type: 'Đan dược', effect: 'Hồi phục linh lực' },
        { name: 'Bồi Nguyên Đan', type: 'Đan dược', effect: 'Tăng cường khí huyết' },
        { name: 'Thanh Linh Đan', type: 'Đan dược', effect: 'Giải trừ độc tố' },
        { name: 'Trúc Cơ Đan', type: 'Đan dược', effect: 'Hỗ trợ tu luyện' }
    ];

    /**
     * Adds experience to Player Zero.
     */
    private static gainExperience(pZero: NPC, amount: number): void {
        if (!pZero.stats) return;
        pZero.stats.kinhNghiem = (pZero.stats.kinhNghiem || 0) + amount;
    }

    /**
     * Finds or rolls up to 3 Player Zeros from the discovered NPCs list.
     */
    public static getOrRollPlayerZeros(kb: KnowledgeBase): NPC[] {
        if (!kb.discoveredNPCs || kb.discoveredNPCs.length === 0) {
            return [];
        }

        // 1. Clean up "isPlayerZero" for deceased NPCs
        kb.discoveredNPCs.forEach(npc => {
            if (npc.isPlayerZero && npc.status === 'Đã chết') {
                npc.isPlayerZero = false;
            }
        });

        // 2. Find ALL currently alive Player Zeros (regardless of where they are)
        const allAlivePlayerZeros = kb.discoveredNPCs.filter(npc => 
            npc.isPlayerZero && 
            npc.status !== 'Đã chết'
        );
        
        // If we have more than 3 alive Player Zeros, we should keep only the first 3 and set isPlayerZero to false for the rest to fix existing data bloat!
        if (allAlivePlayerZeros.length > 3) {
            allAlivePlayerZeros.forEach((npc, idx) => {
                if (idx >= 3) {
                    npc.isPlayerZero = false;
                }
            });
            // Truncate list
            allAlivePlayerZeros.length = 3;
        }

        const playerLocationId = kb.currentLocationId;

        // If we have fewer than 3, we need to roll additional ones from alive non-player-zeros
        if (allAlivePlayerZeros.length < 3) {
            const aliveNonPlayerZeros = kb.discoveredNPCs.filter(npc => 
                !npc.isPlayerZero && 
                npc.status !== 'Đã chết'
            );
            const neededCount = Math.max(0, 3 - allAlivePlayerZeros.length);
            
            // Shuffle or randomly select to fill up to 3
            const selectedToRoll = [...aliveNonPlayerZeros].sort(() => 0.5 - Math.random()).slice(0, neededCount);
            
            selectedToRoll.forEach(npc => {
                npc.isPlayerZero = true;
                npc.playerZeroLog = npc.playerZeroLog || [];
                allAlivePlayerZeros.push(npc);
            });
        }

        // 3. Ensure all active Player Zeros have proper statistics
        allAlivePlayerZeros.forEach(pZero => {
            if (!pZero.stats) {
                pZero.stats = {
                    sinhLuc: 500,
                    maxSinhLuc: 500,
                    linhLuc: 200,
                    maxLinhLuc: 200,
                    sucTanCong: 35,
                    kinhNghiem: 0,
                    maxKinhNghiem: 100,
                    thoNguyen: 100,
                    maxThoNguyen: 100
                };
            } else {
                pZero.stats.sinhLuc = pZero.stats.sinhLuc ?? 500;
                pZero.stats.maxSinhLuc = pZero.stats.maxSinhLuc ?? 500;
                pZero.stats.sucTanCong = pZero.stats.sucTanCong ?? 35;
                pZero.stats.kinhNghiem = pZero.stats.kinhNghiem ?? 0;
                pZero.stats.maxKinhNghiem = pZero.stats.maxKinhNghiem ?? 100;
            }
            pZero.playerZeroLog = pZero.playerZeroLog || [];
        });

        // 4. Return all alive Player Zeros to allow them to act and interact freely in all locations (including MC's location)
        return allAlivePlayerZeros;
    }

    /**
     * Finds the next location step on the shortest path from startLocId to endLocId using BFS.
     */
    private static findNextLocationStep(
        kb: KnowledgeBase,
        startId: string,
        endId: string
    ): string {
        if (!startId || !endId || startId === endId) return startId;

        const locations = kb.discoveredLocations || [];
        
        // Find normalized location objects
        const startLoc = locations.find(l => l.id === startId || l.name === startId);
        const endLoc = locations.find(l => l.id === endId || l.name === endId);

        if (!startLoc || !endLoc) {
            return endId; // Fallback: instant warp if locations not found
        }

        const startNormalizedId = startLoc.id;
        const endNormalizedId = endLoc.id;

        // BFS Queue containing paths (array of location IDs)
        const queue: string[][] = [[startNormalizedId]];
        const visited = new Set<string>();
        visited.add(startNormalizedId);

        let shortestPath: string[] | null = null;

        while (queue.length > 0) {
            const currentPath = queue.shift()!;
            const lastId = currentPath[currentPath.length - 1];

            if (lastId === endNormalizedId) {
                shortestPath = currentPath;
                break;
            }

            const lastLoc = locations.find(l => l.id === lastId);
            if (lastLoc && lastLoc.connections) {
                for (const conn of lastLoc.connections) {
                    const neighborId = conn.targetLocationId;
                    const neighbor = locations.find(l => l.id === neighborId || l.name === neighborId);
                    if (neighbor) {
                        const normNeighborId = neighbor.id;
                        if (!visited.has(normNeighborId)) {
                            visited.add(normNeighborId);
                            queue.push([...currentPath, normNeighborId]);
                        }
                    }
                }
            }
        }

        if (shortestPath && shortestPath.length > 1) {
            return shortestPath[1]; // Next step along the path
        }

        // Fallback 1: Try using map coordinates
        if (startLoc.mapX !== undefined && startLoc.mapY !== undefined && endLoc.mapX !== undefined && endLoc.mapY !== undefined) {
            const currentDist = Math.hypot(startLoc.mapX - endLoc.mapX, startLoc.mapY - endLoc.mapY);
            let bestNextId = endNormalizedId;
            let bestDist = currentDist;

            for (const loc of locations) {
                if (loc.id !== startNormalizedId && loc.mapX !== undefined && loc.mapY !== undefined) {
                    const dist = Math.hypot(loc.mapX - endLoc.mapX, loc.mapY - endLoc.mapY);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestNextId = loc.id;
                    }
                }
            }
            return bestNextId;
        }

        // Fallback 2: If graph is disconnected and there are no coordinates, move step-by-step
        return endNormalizedId;
    }

    /**
     * Executes one turn of action for all Player Zeros and returns update summary messages.
     */
    public static async processPlayerZeroTurn(kb: KnowledgeBase, isPlayerZeroActive: boolean, recentNarrations: string[] = []): Promise<{ updatedKb: KnowledgeBase; systemMessages: GameMessage[] }> {
        const updatedKb = kb;
        const systemMessages: GameMessage[] = [];

        // Nếu chế độ P0 không hoạt động, bỏ qua xử lý PZero
        if (!isPlayerZeroActive) {
            return { updatedKb, systemMessages: [] };
        }

        const pZeros = this.getOrRollPlayerZeros(updatedKb);
        if (pZeros.length === 0) {
            return { updatedKb, systemMessages: [] };
        }

        const turnNumber = updatedKb.playerStats?.turn || 0;
        
        // Gọi AI để lấy hành động cho tất cả P0 sống
        const activePZeros = pZeros;
        if (activePZeros.length === 0) {
            return { updatedKb, systemMessages: [] };
        }

        const prompt = `Bạn là một nhân vật sống thực trong thế giới ${kb.worldConfig?.settingDescription || 'Thế giới tu tiên mạo hiểm'}. Với thông số đã biết, bạn hãy "sống" trong thời gian 1 turn tiếp theo?

Bối cảnh/Diễn biến cốt truyện 5 lượt gần nhất vừa xảy ra:
${recentNarrations.length > 0 ? recentNarrations.map((n, i) => `[Lượt ${i + 1}]:\n${n}`).join('\n\n') : 'Không có diễn biến gì đáng chú ý.'}

Đây là danh sách các P0 (nhân vật sống) hiện đang hoạt động:
${activePZeros.map((p, i) => `
--- P0 #${i+1} ---
ID: ${p.id}
Tên: ${p.name}
Tính cách/Tiểu sử: ${p.personalityTraits?.join(', ') || ''} ${p.description || ''}
Chỉ số: Sinh lực ${p.stats?.sinhLuc}/${p.stats?.maxSinhLuc}, Cảnh giới: ${p.stats?.realm || 'Phàm nhân'}, Sức tấn công: ${p.stats?.sucTanCong}
Vị trí hiện tại: ${p.locationId || 'Không rõ'}
Nhật ký hành động gần đây:
${(p.playerZeroLog || []).slice(-3).map(l => `- ${l}`).join('\n')}
`).join('')}

Nhiệm vụ của bạn:
Với mỗi P0, hãy suy nghĩ và đưa ra ĐÚNG 1 hành động trong lượt tiếp theo dựa trên tính cách và mục tiêu của họ.

QUY TẮC TƯƠNG TÁC THÂN THIỆN & TỰ DO:
1. P0 ĐƯỢC PHÉP tiếp xúc, gặp gỡ, trò chuyện, giao dịch, hỗ trợ, kết bạn, kết đồng minh, đồng hành hoặc khiêu chiến/chiến đấu với MC (Main Character / Người chơi chính) cũng như các NPC khác.
2. P0 CÓ THỂ xuất hiện trong bối cảnh/lời kể của MC, di chuyển đến địa điểm của MC, hoặc tương tác trực tiếp với các nhân vật đang xuất hiện trong "Bối cảnh/Diễn biến cốt truyện 5 lượt gần nhất".
3. Tương tác KHÔNG BỊ GIỚI HẠN, miễn là phù hợp với tính cách của P0, bối cảnh thực tại và logic thế giới.

Hành động phải là 1 trong 5 loại sau:
1. "travel": Di chuyển đến địa điểm khác hoặc đến vị trí của MC/NPC (ghi tên địa điểm/mục tiêu vào targetName).
2. "scavenge": Tìm kiếm tài nguyên, kỳ ngộ tại chỗ.
3. "cultivate": Bế quan tu luyện.
4. "interaction": Giao tiếp, trò chuyện, hỗ trợ, giao dịch, kết giao với MC hoặc NPC khác (ghi tên MC/NPC vào targetName).
5. "combat": Quyết định tấn công một mục tiêu (Ghi TÊN mục tiêu vào targetName).

Định dạng trả về BẮT BUỘC phải là khối dữ liệu XML bọc bởi thẻ <hanh_dong_p0>...</hanh_dong_p0> (Không Markdown, không bọc \`\`\`):

<hanh_dong_p0>
  <npc>
    <npcId>id_cua_p0</npcId>
    <action>travel | scavenge | cultivate | interaction | combat</action>
    <targetName>Tên mục tiêu (MC hoặc NPC/Địa điểm nếu có, nếu không có thì bỏ trống thẻ hoặc ghi N/A)</targetName>
    <details>Đoạn văn nhập vai miêu tả hành động và suy nghĩ của P0, thể hiện ý chí, cảm xúc hoặc phản ứng với bối cảnh/MC (hiển thị cho người chơi đọc).</details>
  </npc>
</hanh_dong_p0>
`;

        let aiActions: { npcId: string, action: string, targetName?: string, details: string }[] = [];
        try {
            const response = await callGeminiAPI(
                prompt,
                undefined,
                'combat',
                undefined,
                "Bạn là hệ thống xử lý logic game. CHỈ trả về khối dữ liệu XML bọc bởi thẻ <hanh_dong_p0>...</hanh_dong_p0>.",
                false,
                'text/plain',
                undefined,
                undefined,
                "Xử lý lượt Player Zero",
                undefined,
                false
            );
            aiActions = parseXmlPlayerZero(response.text || '');
        } catch (e) {
            console.error("Failed to parse PZero AI XML response:", e);
            aiActions = [];
        }

        // Process turn for each Player Zero independently
        activePZeros.forEach((pZero, index) => {
            let content = '';

            // Determine current location name
            let locationName = 'Thế giới bên ngoài';
            if (pZero.locationId) {
                const loc = updatedKb.discoveredLocations?.find(l => l.id === pZero.locationId || l.name === pZero.locationId);
                if (loc) {
                    locationName = loc.name;
                } else {
                    locationName = pZero.locationId;
                }
            } else if (updatedKb.discoveredLocations && updatedKb.discoveredLocations.length > 0) {
                const randomLoc = updatedKb.discoveredLocations[Math.floor(Math.random() * updatedKb.discoveredLocations.length)];
                pZero.locationId = randomLoc.id || randomLoc.name;
                locationName = randomLoc.name;
            }

            const aiAction = aiActions.find(a => a.npcId === pZero.id);
            if (!aiAction) return;

            let chosenAction = aiAction.action as 'travel' | 'scavenge' | 'cultivate' | 'interaction' | 'combat';
            let targetName = aiAction.targetName;
            let roleplayText = aiAction.details;
            
            // Xoá logic target cũ (hasActiveTarget, roll)
            let targetId = undefined;
            let targetType = undefined;
            
            // Validate AI combat target if chosen
            if (chosenAction === 'combat') {
                if (targetName?.toLowerCase() === updatedKb.playerStats?.name?.toLowerCase() || targetName?.toLowerCase() === 'người chơi' || targetName?.toLowerCase() === 'mc') {
                    targetType = 'player';
                } else if (targetName) {
                    const foundNpc = updatedKb.discoveredNPCs.find(n => n.name.includes(targetName!) && n.id !== pZero.id && n.status !== 'Đã chết');
                    if (foundNpc) {
                        targetType = 'npc';
                        targetId = foundNpc.id;
                    } else {
                        const foundBeast = updatedKb.discoveredYeuThu?.find(b => b.name.includes(targetName!));
                        if (foundBeast) {
                            targetType = 'beast';
                            targetId = foundBeast.id;
                        } else {
                            // Target not found, change to scavenge
                            chosenAction = 'scavenge';
                        }
                    }
                } else {
                    chosenAction = 'scavenge';
                }
            }

            if (chosenAction === 'travel') {
                // --- ACTION: TRAVEL ---
                if (targetName) {
                    const lowerT = targetName.toLowerCase();
                    const mcName = updatedKb.playerStats?.name?.toLowerCase() || '';
                    if (lowerT === 'mc' || lowerT === 'người chơi' || lowerT === 'main character' || (mcName && lowerT.includes(mcName))) {
                        if (updatedKb.currentLocationId) {
                            pZero.locationId = updatedKb.currentLocationId;
                        }
                    } else {
                        const dest = updatedKb.discoveredLocations?.find(l => l.name.toLowerCase().includes(lowerT));
                        if (dest) {
                            pZero.locationId = dest.id || dest.name;
                        }
                    }
                }
                content = `[Người chơi số 0 - Vị trí ${index + 1}] **${pZero.name}**\n${roleplayText}`;
            } else if (chosenAction === 'scavenge') {
                // --- ACTION: SCAVENGE (FIND EQUIPMENT) ---
                const scavengeRoll = Math.random();
                if (scavengeRoll < 0.40) {
                    const weapon = this.WEAPONS[Math.floor(Math.random() * this.WEAPONS.length)];
                    if (pZero.stats) {
                        pZero.stats.sucTanCong = (pZero.stats.sucTanCong || 30) + weapon.bonusAtk;
                    }
                } else if (scavengeRoll < 0.80) {
                    const armor = this.ARMORS[Math.floor(Math.random() * this.ARMORS.length)];
                    if (pZero.stats) {
                        pZero.stats.maxSinhLuc = (pZero.stats.maxSinhLuc || 500) + armor.bonusHp;
                        pZero.stats.sinhLuc = Math.min(pZero.stats.maxSinhLuc, (pZero.stats.sinhLuc || 0) + armor.bonusHp);
                    }
                }
                content = `[Người chơi số 0 - Vị trí ${index + 1}] **${pZero.name}**\n${roleplayText}`;
            } else if (chosenAction === 'cultivate') {
                // --- ACTION: CULTIVATE ---
                const expGained = Math.floor(Math.random() * 30) + 20; // 20 - 50 EXP
                if (pZero.stats) {
                    const oldMaxExp = pZero.stats.maxKinhNghiem || 100;
                    this.gainExperience(pZero, expGained);
                }
                content = `[Người chơi số 0 - Vị trí ${index + 1}] **${pZero.name}**\n${roleplayText}`;
            } else if (chosenAction === 'interaction') {
                // --- ACTION: FRIENDLY INTERACTION ---
                if (targetName) {
                    const lowerT = targetName.toLowerCase();
                    const mcName = updatedKb.playerStats?.name?.toLowerCase() || '';
                    if (lowerT === 'mc' || lowerT === 'người chơi' || lowerT === 'main character' || (mcName && lowerT.includes(mcName))) {
                        if (updatedKb.currentLocationId) {
                            pZero.locationId = updatedKb.currentLocationId;
                        }
                    } else {
                        const foundNpc = updatedKb.discoveredNPCs.find(n => n.name.toLowerCase().includes(lowerT));
                        if (foundNpc && foundNpc.locationId) {
                            pZero.locationId = foundNpc.locationId;
                        }
                    }
                }
                content = `[Người chơi số 0 - Vị trí ${index + 1}] **${pZero.name}**\n${roleplayText}`;
            } else if (chosenAction === 'combat') {
                // --- ACTION: COMBAT (Mechanics + AI Text) ---
                if (targetId) {
                    let targetLocationId = 'Thế giới bên ngoài';
                    let opponentNpcObj: NPC | undefined;
                    let opponentBeastObj: YeuThu | undefined;
                    let isOpponentMc = targetType === 'player';

                    if (targetType === 'player') {
                        targetLocationId = updatedKb.currentLocationId || 'Thế giới bên ngoài';
                    } else if (targetType === 'npc') {
                        opponentNpcObj = updatedKb.discoveredNPCs.find(n => n.id === targetId);
                        if (opponentNpcObj) {
                            targetLocationId = opponentNpcObj.locationId || 'Thế giới bên ngoài';
                        }
                    } else if (targetType === 'beast') {
                        opponentBeastObj = updatedKb.discoveredYeuThu?.find(b => b.id === targetId);
                        if (opponentBeastObj) {
                            targetLocationId = opponentBeastObj.locationId || 'Thế giới bên ngoài';
                        }
                    }

                    if (pZero.locationId !== targetLocationId) {
                        // Di chuyển về phía mục tiêu
                        const nextLocId = this.findNextLocationStep(updatedKb, pZero.locationId || '', targetLocationId);
                        pZero.locationId = nextLocId;
                        content = `[Người chơi số 0 - Vị trí ${index + 1}] **${pZero.name}**\n${roleplayText}\n*(Đang truy vết mục tiêu ${targetName} qua bản đồ)*`;
                    } else {
                        // Encounter!
                        let opponentPower = 100;
                        if (isOpponentMc) {
                            const mcAtk = updatedKb.playerStats.sucTanCong || 35;
                            const mcMaxHp = updatedKb.playerStats.maxSinhLuc || 500;
                            opponentPower = mcAtk + Math.floor(mcMaxHp / 10);
                        } else if (targetType === 'npc' && opponentNpcObj) {
                            const oppAtk = opponentNpcObj.stats?.sucTanCong || 30;
                            const oppMaxHp = opponentNpcObj.stats?.maxSinhLuc || 400;
                            opponentPower = oppAtk + Math.floor(oppMaxHp / 10);
                        } else {
                            opponentPower = Math.floor(Math.random() * 50) + 40; // 40-90 power
                        }

                        if (isOpponentMc) {
                            content = `🗡️ **[ĐỤNG ĐỘ TRỰC TIẾP VỚI P0]**\n[Người chơi số 0 - Vị trí ${index + 1}] **${pZero.name}**:\n${roleplayText}\n\n[BEGIN_COMBAT: opponentIds="${pZero.id}"]`;

                            updatedKb.pendingCombat = {
                                opponentIds: [pZero.id],
                                allyIds: [],
                                surrenderedNpcIds: [],
                                analyzed: false,
                                enemy: { ids: [pZero.id] },
                                analysis: null
                            };
                        } else {
                            const pAtk = pZero.stats?.sucTanCong || 35;
                            const pMaxHp = pZero.stats?.maxSinhLuc || 500;
                            const pZeroPower = pAtk + Math.floor(pMaxHp / 10);

                            const pZeroRoll = pZeroPower + Math.floor(Math.random() * 50);
                            const opponentRoll = opponentPower + Math.floor(Math.random() * 50);

                            if (pZeroRoll >= opponentRoll) {
                                const expWin = Math.floor(Math.random() * 20) + 15;
                                if (pZero.stats) {
                                    this.gainExperience(pZero, expWin);
                                }
                                if (targetType === 'npc' && opponentNpcObj && opponentNpcObj.stats) {
                                    opponentNpcObj.stats.sinhLuc = Math.max(0, (opponentNpcObj.stats.sinhLuc || 0) - Math.floor(pZeroRoll / 2));
                                    if (opponentNpcObj.stats.sinhLuc === 0) {
                                        opponentNpcObj.status = 'Đã chết';
                                    }
                                } else if (targetType === 'beast' && opponentBeastObj && opponentBeastObj.stats) {
                                    opponentBeastObj.stats.sinhLuc = Math.max(0, (opponentBeastObj.stats.sinhLuc || 0) - Math.floor(pZeroRoll / 2));
                                }
                                content = `🗡️ **[P0 CHIẾN ĐẤU]**\n[Người chơi số 0 - Vị trí ${index + 1}] **${pZero.name}**:\n${roleplayText}\n\n-> **Kết quả:** Thắng cuộc, nhận ${expWin} EXP!`;
                            } else {
                                if (pZero.stats) {
                                    pZero.stats.sinhLuc = Math.max(0, (pZero.stats.sinhLuc || 0) - Math.floor(opponentRoll / 2));
                                }
                                content = `🗡️ **[P0 CHIẾN ĐẤU]**\n[Người chơi số 0 - Vị trí ${index + 1}] **${pZero.name}**:\n${roleplayText}\n\n-> **Kết quả:** Thất bại, sinh lực suy giảm!`;
                            }
                        }
                    }
                } else {
                    content = `[Người chơi số 0 - Vị trí ${index + 1}] **${pZero.name}**\n${roleplayText}`;
                }
            }
            // Save action to log history of Player Zero
            pZero.playerZeroLog = pZero.playerZeroLog || [];
            pZero.playerZeroLog.push(content.replace(/\*\*/g, ''));
            if (pZero.playerZeroLog.length > 15) {
                pZero.playerZeroLog.shift();
            }

            // Create the system message for the Main Game Loop
            const systemMsg: GameMessage = {
                id: `pzero_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'event_summary', // Distinct and high contrast
                content: content,
                timestamp: Date.now(),
                turnNumber: turnNumber
            };

            systemMessages.push(systemMsg);
        });

        return { updatedKb, systemMessages };
    }
}
