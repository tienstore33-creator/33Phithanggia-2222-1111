/**
 * Worker xử lý Chunking với cơ chế Sliding Window (Gối đầu 20%)
 */
self.onmessage = (e) => {
  const { text, chunkSize = 1000, overlap = 200 } = e.data;
  const chunks = [];
  let i = 0;
  
  while (i < text.length) {
    chunks.push(text.substring(i, i + chunkSize));
    i += (chunkSize - overlap); // Tiến lên nhưng lùi lại một khoảng overlap
  }
  
  self.postMessage({ type: 'COMPLETE', chunks });
};
