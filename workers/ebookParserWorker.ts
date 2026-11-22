import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';

// Cấu hình worker cho pdfjs
// Trong môi trường Vite/Web Worker, chúng ta cần trỏ tới worker script của pdfjs
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

self.onmessage = async (e) => {
  const { blob, mimeType } = e.data;
  let fullText = "";

  console.log("Worker nhận được file:", mimeType, blob.size, "bytes");

  try {
    if (mimeType === 'application/pdf') {
      console.log("Đang xử lý PDF...");
      const arrayBuffer = await blob.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ 
        data: arrayBuffer, 
        useSystemFonts: true,
        disableFontFace: true // Tránh lỗi font trong worker
      });
      
      const pdf = await loadingTask.promise;
      console.log("PDF đã tải xong, số trang:", pdf.numPages);
      
      if (pdf.numPages === 0) {
        throw new Error("File PDF không có trang nào.");
      }

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((item: any) => item.str);
        fullText += strings.join(" ") + "\n";
        
        const percent = Math.round((i / pdf.numPages) * 100);
        self.postMessage({ type: 'PROGRESS', percent });
      }
    } else if (mimeType.includes('wordprocessingml') || mimeType.includes('officedocument.wordprocessingml.document')) {
      console.log("Đang xử lý DOCX...");
      const arrayBuffer = await blob.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      fullText = result.value;
      self.postMessage({ type: 'PROGRESS', percent: 100 });
    } else {
      console.log("Đang xử lý file văn bản thuần...");
      const buffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      
      // Kiểm tra xem có phải file nén (ZIP/EPUB) không - Header "PK"
      if (uint8[0] === 0x50 && uint8[1] === 0x4B) {
        throw new Error("Đây là file nén (EPUB/ZIP). Hệ thống hiện chưa hỗ trợ trích xuất trực tiếp từ định dạng này. Vui lòng sử dụng file .txt (UTF-8), .pdf hoặc .docx.");
      }

      // Thử đọc bằng UTF-8 trước
      const decoderUtf8 = new TextDecoder('utf-8', { fatal: true });
      try {
        fullText = decoderUtf8.decode(buffer);
      } catch (e) {
        console.warn("UTF-8 decode thất bại, thử UTF-16...");
        try {
          // Thử UTF-16 (thường gặp trong một số file text xuất từ phần mềm cũ)
          const decoderUtf16 = new TextDecoder('utf-16');
          fullText = decoderUtf16.decode(buffer);
        } catch (e2) {
          console.warn("UTF-16 thất bại, thử Windows-1258...");
          // Fallback sang Windows-1258 cho tiếng Việt (thường dùng cho các file .txt cũ)
          const decoderWin1258 = new TextDecoder('windows-1258');
          fullText = decoderWin1258.decode(buffer);
        }
      }
      self.postMessage({ type: 'PROGRESS', percent: 100 });
    }

    if (!fullText || fullText.trim().length === 0) {
      throw new Error("Không thể trích xuất văn bản từ file này hoặc file trống.");
    }

    console.log("Trích xuất hoàn tất, độ dài văn bản:", fullText.length);
    self.postMessage({ type: 'COMPLETE', text: fullText });
  } catch (err) {
    console.error("Lỗi trong Worker:", err);
    self.postMessage({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) });
  }
};
