const fs = require('fs');

const json = fs.readFileSync('user_json.txt', 'utf8');
const data = JSON.parse(json);

let result = '';
for (const prompt of data.prompts) {
  if (prompt.enabled && prompt.content) {
    result += prompt.content + '\n\n';
  }
}

fs.writeFileSync('tawa_prompts.txt', result);
console.log('Saved to tawa_prompts.txt');
