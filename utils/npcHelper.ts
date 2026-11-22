/**
 * Filter and extract 100% full info of a maximum 50 NPCs that were recently interacted with.
 *
 * @param npcs The raw list of NPCs
 * @param currentTurn The current game turn number
 * @param currentLocationId (Optional) Forces inclusion of NPCs at current location regardless of recency
 * @returns Array of NPC objects suitable for AI prompts
 */
export const getRecentNpcsFullInfo = (
  npcs: any[],
  currentTurn: number,
  currentLocationId?: string,
): any[] => {
  // Phase 1: Filter
  const filteredNpcs = npcs.filter((npc) => {
    // Condition A: Was seen/interacted within the last 30 turns
    const isRecent = currentTurn - (npc.lastInteractionTurn || 0) <= 30;

    // Condition B: Or they are physically standing in the same location (Safety Net)
    // Assume npc properties have locationId (casting to any since it's dynamically added elsewhere)
    const isHere =
      currentLocationId && (npc as any).locationId === currentLocationId;

    return isRecent || isHere;
  });

  // Phase 2: Cap at 50 to avoid token bleeding
  let cappedNpcs = filteredNpcs;
  if (filteredNpcs.length > 50) {
    // Sort descending by recency
    cappedNpcs.sort(
      (a, b) => (b.lastInteractionTurn || 0) - (a.lastInteractionTurn || 0),
    );
    cappedNpcs = cappedNpcs.slice(0, 50);
  }

  // Phase 3: Sanitize 100% properties (remove embeddings)
  return cappedNpcs.map((npc) => {
    // Copy everything
    const { embedding, sortOrder, ...cleanedNpc } = npc;
    return cleanedNpc;
  });
};

/**
 * Kiểm tra xem một NPC có phải là chủ cửa hàng / thương nhân hay không bằng cơ chế cơ học hoàn toàn.
 */
export const isShopVendor = (npc: any): boolean => {
  if (!npc) return false;
  const hasInventory = Array.isArray(npc.shopInventory) && npc.shopInventory.length > 0;
  const hasVendorType = !!npc.vendorType;
  const hasSlavesForSale = Array.isArray(npc.slavesForSale) && npc.slavesForSale.length > 0;
  const hasPrisonersForSale = Array.isArray(npc.prisonersForSale) && npc.prisonersForSale.length > 0;
  const hasVendorRole = npc.role === 'vendor' || npc.role === 'merchant' || npc.occupation === 'merchant' || npc.occupation === 'vendor' || npc.isMerchant || npc.isVendor;
  
  return !!(hasInventory || hasVendorType || hasSlavesForSale || hasPrisonersForSale || hasVendorRole);
};

