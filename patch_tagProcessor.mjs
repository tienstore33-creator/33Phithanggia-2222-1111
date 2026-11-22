import fs from 'fs';

const FILE_PATH = './utils/tagProcessors/interactionTagProcessor.ts';
let content = fs.readFileSync(FILE_PATH, 'utf8');

// The original tag processor was updated to look for 'malePartner'.
// It defaults to 'player' if not provided or provided as 'MC', 'Player', etc.
// But we need to make sure pregnancy reveal also works without 'malePartner' for now, since it only targets the mother.
// Actually, it doesn't matter for pregnancy_reveal, it only uses 'partner' (the mother).

console.log("Check complete.");
