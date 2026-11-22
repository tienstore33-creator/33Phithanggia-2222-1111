import { KnowledgeBase } from '../../types';

export interface CombatOpponentRecord {
    id: string;
    name: string;
    realm?: string;
    gender?: string;
    avatarUrl?: string;
    description?: string;
    defeatedTurn?: number;
}

export class PostCombatIdentityService {
    private static recentOpponents: CombatOpponentRecord[] = [];
    private static lastCombatTurn: number | null = null;

    /**
     * Record opponents defeated or engaged in the most recent combat session.
     */
    public static recordCombatSession(turn: number, opponents: CombatOpponentRecord[]): void {
        this.lastCombatTurn = turn;
        this.recentOpponents = opponents.map(op => ({ ...op, defeatedTurn: turn }));
    }

    /**
     * Check if current turn is battle+1 turn (turn immediately following a combat session).
     */
    public static isBattlePlusOneTurn(currentTurn: number, kb?: KnowledgeBase): boolean {
        if (kb?.battlePlusOneTurn != null && kb.battlePlusOneTurn === currentTurn) {
            return true;
        }
        if (this.lastCombatTurn != null && currentTurn === this.lastCombatTurn + 1) {
            return true;
        }
        return false;
    }

    /**
     * Get recent combat opponents.
     */
    public static getRecentOpponents(): CombatOpponentRecord[] {
        return [...this.recentOpponents];
    }

    /**
     * Clear active session after post-combat resolution.
     */
    public static clearSession(): void {
        this.recentOpponents = [];
        this.lastCombatTurn = null;
    }
}
