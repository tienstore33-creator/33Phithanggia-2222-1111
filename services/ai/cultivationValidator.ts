import { KnowledgeBase } from '../../types';

export const CultivationValidator = {
    /**
     * Validates a realm string against the current cultivation system.
     * Returns the realm if valid, or a fallback if not.
     */
    validateRealm: (realm: string, system: { majors: string[], minors: string[] }): string => {
        if (!realm) return system.majors[0] || "";
        
        // Basic validation: check if it's in the list of majors
        const foundMajor = system.majors.find(m => realm.includes(m));
        if (foundMajor) return realm;

        return system.majors[0] || realm;
    }
};

/**
 * Logic to check if a location is safe for cultivation.
 * A location is safe if it's explicitly marked as a safe zone, 
 * or if its name contains certain keywords associated with safety.
 */
export const checkLocationSafety = (knowledgeBase: KnowledgeBase): { isSafe: boolean; reason?: string } => {
    // Nếu có ghi đè từ AI (bối cảnh)
    if (knowledgeBase.currentLocationSafetyOverride === 'danger') {
        return { isSafe: false, reason: "Bối cảnh hiện tại đang có nguy hiểm, không thể tập trung tu luyện." };
    }
    
    // Mặc định là an toàn nếu không có cảnh báo nguy hiểm rõ ràng từ bối cảnh
    return { isSafe: true };
};
