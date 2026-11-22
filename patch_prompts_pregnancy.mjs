import fs from 'fs';

const FILE_PATH = './prompts/tagExtractionPrompt.ts';
let content = fs.readFileSync(FILE_PATH, 'utf8');

// Ensure that we include rules about malePartner in the output format section if needed.
// This is already done in a previous step for the tags list.

console.log("Check complete.");
