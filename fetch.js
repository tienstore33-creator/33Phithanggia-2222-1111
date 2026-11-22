const fetch = require('node-fetch');
fetch('https://huggingface.co/Xenova/bge-micro-v2/resolve/main/config.json')
  .then(res => console.log('STATUS:', res.status))
  .catch(console.error);
