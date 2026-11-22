import { KnowledgeBase } from '../../types';
import { PostCombatIdentityService } from '../../services/ai/postCombatIdentityService';

/**
 * Reconcile post-combat tags (Auto-Merge & Tag Execution Priority).
 * Prevents creation of duplicate NPCs when AI adds a prisoner/companion/slave/NPC with a new name
 * for an existing unnamed or generic combat opponent (e.g., "Tên cướp B").
 */
export function reconcilePostCombatTags(
    extractedTags: string[],
    currentKb: KnowledgeBase | undefined,
    turn: number
): string[] {
    const isBattlePlusOne = PostCombatIdentityService.isBattlePlusOneTurn(turn, currentKb);
    const recentOpponents = PostCombatIdentityService.getRecentOpponents();

    let processedTags = [...extractedTags];

    if (isBattlePlusOne && recentOpponents.length > 0) {
        const renameOldNames = new Set<string>();

        // Collect existing explicit NPC_RENAME old names
        processedTags.forEach(tag => {
            const renameMatch = tag.match(/\[NPC_RENAME:\s*oldName=["']([^"']+)["'],\s*newName=["']([^"']+)["']\]/i);
            if (renameMatch) {
                renameOldNames.add(renameMatch[1].trim().toLowerCase());
            }
        });

        // Find generic opponents without an explicit rename tag
        const unrenamedOpponents = recentOpponents.filter(
            op => !renameOldNames.has(op.name.trim().toLowerCase())
        );

        if (unrenamedOpponents.length > 0) {
            const newTagsToInject: string[] = [];

            processedTags.forEach((tag) => {
                const addMatch = tag.match(/\[(PRISONER_ADD|SLAVE_ADD|COMPANION_ADD|NPC_CREATE):\s*name=["']([^"']+)["']/i);
                if (addMatch) {
                    const newName = addMatch[2].trim();

                    // Check if newName matches any existing opponent directly or if there's a generic opponent waiting for rename
                    const matchingOpponent = unrenamedOpponents.find(op => op.name.trim().toLowerCase() === newName.toLowerCase());

                    if (!matchingOpponent && unrenamedOpponents.length > 0) {
                        // Fallback: Pick the first unrenamed generic opponent (e.g. "Tên cướp B") and inject an NPC_RENAME tag
                        const opponentToRename = unrenamedOpponents.shift();
                        if (opponentToRename) {
                            const renameTag = `[NPC_RENAME: oldName="${opponentToRename.name}", newName="${newName}"]`;
                            if (!processedTags.some(t => t.toLowerCase().includes(`oldname="${opponentToRename.name.toLowerCase()}"`))) {
                                newTagsToInject.push(renameTag);
                                console.log(`[POST-COMBAT AUTO-MERGE] Auto-generated tag: ${renameTag} for generic opponent ${opponentToRename.name}`);
                            }
                        }
                    }
                }
            });

            if (newTagsToInject.length > 0) {
                processedTags = [...newTagsToInject, ...processedTags];
            }
        }

        // Tự động kiểm tra danh sách tù nhân có tên chung chung trong knowledgeBase ở lượt battle+1
        if (currentKb?.prisoners && currentKb.prisoners.length > 0) {
            const genericRegex = /(tù\s*nhân|tù\s*binh|bại\s*tướng|áo\s*xám|kẻ\s*địch|vô\s*danh|nữ\s*tu|cướp|địch|#\d+)/i;
            currentKb.prisoners.forEach(prisoner => {
                if (genericRegex.test(prisoner.name)) {
                    // Kiểm tra xem đã có tag NPC_RENAME cho tù nhân này chưa
                    const hasRenameTag = processedTags.some(tag => 
                        tag.includes('NPC_RENAME') && tag.toLowerCase().includes(`oldname="${prisoner.name.toLowerCase()}"`)
                    );
                    if (!hasRenameTag) {
                        console.log(`[POST-COMBAT PRISONER AUTO-RENAME] Phát hiện tù nhân chưa được đổi tên: ${prisoner.name}`);
                    }
                }
            });
        }
    }

    // PRIORITIZE TAG ORDER (Priority Queue):
    // 1. RENAME tags (NPC_RENAME, MC_RENAME) run FIRST
    // 2. ADD/MOVE tags (PRISONER_ADD, SLAVE_ADD, COMPANION_ADD, WIFE_ADD, NPC_CREATE, NPC_MOVE) run SECOND
    // 3. UPDATE tags (NPC_UPDATE, RELATIONSHIP_UPDATE, STATS_UPDATE) run LAST
    const renameTags: string[] = [];
    const addTags: string[] = [];
    const otherTags: string[] = [];

    processedTags.forEach(tag => {
        const upper = tag.toUpperCase();
        if (upper.includes('NPC_RENAME') || upper.includes('MC_RENAME')) {
            renameTags.push(tag);
        } else if (
            upper.includes('PRISONER_ADD') ||
            upper.includes('SLAVE_ADD') ||
            upper.includes('COMPANION_ADD') ||
            upper.includes('WIFE_ADD') ||
            upper.includes('NPC_CREATE') ||
            upper.includes('NPC_MOVE')
        ) {
            addTags.push(tag);
        } else {
            otherTags.push(tag);
        }
    });

    return [...renameTags, ...addTags, ...otherTags];
}
