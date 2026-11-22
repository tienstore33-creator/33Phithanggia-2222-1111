import { LsrParser } from './LsrParser';
import { KnowledgeBase, PlayerStats, NPC } from '../../types';
import { calculateEffectiveStats } from '../../utils/statsCalculationUtils';

export class LsrSyncService {
    /**
     * Chuyển đổi trạng thái hiện tại của KnowledgeBase thành chuỗi LSR nén
     */
    static serializeKbToLsr(kb: KnowledgeBase): string {
        if (!kb.lsrState) {
            kb.lsrState = {};
        }

        // --- ĐỒNG BỘ HÓA / KHỞI TẠO ĐỘNG CÁC BẢNG THEO THỜI GIAN THỰC ---

        // Bảng #0: Thông tin Hiện tại (Luôn cập nhật theo real-time)
        const timeStr = kb.worldDate 
            ? `${kb.worldDate.timeOfDay}, Ngày ${kb.worldDate.day}, Tháng ${kb.worldDate.month}, Năm ${kb.worldDate.year}`
            : "Không rõ";
        const currentLoc = kb.discoveredLocations?.find(l => l.id === kb.currentLocationId);
        const locName = currentLoc ? currentLoc.name : "Không rõ";
        kb.lsrState["0"] = [{ "0": timeStr, "1": locName }];

        // Bảng #1: Nhân vật Gần đây (Luôn cập nhật theo real-time để phản ánh thực tế xung quanh)
        const nearbyNpcs = (kb.discoveredNPCs || []).filter(npc => {
            const isSameLoc = npc.locationId === kb.currentLocationId || 
                              (npc as any).currentLocation === locName ||
                              npc.locationId === 'current' || 
                              npc.locationId === 'player';
            const isCompanion = (npc as any).isFollowingPlayer || 
                                (npc as any).relationshipToPlayer === 'Đồng hành' || 
                                kb.companions?.some(c => c.id === npc.id) ||
                                kb.wives?.some(w => w.id === npc.id) ||
                                kb.slaves?.some(s => s.id === npc.id) ||
                                kb.prisoners?.some(p => p.id === npc.id);
            return isSameLoc || isCompanion;
        });

        // Chỉ điền bảng #1 nếu có nhân vật xung quanh
        if (nearbyNpcs.length > 0) {
            const currentNearbyRows = kb.lsrState["1"] || [];
            kb.lsrState["1"] = nearbyNpcs.map(npc => {
                const existingRow = currentNearbyRows.find((r: any) => r["0"]?.toLowerCase().trim() === npc.name.toLowerCase().trim());
                return {
                    "0": npc.name,
                    "1": existingRow?.["1"] || "0",
                    "2": existingRow?.["2"] || (npc as any).lastInteractionSummary || (npc as any).lastInteractionTurn || "Bên cạnh MC",
                    "3": locName,
                    "4": existingRow?.["4"] || (npc as any).posture || "Bình thường",
                    "5": existingRow?.["5"] || (npc as any).bodyStatus || "Khỏe mạnh",
                    "6": existingRow?.["6"] || (npc as any).clothing || "Y phục bình thường",
                    "7": existingRow?.["7"] || (npc as any).specialStatus || "Không có"
                };
            });
        } else {
            // Nếu không có ai xung quanh, xóa bảng #1 hoặc để trống
            kb.lsrState["1"] = [];
        }

        // Bảng #2: Thông tin Nhân vật (Bảo tồn và bổ sung thêm NPC mới gặp)
        if (!kb.lsrState["2"]) {
            kb.lsrState["2"] = [];
        }
        const allNpcPool = [
            ...(kb.discoveredNPCs || []),
            ...(kb.companions || []),
            ...(kb.wives || []),
            ...(kb.slaves || []),
            ...(kb.prisoners || [])
        ];
        
        allNpcPool.forEach(npc => {
            const exists = kb.lsrState!["2"].some((r: any) => r["0"]?.toLowerCase().trim() === npc.name.toLowerCase().trim());
            if (!exists) {
                kb.lsrState!["2"].push({
                    "0": npc.name,
                    "1": npc.gender || "Không rõ",
                    "2": (npc as any).age?.toString() || "Không rõ",
                    "3": (npc as any).relationshipToPlayer || "Người qua đường",
                    "4": "Bình thường",
                    "5": "Y phục giản dị",
                    "6": (npc as any).personality || "Trung lập",
                    "7": "Không rõ",
                    "8": "Tu luyện",
                    "9": "Bình thường",
                    "10": (npc as any).relationship || "Bình thường",
                    "11": "Không có",
                    "12": "Không có",
                    "13": npc.description || "Không có ghi chú"
                });
            }
        });

        // Bảng #4: Lịch trình (Nhiệm vụ)
        if (!kb.lsrState["4"] && kb.allQuests && kb.allQuests.length > 0) {
            kb.lsrState["4"] = kb.allQuests.map(q => ({
                "0": q.title || "Nhiệm vụ",
                "1": q.description || "Chưa có mô tả",
                "2": q.status || "Đang tiến hành",
                "3": kb.playerStats?.name || "MC",
                "4": "Hệ thống",
                "5": "Kinh nghiệm & Linh thạch",
                "6": locName,
                "7": "Lượt " + (kb.playerStats?.turn || 1),
                "8": "Không giới hạn",
                "9": "Nhiệm vụ hoạt động"
            }));
        }

        // Bảng #6: Vật phẩm Quan trọng (Bảo vật, Linh dược hiếm)
        if (!kb.lsrState["6"] && kb.inventory && kb.inventory.length > 0) {
            const importantItems = kb.inventory.filter(item => 
                (item.rarity as any) === 'Thần Phẩm' || 
                (item.rarity as any) === 'Tiên Phẩm' || 
                (item.rarity as any) === 'Cực Phẩm' ||
                item.value && item.value > 1000
            );
            if (importantItems.length > 0) {
                kb.lsrState["6"] = importantItems.map(item => ({
                    "0": item.name,
                    "1": kb.playerStats?.name || "MC",
                    "2": "Túi trữ vật",
                    "3": (item.quantity || 1).toString(),
                    "4": "Nguyên vẹn",
                    "5": item.description || "Trân bảo",
                    "6": "Không có",
                    "7": "Vật phẩm phẩm chất cao"
                }));
            }
        }

        // Bảng #8: Địa điểm Quan trọng
        if (!kb.lsrState["8"] && kb.discoveredLocations && kb.discoveredLocations.length > 0) {
            kb.lsrState["8"] = kb.discoveredLocations.map(loc => ({
                "0": loc.name,
                "1": "Phàm giới",
                "2": loc.description || "Địa điểm linh khí",
                "3": (loc as any).isSafe ? "Khu vực an toàn" : "Khu vực nguy hiểm"
            }));
        }

        // --- TIẾN HÀNH SERIALIZE THÀNH CHUỖI KHUNG ---
        const tableNames: Record<string, string> = {
            "0": "Thông tin Hiện tại",
            "1": "Nhân vật Gần đây",
            "2": "Thông tin Nhân vật",
            "3": "Thông tin Tình dục",
            "4": "Lịch trình",
            "5": "Năng lực Đặc biệt",
            "6": "Vật phẩm Quan trọng",
            "7": "Tổ chức Quan trọng",
            "8": "Địa điểm Quan trọng",
            "9": "Tổng kết Lớn",
            "10": "Lịch sự Sự kiện",
            "11": "Chỉ dẫn Quan trọng"
        };

        let result = "<table_stored>\n";
        const lsrState = kb.lsrState || {};
        for (const tableId of Object.keys(lsrState).sort((a, b) => Number(a) - Number(b))) {
            const rows = lsrState[tableId];
            if (!rows || rows.length === 0) continue;
            
            const tableName = tableNames[tableId] || "Bảng";
            rows.forEach((row: any) => {
                const colsStr = Object.keys(row)
                    .map(colIdx => `${colIdx}:${row[colIdx]}`)
                    .join('|');
                result += `#${tableId} ${tableName}|${colsStr}\n`;
            });
        }
        result += "</table_stored>";
        return result;
    }

    /**
     * Đồng bộ hóa dữ liệu từ chuỗi LSR của AI trả về vào KnowledgeBase theo nguyên lý "Code là Luật"
     */
    static syncLsrToKb(rawAiResponse: string, kb: KnowledgeBase): KnowledgeBase {
        // Tìm và bóc tách block <table_stored>...</table_stored> từ AI response
        const tableStoredMatch = rawAiResponse.match(/<table_stored>([\s\S]*?)<\/table_stored>/);
        if (!tableStoredMatch) {
            console.log("[LSR Sync] Không tìm thấy thẻ <table_stored> trong phản hồi AI.");
            return kb;
        }

        const incomingTables = LsrParser.parseLsrString(tableStoredMatch[0]);

        if (!kb.lsrState) {
            kb.lsrState = {};
        }

        // Lưu và hợp nhất bảng mới nhận vào lsrState của kb
        for (const [tableId, rows] of Object.entries(incomingTables)) {
            kb.lsrState[tableId] = rows;
        }

        // --- ĐỒNG BỘ CÁC THUỘC TÍNH ĐỊNH TÍNH (QUALITATIVE - AI LÀM CHỦ) ---

        // Bảng #1: Nhân vật Gần đây
        if (incomingTables["1"]) {
            incomingTables["1"].forEach(row => {
                const npcName = row["0"];
                if (npcName) {
                    const npc = this.findNpcInKb(kb, npcName);
                    if (npc) {
                        // AI ghi đè thuộc tính định tính trực tiếp vào store
                        if (row["4"]) (npc as any).posture = row["4"]; // Tư thế
                        if (row["5"]) (npc as any).bodyStatus = row["5"]; // Trạng thái cơ thể
                        if (row["6"]) (npc as any).clothing = row["6"]; // Trang phục
                        if (row["7"]) (npc as any).specialStatus = row["7"]; // Trạng thái đặc biệt
                    }
                }
            });
        }

        // Bảng #2: Thông tin Nhân vật
        if (incomingTables["2"]) {
            incomingTables["2"].forEach(row => {
                const npcName = row["0"];
                if (npcName) {
                    const npc = this.findNpcInKb(kb, npcName);
                    if (npc) {
                        if (row["1"]) npc.gender = row["1"];
                        if (row["2"]) {
                            const val = parseInt(row["2"]);
                            if (!isNaN(val)) (npc as any).age = val;
                        }
                        if (row["3"]) (npc as any).relationshipToPlayer = row["3"];
                        if (row["6"]) (npc as any).personality = row["6"];
                        if (row["10"]) (npc as any).relationship = row["10"];
                        if (row["13"]) npc.description = row["13"];
                    }
                }
            });
        }

        // --- ĐỒNG BỘ CÁC THUỘC TÍNH ĐỊNH LƯỢNG (QUANTITATIVE - CODE LÀ LUẬT) ---
        // HP, MP, Lượng Linh Thạch, Công Pháp cấp độ, thuộc tính chiến đấu là do Heuristic Code của game tính toán.
        // Ta bảo vệ dữ liệu bằng cách chạy lại hàm kiểm toán/tái tính toán của Code.
        if (kb.playerStats) {
            kb.playerStats = calculateEffectiveStats(kb.playerStats, (kb.equippedItems || {}) as any, kb.inventory || []);
        }

        // Đồng bộ lại địa điểm hiện tại nếu bảng #0 có sự thay đổi được duyệt bởi Code di chuyển
        if (incomingTables["0"] && incomingTables["0"][0]) {
            const lsrLocation = incomingTables["0"][0]["1"];
            if (lsrLocation) {
                const foundLoc = kb.discoveredLocations?.find(loc => 
                    loc.name.toLowerCase().trim() === lsrLocation.toLowerCase().trim()
                );
                if (foundLoc && foundLoc.id !== kb.currentLocationId) {
                    console.log(`[LSR Sync] Đồng bộ vị trí của MC theo bảng #0 của LSR: ${foundLoc.name}`);
                    kb.currentLocationId = foundLoc.id;
                }
            }
        }

        return kb;
    }

    private static findNpcInKb(kb: KnowledgeBase, name: string): NPC | undefined {
        const lists = [
            kb.discoveredNPCs || [],
            kb.companions || [],
            kb.wives || [],
            kb.slaves || [],
            kb.prisoners || []
        ];
        
        const normName = name.toLowerCase().trim();
        for (const list of lists) {
            const found = list.find(n => n.name.toLowerCase().trim() === normName);
            if (found) return found;
        }
        return undefined;
    }
}
