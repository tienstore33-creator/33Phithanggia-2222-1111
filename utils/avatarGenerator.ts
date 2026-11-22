
export const MAX_HAIR_INDEX = 25;
export const MAX_FACE_INDEX = 25;

export const generateRandomFemaleAvatar = () => ({
  avatarUrl: undefined,
  avatarHairId: Math.floor(Math.random() * MAX_HAIR_INDEX),
  avatarFaceId: Math.floor(Math.random() * MAX_FACE_INDEX),
});

/**
 * Checks if an entity is female. Supports various entity types and global knowledge base object.
 */
export const isEntityFemale = (entity: any): boolean => {
  if (!entity) return false;
  
  // 1. If it's a string (gender directly)
  if (typeof entity === 'string') {
    return entity.toLowerCase().includes("nữ");
  }

  // 2. If it's a person object with a 'gender' property
  if (entity.gender && typeof entity.gender === 'string') {
    return entity.gender.toLowerCase().includes("nữ");
  }

  // 3. If it's the player config/knowledge base
  if (entity.worldConfig?.playerGender) {
    return entity.worldConfig.playerGender.toLowerCase().includes("nữ");
  }

  return false;
};
