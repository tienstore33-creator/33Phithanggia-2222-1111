import { KnowledgeBase, GameLocation } from '../../types';

/**
 * Tìm kiếm địa điểm cha phù hợp nhất trong KnowledgeBase:
 * 1. Khớp chính xác theo ID.
 * 2. Khớp chính xác theo Tên (Name).
 * 3. Khớp mờ theo Tên (viết hoa/thường, cắt khoảng trắng thừa).
 * 4. Fallback: Nếu không khớp và chuỗi ID là ID ảo từ AI, trả về Địa điểm hiện tại (currentLocationId).
 */
export function resolveParentLocation(
  kb: KnowledgeBase,
  providedLocationIdentifier?: string
): { locationIndex: number; location: GameLocation | null; isFallback: boolean } {
  if (!kb.discoveredLocations || kb.discoveredLocations.length === 0) {
    return { locationIndex: -1, location: null, isFallback: false };
  }

  const cleanIdentifier = providedLocationIdentifier?.trim();

  // 1. Tìm chính xác theo ID hoặc Name
  if (cleanIdentifier) {
    const exactIndex = kb.discoveredLocations.findIndex(
      (l) => l.id === cleanIdentifier || l.name === cleanIdentifier
    );
    if (exactIndex > -1) {
      return { locationIndex: exactIndex, location: kb.discoveredLocations[exactIndex], isFallback: false };
    }

    // 2. Tìm mờ (không phân biệt hoa thường)
    const lowerIdentifier = cleanIdentifier.toLowerCase();
    const fuzzyIndex = kb.discoveredLocations.findIndex(
      (l) => l.name.toLowerCase() === lowerIdentifier || l.id.toLowerCase() === lowerIdentifier
    );
    if (fuzzyIndex > -1) {
      return { locationIndex: fuzzyIndex, location: kb.discoveredLocations[fuzzyIndex], isFallback: false };
    }
  }

  // 3. Fallback: Neo vào vị trí người chơi đang đứng hiện tại (currentLocationId)
  if (kb.currentLocationId) {
    const currentIndex = kb.discoveredLocations.findIndex((l) => l.id === kb.currentLocationId);
    if (currentIndex > -1) {
      return { locationIndex: currentIndex, location: kb.discoveredLocations[currentIndex], isFallback: true };
    }
  }

  // 4. Cứu cánh cuối cùng: Vị trí đầu tiên trong danh sách đã khám phá
  return { locationIndex: 0, location: kb.discoveredLocations[0], isFallback: true };
}
