
export interface NarrativeToneConfig {
    infidelityProbability: number; // 0.0 - 1.0
    groupInteractionFrequency: 'low' | 'medium' | 'high';
    allowComplexRelationships: boolean;
    charactersPerSexualScene: number; // MC excluded
    simultaneousRelationshipsForFemales: number;
    baseResistance: number; // 0.0 (Dễ) -> 1.0 (Cực khó)
}

export const TONE_CONFIGS: Record<string, NarrativeToneConfig> = {
    "Dâm Loạn": {
        infidelityProbability: 0.9,
        groupInteractionFrequency: 'high',
        allowComplexRelationships: true,
        charactersPerSexualScene: 4,
        simultaneousRelationshipsForFemales: 4,
        baseResistance: 0.05
    },
    "Hoang Dâm": {
        infidelityProbability: 0.6,
        groupInteractionFrequency: 'medium',
        allowComplexRelationships: true,
        charactersPerSexualScene: 3,
        simultaneousRelationshipsForFemales: 3,
        baseResistance: 0.2
    },
    "Dâm Dục": {
        infidelityProbability: 0.3,
        groupInteractionFrequency: 'low',
        allowComplexRelationships: false,
        charactersPerSexualScene: 2,
        simultaneousRelationshipsForFemales: 2,
        baseResistance: 0.4
    },
    "Trung Tính": {
        infidelityProbability: 0.1,
        groupInteractionFrequency: 'low',
        allowComplexRelationships: false,
        charactersPerSexualScene: 1,
        simultaneousRelationshipsForFemales: 1,
        baseResistance: 0.8
    },
    "Tích Cực": {
        infidelityProbability: 0.05,
        groupInteractionFrequency: 'low',
        allowComplexRelationships: false,
        charactersPerSexualScene: 1,
        simultaneousRelationshipsForFemales: 1,
        baseResistance: 0.7
    },
    "Đen Tối": {
        infidelityProbability: 0.5,
        groupInteractionFrequency: 'medium',
        allowComplexRelationships: true,
        charactersPerSexualScene: 2,
        simultaneousRelationshipsForFemales: 2,
        baseResistance: 0.6
    }
};
