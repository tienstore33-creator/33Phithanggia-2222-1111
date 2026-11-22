import { TuChatTier } from '../types';

// Exported for use in UI dropdowns and logic
export const TU_CHAT_TIERS: readonly TuChatTier[] = ["Phế Phẩm", "Hạ Phẩm", "Trung Phẩm", "Thượng Phẩm", "Cực Phẩm", "Tiên Phẩm", "Thần Phẩm", "Thánh Phẩm"];

// Used by the system to calculate EXP gain. Not shown to user.
export const TU_CHAT_MULTIPLIERS: Record<TuChatTier, number> = {
    "Phế Phẩm": 0.8,
    "Hạ Phẩm": 1.0,
    "Trung Phẩm": 1.2,
    "Thượng Phẩm": 1.5,
    "Cực Phẩm": 2.0,
    "Tiên Phẩm": 3.0,
    "Thần Phẩm": 5.0,
    "Thánh Phẩm": 10.0,
};

// Base EXP gained per turn, as a percentage of the NPC's max experience for their current realm.
// An NPC with Trung Phẩm aptitude will gain 5% of their max EXP per turn.
export const NPC_BASE_EXP_PERCENTAGE = 0.06;

// Turns an NPC stays in bottleneck before breaking through.
export const NPC_BOTTLENECK_DURATION_TURNS = 3;