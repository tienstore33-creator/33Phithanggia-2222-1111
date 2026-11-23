
import React, { useState, useEffect, useCallback } from 'react';
import { GameScreen } from '../types'; 
import Button from './ui/Button';
import Modal from './ui/Modal'; 
import Spinner from './ui/Spinner'; 
import { VIETNAMESE, GAME_TITLE, APP_VERSION, USER_MANUAL_TEXT } from '../constants';
import { useGame } from '../hooks/useGame';
import { audioService } from '../src/services/AudioService';
import { motion } from "motion/react";
import { RefreshCw, Database, MessageSquare } from 'lucide-react';
import { OriginalWorkSlot } from './OriginalWorkSlot';
import { checkConnectionWithAutoReload, getApiSettings } from '../services/apiService';
import { AVAILABLE_MODELS } from '../constants';
import { GuideMarker, GuideOverlay, GuideToggleButton } from './guide/GuideSystem';

interface InitialScreenProps {
  setCurrentScreen: (screen: GameScreen) => void;
  onSignOut: () => void; 
  isFirebaseLoading: boolean; 
  openDevInterface: () => void;
}

// Function to parse simple Markdown to HTML, now with image support
function markdownToHtml(markdownText: string): string {
    if (!markdownText) return '';
  
    let text = markdownText;
    
    // Normalize line endings
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Pre-process special elements that should be on their own line
    const urlRegex = /^(https?:\/\/[^\s]+(\.png|\.jpg|\.jpeg|\.gif|\.webp))$/i;
    text = text.split('\n').map(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.match(urlRegex)) {
          return `<img src="${trimmedLine}" alt="Hướng dẫn" class="my-4 rounded-lg shadow-md max-w-full h-auto mx-auto border-2 border-gray-700" />`;
      }
      return line;
    }).join('\n');
  
    // Handle block elements
    // Headers (###)
    text = text.replace(/^### (.*)$/gm, '<h3 class="text-xl font-semibold text-sky-400 mt-6 mb-2">$1</h3>');
  
    // Horizontal Rule (---)
    text = text.replace(/^---$/gm, '<hr class="my-6 border-gray-700" />');
  
    // Pre-process bold within lines before list/paragraph logic
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-yellow-400">$1</strong>');
    
    // Lists (* item)
    let lines = text.split('\n');
    let newLines: string[] = [];
    let inListScope = false;
  
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const listItemMatch = line.match(/^(\s*)\* (.*)/);
      if (listItemMatch) {
        if (!inListScope) {
          newLines.push('<ul class="list-disc list-outside pl-6 my-3 space-y-1.5 text-gray-300">');
          inListScope = true;
        }
        newLines.push(`<li>${listItemMatch[2]}</li>`);
      } else {
        if (inListScope) {
          newLines.push('</ul>');
          inListScope = false;
        }
        newLines.push(line);
      }
    }
    if (inListScope) { 
      newLines.push('</ul>');
    }
    text = newLines.join('\n');
  
    // Paragraphs
    lines = text.split('\n');
    newLines = [];
    let paragraphBuffer: string[] = [];
  
    const flushParagraph = () => {
      if (paragraphBuffer.length > 0) {
        newLines.push(`<p class="my-2 text-gray-300 leading-relaxed">${paragraphBuffer.join('<br />')}</p>`);
        paragraphBuffer = [];
      }
    };
  
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('<h3') || trimmedLine.startsWith('<hr') || 
          trimmedLine.startsWith('<ul') || trimmedLine.startsWith('</ul') || 
          trimmedLine.startsWith('<li') || trimmedLine.startsWith('<img')) {
        flushParagraph(); 
        newLines.push(line);
      } else if (trimmedLine === '') {
        flushParagraph(); 
      } else {
        paragraphBuffer.push(line); 
      }
    }
    flushParagraph(); 
  
    return newLines.join('\n').replace(/(\n\s*){2,}/g, '\n').trim();
}

const LOCAL_UPDATE_NOTES = `
### 🌟 CẬP NHẬT MỚI: KHÓA CẤU TRÚC STRUCTURED OUTPUTS & FEW-SHOT MULTI-TURN CHO 5 MODEL ĐỜI MỚI (Phiên bản 12.0.3)
* **Áp dụng đồng bộ Cách 1 + Cách 3 cho \`Gemini 4 Hydrogen\` và \`Gemini Flash 3.5 / 3.6 / 3.7 / 3.8\`**:
  - Bật **Structured Outputs (\`responseSchema\`)** khóa cứng cấu trúc JSON theo thứ tự \`thinking -> content -> entity_tracking -> update_data -> flash_summary -> choices\` thay thế cơ chế prefill cuối lượt.
  - Kết hợp **Few-Shot Multi-Turn chuẩn (\`user -> model -> user\`)** sử dụng trực tiếp mẫu đồng thẩm định từ \`promptTaskHelpers.ts\` và bộ chuyển đổi Stream JSON sang XML theo thời gian thực để tương thích hoàn toàn với \`ThinkingLog\`, \`StoryLog\` và hệ thống bóc tách tag.

### 🌟 CẬP NHẬT MỚI: TÙY CHỌN "VIẾT LẠI TỪ ĐẦU" KHI LỜI KỂ ĐỨT ĐOẠN (Phiên bản 12.0.2)
* **Chủ động hủy bản nháp đứt đoạn & tạo mới hoàn toàn**:
  - Bổ sung nút **Viết lại từ đầu** ngay trong bảng thông báo *Lời Kể Bị Đứt Đoạn*, cho phép chọn model AI khác từ danh sách, xóa sạch đoạn lời kể viết dở trên giao diện và phát trực tiếp (stream) lại toàn bộ lượt kể từ đầu.
  - Bảo toàn nguyên vẹn bộ đếm vòng lặp cốt truyện (\`arcState\`) và tự động reset số lần bù đắp khi khởi tạo lại bản viết mới.

### 🌟 CẬP NHẬT MỚI: TỐI ƯU ĐƯỜNG TRUYỀN FAST-LANE PROXY CHO 5 MODEL CHỈ ĐỊNH (Phiên bản 12.0.1)
* **Tăng tốc độ phản hồi stream & tối ưu kết nối server**:
  - Tách luồng **Fast-Lane Pass-Through** chuyên biệt cho \`Gemini 4 Hydrogen\` và \`Gemini Flash 3.5 / 3.6 / 3.7 / 3.8\`, loại bỏ bước trung gian parse/stringify 2 lần và giữ nguyên payload gốc khi đi qua proxy nội bộ.
  - Bổ sung đẩy gói SSE tức thì (\`flushHeaders\` + \`setNoDelay\`), đồng bộ tín hiệu hủy kết nối (\`AbortController\`) trực tiếp xuống Google khi người dùng dừng hoặc hết thời gian chờ, và nới rộng socket timeout phục vụ suy luận sâu.

### 🌟 CẬP NHẬT MỚI: CƠ CHẾ LỰA CHỌN THINKING LEVEL THEO TỪNG MODEL (Phiên bản 12.0.0)
* **Kiểm soát mức suy luận chuyên sâu cho từng tác vụ & model**:
  - Bổ sung bộ chọn **Thinking Level** trực quan ngay bên dưới Model Cốt Truyện Chính, Kinh Tế & Chiến Đấu (tự động nhận diện các mức hỗ trợ như \`MINIMAL\`, \`LOW\`, \`MEDIUM\`, \`HIGH\`, \`XHIGH\`).
  - Tích hợp danh sách **Tùy chỉnh Thinking Level theo từng Model** dạng thu gọn (Accordion) và menu chọn nhanh ngay trên từng dòng trong bảng **Cấu hình Model Dự Phòng (Fallback)**.
  - Đồng bộ truyền cấu hình \`thinkingConfig\` xuống toàn bộ luồng gọi Gemini API (bao gồm cả xử lý an toàn tương thích cho Gemini 4 và Gemini 2.5).

### 🌟 CẬP NHẬT MỚI: CHUẨN HÓA CỔNG THẨM ĐỊNH NHIỆM VỤ YGGDRASIL (Phiên bản 11.7.0)
* **Tăng cường độ tuân thủ & đồng bộ nhiệm vụ cốt truyện**:
  - Tách riêng module \`questThinkingRules.ts\` với quy trình 4 bước kiểm chứng nhiệm vụ cho thanh tra Yggdrasil kèm ví dụ đối xứng chống xác nhận ảo.
  - Bổ sung chốt kiểm định chéo tại bước tổng duyệt cuối (\`FINAL ASSEMBLY\`), ép đồng bộ phán quyết sang \`<update_data>\` cho cả chế độ thường và Siêu Mạt Pháp.
  - Hiển thị thẻ trạng thái **Yggdrasil Quest Audit Gate** trực quan ngay trong \`Raw Log\` khi chơi.

### 🌟 CẬP NHẬT MỚI: LOẠI BỎ THẺ <Warudo_Secret> (Phiên bản 11.6.0)
* **Tiếp tục tối ưu hóa không gian ngữ cảnh**:
  - Gỡ bỏ hoàn toàn việc sinh và xử lý thẻ \`<Warudo_Secret>\` trên toàn hệ thống.
  - Tinh gọn các định nghĩa cú pháp thẻ và luồng phân tích của AI phụ.

### 🌟 CẬP NHẬT MỚI: TINH GỌN CẤU TRÚC ĐẦU RA - GỠ BỎ <World_Pulse> & <Faction_Dynamics> (Phiên bản 11.5.0)
* **Tối ưu hiệu suất & tiết kiệm Token**:
  - Ngừng yêu cầu AI chính tạo hai khối thẻ hậu trường \`<World_Pulse>\` và \`<Faction_Dynamics>\`, chỉ giữ lại \`<Entity_Tracking>\`, \`<Warudo_Secret>\` và \`<update_data>\`.
  - Tinh gọn luồng đọc và bóc tách dữ liệu tại Tag Extractor, Flash Agent và bộ xử lý văn bản hệ thống.
  - Vẫn duy trì bộ lọc ẩn tương thích ngược cho các file save cũ.

### 🌟 CẬP NHẬT MỚI: CƠ CHẾ XÁC NHẬN HOÀN THÀNH NHIỆM VỤ 2 TẦNG & KHÓA TUỔI THỌ TỰ ĐỘNG (Phiên bản 11.4.0)
* **Phối hợp AI chính & Thiên Đạo Sync (Tag Extractor)**:
  - AI chính chủ động đề xuất xác nhận hoàn thành nhiệm vụ và sự kiện dòng thời gian vào thẻ \`<update_data>\` khi giải quyết xong mục tiêu cốt lõi.
  - Tag Extractor thực hiện kiểm định chéo bằng chứng (Propose & Verify) trước khi chính thức chốt tag \`[QUEST_COMPLETED]\` hoặc \`[EVENT_COMPLETE]\`.
* **Khóa Tuổi Thọ Tự Động theo Cảnh Giới**:
  - Áp dụng yêu cầu độ tuổi tối thiểu cho các Đại cảnh giới thứ 3 trở lên khi chế độ tu tiên (\`Tutienhiep === 1\`) được kích hoạt.

### 🌟 CẬP NHẬT MỚI: CƠ CHẾ ĐỒNG BỘ VÀ CHUYỂN ĐỔI MODEL EMBEDDING VECTOR (Phiên bản 10.8.0)
* **Bảo vệ và di trú dữ liệu RAG linh hoạt**:
  - Tích hợp công cụ chuyển đổi toàn bộ vector ký ức và truyện gốc giữa Gemini API và BGE-Micro-V2 (Local).
  - Tự động nhận diện và hỗ trợ tải model BGE (~30MB) về trình duyệt để chạy offline hoàn toàn.
  - Tái vector hóa 100% dữ liệu dựa trên văn bản gốc, đảm bảo tính an toàn và tương thích tuyệt đối khi đổi nguồn API.
  - Giao diện điều khiển trực quan tích hợp ngay trong Bảng Mục Lục của Nhật ký hành trình.

### 🌟 CẬP NHẬT MỚI: DI DỜI TOÀN BỘ GEMINI API SANG SERVER-SIDE & CHUẨN HÓA HỆ THỐNG FULL-STACK (Phiên bản 9.99.0)
* **Nâng cấp kiến trúc bảo mật và ổn định**:
  - Di dời toàn bộ các lệnh gọi google/genai (bao gồm streaming, text generation, image generation, Live API) từ trình duyệt lên server-side thông qua Express backend routes.
  - Cập nhật metadata với năng lực \`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API\`.
  - Giữ nguyên vẹn giao diện người dùng và hành vi trải nghiệm.

### 🌟 CẬP NHẬT MỚI: BẢO ĐẢM HIỂN THỊ NÚT PILL NGUỒN TIN CHO MỌI PHẢN HỒI AI (Phiên bản 9.96.0)
* **Khắc phục triệt để hiện tượng mất nút Pill**:
  - Đảm bảo nút Pill luôn luôn xuất hiện bên dưới mọi phản hồi của AI (kể cả câu trả lời có tra web hoặc sử dụng tri thức nội tại).
  - Khi có trang web tra cứu: Nút hiển thị số lượng trang web (\`🔗 N trang web ▼\`).
  - Khi câu trả lời dùng tri thức nội tại: Nút hiển thị minh bạch (\`✨ 0 trang web (Tri thức nội tại) ▼\`) và giải thích nguồn gốc khi bấm mở.
  - Bổ sung quy tắc bắt buộc AI luôn chủ động kích hoạt Google Search Grounding để tìm kiếm tài liệu cho mọi câu hỏi.

### 🌟 CẬP NHẬT MỚI: MẶC ĐỊNH THU GỌN DANH SÁCH NGUỒN TIN TRA CỨU DƯỚI DẠNG NÚT PILL (Phiên bản 9.95.0)
* **Tối ưu hóa không gian hiển thị tin nhắn Chatbot**:
  - Toàn bộ danh sách trang web nguồn và các từ khóa tra cứu ban đầu được thu gọn hoàn toàn trong nút pill gọn gàng (ví dụ: \`🔗 11 trang web ▼\`).
  - Chỉ khi người dùng chủ động bấm vào nút pill, khung chi tiết các thẻ liên kết và từ khóa đối chiếu mới mở ra, tránh tình trạng chiếm trọn không gian màn hình điện thoại.
  - Áp dụng đồng bộ cho cả nguồn tham khảo của AI chính lẫn AI kiểm định (Verifier).

### 🌟 CẬP NHẬT MỚI: DANH SÁCH THẺ LIÊN KẾT NGUỒN TIN (LINK CHIPS) TRỰC TIẾP CHO PHẢN HỒI & AI KIỂM ĐỊNH (Phiên bản 9.94.0)
* **Thẻ liên kết trực quan (Clickable Link Chips)**:
  - Bổ sung danh sách các thẻ chip liên kết có thể nhấp trực tiếp (Clickable Link Chips) ngay bên dưới mỗi bong bóng phản hồi của AI và bên trong khối kết quả kiểm chứng của Verifier.
  - Hiển thị đầy đủ nguồn gốc: Tên trang web, tên miền rút gọn và biểu tượng liên kết ngoài giúp người dùng truy cập ngay lập tức đến tài liệu đối chiếu.
  - Hỗ trợ mở rộng/thu gọn số lượng nguồn tin và hiển thị danh sách từ khóa tìm kiếm mà AI đã tra cứu.

### 🌟 CẬP NHẬT MỚI: HIỂN THỊ NGUỒN THAM KHẢO & LIÊN KẾT TÀI LIỆU TRA CỨU TRỰC TUYẾN CHO CHATBOT (Phiên bản 9.93.0)
* **Trích xuất và hiển thị dữ liệu đối chiếu thực tế (Google Search Grounding)**:
  - Bổ sung nút huy hiệu **"N nguồn tham khảo"** trực quan bên dưới mỗi tin nhắn phản hồi của AI và trong bảng kết quả kiểm chứng.
  - Hỗ trợ xem danh sách các từ khóa tra cứu thực tế cùng các liên kết trang web/tài liệu nguồn (Tiêu đề, Tên miền, Đường dẫn trực tiếp) giúp người dùng dễ dàng tra cứu, kiểm chứng chéo thông tin.

### 🌟 CẬP NHẬT MỚI: TÍCH HỢP GOOGLE SEARCH GROUNDING CHO CẢ PHẢN HỒI VÀ THẨM ĐỊNH AI (Phiên bản 9.92.0)
* **Liên kết dữ liệu tra cứu trực tuyến thời gian thực**:
  - Kích hoạt thành công công cụ tra cứu Google Search Grounding (\`googleSearch\`) cho cả luồng phản hồi chính của Chatbot và luồng kiểm chứng độc lập của Verifier.
  - Giúp AI có khả năng truy xuất sự kiện, dữ kiện thực tế thời gian thực, triệt tiêu lỗi phán đoán tĩnh và nâng cao độ chuẩn xác khi giám định tính chân thực của thông tin.

### 🌟 CẬP NHẬT MỚI: BỔ SUNG QUY TẮC CHỐNG BỊA ĐẶT & HOANG TƯỞNG CHO CHATBOT SANDBOX (Phiên bản 9.91.0)
* **Thêm nguyên tắc ứng xử minh bạch cho AI Sandbox**:
  - Bổ sung quy tắc Anti-Hallucination nghiêm ngặt trong \`<quy_tac_chatbot_sandbox>\`: Yêu cầu AI tuyệt đối không bịa đặt, ngụy tạo hay tự suy đoán thông tin hoang tưởng.
  - Trường hợp thiếu dữ liệu chính xác và liên quan để phản hồi, AI được phép tuyên bố minh bạch: *"vì thiếu dữ kiện chính xác và liên quan, tôi không thể đưa ra nội dung chính xác"*.

### 🌟 CẬP NHẬT MỚI: CHUYỂN DẠNG BẢNG KIỂM CHỨNG THÀNH DROPDOWN THU GỌN CHUYÊN NGHIỆP (Phiên bản 9.90.0)
* **Thu gọn nội dung kiểm chứng theo cơ chế Dropdown / Accordion**:
  - Khung kết quả kiểm chứng ban đầu chỉ hiển thị thanh tiêu đề ngắn gọn: \`✅ ĐÃ KIỂM CHỨNG: NỘI DUNG CHÂN THỰC & CHUẨN XÁC\` (màu xanh lá) hoặc \`⚠️ PHÁT HIỆN CHI TIẾT BỊA ĐẶT / SAI LỆCH\` (màu đỏ).
  - Chỉ khi người dùng nhấp vào thanh tiêu đề (hoặc biểu tượng mũi tên xổ xuống), toàn bộ phần giải trình thẩm định chi tiết mới được mở ra.

### 🌟 CẬP NHẬT MỚI: HOÀN THIỆN ĐÁNH DẤU CHUẨN XÁC VÀ TÔ KHUNG XANH LÁ CHO PHẢN HỒI AI TRUNG THỰC (Phiên bản 9.89.0)
* **Chuẩn hoá định danh & Giao diện Khung Xanh Lá**:
  - Khắc phục triệt để lỗi phân loại nhầm khi AI giải trình câu "không có chi tiết bịa đặt" nhờ thẻ XML chuẩn hóa \`<ket_luan>CHINH_XAC</ket_luan>\` và \`<ket_luan>BIA_DAT</ket_luan>\`.
  - Khi phản hồi của AI được kiểm chứng là trung thực và không bịa đặt, toàn bộ khung phản hồi sẽ được tô viền xanh lá nổi bật (\`border-emerald-500\`), đổi màu avatar đại diện và gắn nhãn \`✅ Đã kiểm chứng: Chính xác\`.

### 🌟 CẬP NHẬT MỚI: TÍCH HỢP NÚT KIỂM CHỨNG TÍNH CHÂN THỰC & BẢO ĐẢM TRUNG THỰC CHO PHẢN HỒI AI (Phiên bản 9.88.0)
* **Thẩm định độc lập bằng model combat chuyên trách**:
  - Bổ sung nút "Kiểm chứng" ở cuối mỗi phản hồi của AI Sandbox.
  - Toàn bộ nội dung câu trả lời được đưa vào luồng thẩm định độc lập do AI (sử dụng model category combat) phân tích, đặt trọng tâm vào tính trung thực, không bao che và kiểm tra ngụy tạo/bịa đặt (hallucination).
  - Tự động phát hiện và chỉ đích danh các chi tiết sai lệch, đồng thời tô đỏ toàn bộ khung cảnh báo phản hồi khi có yếu tố bịa đặt.
### 🌟 CẬP NHẬT MỚI: TÁI CẤU TRÚC TOÀN DIỆN CƠ CHẾ GỌI API KỂ CHUYỆN MỞ ĐẦU (LƯỢT 0) THEO CHUẨN MỚI NHẤT (Phiên bản 11.9.0)
* **Chuẩn hóa cơ chế gọi API lượt khởi đầu theo kiến trúc mới nhất**:
  - Tách biệt thành service chuyên biệt \`/services/initialStoryStreamService.ts\`, tuân thủ chuẩn @google/genai TypeScript SDK.
  - Tích hợp cơ chế Dual-Stage Google Search: Tự động chạy với Search Grounding, và khi chạm lỗi 429 Quota Search, hệ thống tự động suy thoái sang chế độ thuần văn bản ngay trên cùng Model/Key để đảm bảo mở đầu game luôn thông suốt.
  - Điều tiết qua hàng đợi độc quyền GlobalApiQueue (Priority: 0 - Cao nhất) ngăn chặn xung đột spike traffic.
  - Quản lý xoay vòng và duyệt triệt để toàn bộ danh sách API Key trước khi chuyển Fallback Model.
  - Khai báo log và quản lý tác vụ chuẩn Luuyngudan5.

### 🌟 CẬP NHẬT MỚI: TÁI CẤU TRÚC TOÀN DIỆN CƠ CHẾ GỌI API CHATBOT THEO CHUẨN MỚI NHẤT (Phiên bản 11.8.0)
* **Xóa bỏ triệt để lỗi 429 và tối ưu luồng gọi API**:
  - Tích hợp cơ chế Dual-Stage Google Search: Tự động chạy với Search Grounding, và khi phát hiện lỗi 429 do cạn kiệt Quota Search, hệ thống tự động suy thoái mượt mà sang chế độ xử lý thuần văn bản không dùng Search ngay trên cùng Model/Key thay vì văng lỗi.
  - Sửa lỗi ngắt vòng lặp API Key: Cho phép duyệt trọn vẹn qua toàn bộ danh sách API Key hợp lệ thay vì thoát sớm sau lỗi của key đầu tiên.
  - Tích hợp Global API Queue: Điều tiết các yêu cầu Chatbot tuần tự và chống xung đột đột biến traffic (Spike Traffic).
  - Khai báo log và quản lý tác vụ theo chuẩn Luuyngudan5.

### 🌟 CẬP NHẬT MỚI: TÍCH HỢP QUẢN LÝ ĐA PHIÊN & TẠO ĐOẠN CHAT MỚI CHO CHATBOT SANDBOX (Phiên bản 9.87.0)
### 🌟 CẬP NHẬT MỚI: TÍCH HỢP TOÀN DIỆN 5 MÔ HÌNH LÝ THUYẾT TRÒ CHƠI NÂNG CAO (Phiên bản 11.3.0)
* **Xây dựng hệ sinh thái mưu lược tu tiên 5 tầng (Signaling, Repeated, Threat, Stackelberg, Auction)**:
  - **Signaling Game**: Bóc tách bất cân xứng thông tin, giấu thực lực ("Giả heo ăn hổ") hoặc phô trương thanh thế của MC.
  - **Repeated Game**: Tích lũy điểm Ân Oán Tích Lũy và kích hoạt chiến lược Tit-for-Tat (Ăn miếng trả miếng / Đổi ân báo nghĩa).
  - **Credible Threat**: Thẩm định lời đe dọa của MC là uy hiếp có trọng lượng thực tế hay chỉ là nói suông (Cheap Talk).
  - **Stackelberg & Auction**: Phân định Lãnh chúa áp đặt ván cờ và chiến thuật định giá / ép giá tài nguyên trong giao dịch.
  - Tích hợp trực tiếp vào khối suy nghĩ ngầm &lt;thinking&gt; và lời kể tự nhiên của AI chính.

### 🌟 CẬP NHẬT MỚI: TÍCH HỢP TRÒ CHƠI TỔNG BẰNG 0 & CHIẾN LƯỢC MINIMAX TRONG GAME THEORY (Phiên bản 11.2.0)
* **Áp dụng Mô hình Trò chơi tổng bằng 0 (Zero-Sum Game) & Cân bằng Minimax**:
  - Tích hợp mô hình bảo toàn tổng bằng 0 vào ma trận lợi ích: tài nguyên hoặc lợi ích NPC trục lợi được chính là tổn thất trực tiếp của người chơi (MC), tạo sự cạnh tranh tài nguyên khốc liệt.
  - Thay thế hoặc bổ sung Cân bằng Nash bằng Giải pháp Minimax tối ưu để NPC phòng thủ, né tránh hoặc cướp bóc dựa trên bất cân xứng thông tin và chênh lệch cảnh giới.
  - Cập nhật toàn diện quy trình tư duy ngầm trong khối &lt;thinking&gt; và các prompt hệ thống.

* **Tạo đoạn chat mới & lưu trữ lịch sử độc lập**:
  - Khi bấm "+ Đoạn Chat Mới", hệ thống tự động lưu trữ toàn bộ nội dung của phiên trò chuyện hiện tại vào danh sách lịch sử và mở ra một phiên hội thoại mới hoàn toàn độc lập.
  - Ngữ cảnh trò chuyện (Context/History) của đoạn chat mới được cách ly triệt để, không mang theo thông tin hay tin nhắn từ các đoạn chat cũ.
  - Bổ sung giao diện Modal "Lịch Sử Các Đoạn Chat" cho phép xem lại danh sách, duyệt xem tin nhắn đầu, chuyển đổi nhanh giữa các phiên hoặc xóa từng đoạn chat theo ý muốn.

### 🌟 CẬP NHẬT MỚI: LOẠI TRỪ NPC CHỦ TIỆM KHỎI NHÁNH TÁI NGỘ QUÊN LÃNG (Phiên bản 9.86.0)
* **Tiêu huỷ hoàn toàn dữ liệu NPC chủ tiệm khi dọn dẹp bộ nhớ**:
  - Khi một NPC chủ tiệm đạt ngưỡng 60 lượt không tương tác liên tiếp, họ sẽ bị xoá sổ vĩnh viễn khỏi database mà không lưu tên vào mảng dự bị \`forgottenNPCs\`.
  - Triệt tiêu hoàn toàn khả năng nhánh Tái Ngộ Quên Lãng (Forgotten Pool) bốc trúng và hồi sinh một NPC chủ tiệm cũ dưới dạng không có kho hàng cơ học.

### 🌟 CẬP NHẬT MỚI: TỰ ĐỘNG NHẬN DIỆN VÀ ĐÁNH DẤU CHỦ TIỆM CƠ HỌC CHO NPC (Phiên bản 9.85.0)
* **Nhận diện cơ học 100% không phụ thuộc vào từ khóa tên**:
  - Tự động nhận diện mọi NPC sở hữu kho hàng kinh doanh (\`shopInventory\`), loại hình thương nhân (\`vendorType\`), sạp nô lệ/tù nhân thương mại hoặc chức nghiệp kinh doanh.
  - Gắn nhãn trực quan \`🏪 Chủ Tiệm\` tinh tế ngay bên cạnh tên NPC trong bảng Panel Thế Giới (WorldSidePanel) và Modal Xem Chi Tiết Nhân Vật (EntityDetailModal).

### 🌟 CẬP NHẬT MỚI: CHU KỲ KIỂM SOÁT NHỊP ĐỘ TUNG MANH MỐI TIMELINE CỨ MỖI 2 LƯỢT (Phiên bản 9.84.0)
* **Tự động hóa nhịp độ cốt truyện dòng thời gian**:
  - Chu kỳ điểm rơi 2 lượt (Turn % 2 == 0): Bắt buộc AI Dẫn chuyện lồng ghép đồng thời hai luồng thông tin: manh mối thực tế hỗ trợ sự kiện hiện tại, và điềm báo/tin đồn hé lộ sự kiện tiếp theo.
  - Tiết chế cốt truyện ở lượt lẻ: Giảm tải nhồi nhét, tập trung 100% vào các chi tiết tương tác vi mô, hành động của người chơi và NPC để cốt truyện phát triển mượt mà, tự nhiên.
  - Đảm bảo tính khách quan giác quan: Toàn bộ manh mối và điềm báo phải được diễn tả thông qua các hiện tượng khách quan (nhìn thấy, nghe thấy, tin đồn giang hồ), cấm tuyệt đối cấy suy nghĩ vô căn cứ vào tâm thức MC.

### 🌟 CẬP NHẬT MỚI: CHUẨN HOÁ HỆ THỐNG GỢI Ý HÀNH ĐỘNG PHẢN ỨNG BỐI CẢNH & SẮC THÁI DỤC VỌNG (Phiên bản 9.83.0)
* **Tối ưu hóa gợi ý lựa chọn hành động (6 - 8 lựa chọn)**:
  - Phản ứng trực tiếp với biến cố can thiệp: Bắt buộc các lựa chọn phải bám sát diễn biến và tin tức mới nhất vừa diễn ra trong lượt kể, triệt tiêu việc lặp lại hành động cũ.
  - Xóa bỏ ảo giác toàn tri / Cấm tiên tri: Giới hạn suy nghĩ và hành động của MC theo đúng tầm nhìn giác quan thực tế tại chỗ, nghiêm cấm biết trước bố cục khu vực chưa tiến vào.
  - Sắc thái Dục Vọng (Lust Nuance): Trong các cảnh 18+, gợi ý hành động tự động thích ứng với 4 trạng thái (Thống trị, Đồng điệu, Phục tùng, Trêu ghẹo).
  - Xen kẽ 1 - 3 hành vi phi lý & hài hước: Đan xen những lựa chọn phá cách, trớ trêu bất ngờ để tăng tính giải trí và bất ngờ cho diễn biến câu chuyện.

### 🌟 CẬP NHẬT MỚI: CƠ CHẾ THU HOẠCH 50% TRANG BỊ TỪ KẺ ĐỊCH BỊ KẾT LIỄU TRONG CHIẾN ĐẤU (Phiên bản 9.98.0)
* **Quy tắc cơ học nhặt 50% trang bị từ kẻ địch bị kết liễu**:
  - Áp dụng đồng bộ cho cả hai giao diện chiến đấu (Classic - CombatScreenold và RealTime - RealTimeCombatScreen).
  - Khi chiến thắng và chọn "Kết Liễu" (kill) kẻ địch, hệ thống tự động quét toàn bộ trang bị đối thủ đang mặc và trích xuất đúng 50% số lượng trang bị (hoặc 50% xác suất nếu có 1 món).
  - Tự động bổ sung trang bị thu hoạch được vào túi đồ nhân vật chính (Inventory), dọn sạch kho đồ NPC và gửi chỉ thị cho AI miêu tả hành vi thu hoạch chiến lợi phẩm trong lượt truyện.

### 🌟 CẬP NHẬT MỚI: TÍCH HỢP PHÂN ĐOẠN SONG SONG 18+ CHO CƠ CHẾ NPC TÁI NGỘ (Phiên bản 9.97.0)
* **Xác suất 50% cơ học kích hoạt tình huống làm tình với người khác**:
  - Khi bật Chế độ Người lớn (18+), tại Bước 2 (Phân đoạn song song / Gián tiếp) của cơ chế tái ngộ, hệ thống tự động tính toán xác suất cơ học 50%.
  - Áp dụng cho mọi NPC (kể cả Vợ, Đạo lữ, Nô lệ và Bạn đồng hành) vắng mặt lâu ngày khi diễn ra chuyển cảnh phương xa.
  - Bọc thẻ XML quy chuẩn ép buộc AI miêu tả tình huống NPC đang làm tình với người khác theo đúng phong cách 18+ đã cài đặt mà MC không nhận thức được.

### 🌟 CẬP NHẬT MỚI: CHUẨN HOÁ CƠ CHẾ LÀM TÌNH QUÁ ĐỘ & HIỂN THỊ CHỈ SỐ VÀO TIN NHẮN HỆ THỐNG (Phiên bản 9.82.0)
* **Tối ưu hóa hao tổn Sinh Lực & kinh nghiệm mây mưa**:
  - Hao tổn Sinh Lực (HP Loss): Giảm ngay lập tức 5% Sinh lực hiện tại (tính dựa trên Max HP đầy đủ) cho cả nhân vật nam và nữ tham gia sự kiện làm tình.
  - Tích lũy Kinh Nghiệm (EXP Gain): Nếu sống sót, cả hai nhân vật cùng nhận được điểm Kinh nghiệm tương đương 5% tổng chỉ số Max HP cơ bản của cả hai.
  - Thông báo bảng tin Game Messenger: Tự động chèn thông tin biến động HP và Kinh nghiệm của các bên tham gia ngay bên dưới dòng "[Thiên đạo] ... đã làm tình với ...".

### 🌟 CẬP NHẬT MỚI: TÍCH HỢP HỆ THỐNG NHU CẦU SINH LÝ & TÌNH TRẠNG CHƯA THỎA MÃN CỦA NPC (Phiên bản 9.81.0)
* **Quản lý nhu cầu làm tình cơ học & phản phệ tâm lý NPC**:
  - Tự động theo dõi tổng số lần quan hệ tình dục tích lũy (\`totalSexCount\`) và tiến trình mây mưa liên tục (\`currentSexStreak\`) của từng NPC một cách ẩn mật.
  - Công thức tính nhu cầu tăng dần: Nhu cầu = Math.floor(Lịch sử quan hệ / 3) hiệp liên tiếp (tối thiểu 1 hiệp).
  - Tự động ép buộc AI mô tả phản ứng dồn dập, liên tục đòi hỏi của NPC nếu chưa đạt đủ số hiệp nhu cầu sinh lý tích lũy.
  - Xử lý cơ chế hụt hẫng (MC dừng lại dở dang khi chưa đạt đủ chỉ tiêu): NPC rơi vào trạng thái bực tức (\`isSexDissatisfied\`), giảm 10 hảo cảm, và ở các lượt sau sẽ giận hờn, ve vãn quấy rầy và liên tục mắng mỏ, trêu ghẹo MC là "yếu sinh lý", "vô dụng", "kém cỏi".

### 🌟 CẬP NHẬT MỚI: ĐƯA MODEL HOẠT ĐỘNG VÀO DANH SÁCH FALLBACK (Phiên bản 10.7.0)
* **Tích hợp nút thao tác nhanh trong Model Ping Tester**:
  - Bổ sung nút \`Đưa Model Hoạt Động Vào Fallback\` xuất hiện ngay khi có model kiểm tra ping thành công.
  - Tự động thay thế danh sách Fallback tùy chỉnh của cả 3 danh mục (Cốt truyện chính, Kinh tế, Chiến đấu) bằng toàn bộ các model đang hoạt động, giữ nguyên thứ tự ban đầu và chế độ Fallback của từng mục.
  - Tự động lưu cấu hình Fallback vào \`localStorage\` mà không cần thao tác lưu thủ công.

### 🌟 CẬP NHẬT MỚI: TỰ ĐỘNG LƯU NGUỒN API KHI TẢI MODEL (Phiên bản 10.6.0)
* **Tự động đồng bộ nguồn API vào bộ nhớ**:
  - Khi cấu hình nguồn Proxy hoặc Key Hệ Thống (hoặc Key Cá Nhân) và bấm nút \`Tải Model\`, hệ thống tự động ghi nhớ và lưu cấu hình nguồn API vào \`localStorage\`.
  - Giúp các công cụ kiểm tra (Model Ping Tester) hoặc tính năng gọi AI lập tức nhận đúng nguồn Proxy/System mà không cần bấm nút "Lưu Cài Đặt".

### 🌟 CẬP NHẬT MỚI: ĐỒNG BỘ ƯU TIÊN FALLBACK MODEL TRONG CHUỖI GỌI API AI (Phiên bản 10.5.0)
* **Chuẩn hóa cơ chế xử lý lỗi khi gọi API**:
  - Đồng bộ toàn bộ các service gọi API AI (Kể chuyện, Stream, Chatbot, Avatar, Item/Skill).
  - Khi gặp lỗi bất kỳ (bao gồm lỗi 400 Invalid API Key), hệ thống giữ nguyên API Key hiện tại và ưu tiên chuyển ngay sang Model tiếp theo trong chuỗi \`modelChain\`.

### 🌟 CẬP NHẬT MỚI: ĐỒNG BỘ ĐIỀU KIỆN KHÓA TUỔI THỌ VỚI CHỈ SỐ TUTIENHIEP=1 (Phiên bản 11.1.0)
* **Kích hoạt Khóa Tuổi Thọ cơ học khi \`Tutienhiep === 1\`**:
  - Tích hợp kiểm tra điều kiện chỉ số \`Tutienhiep === 1\` vào bộ máy xử lý gỡ bình cảnh \`statsTagProcessor.ts\`.
  - Đảm bảo rào cản độ tuổi tối thiểu khi đột phá Đại Cảnh Giới từ thứ 3 trở lên chỉ xuất hiện duy nhất ở các game thuộc thể loại Tu Tiên / Tiên Hiệp.

### 🌟 CẬP NHẬT MỚI: TỰ ĐỘNG PHÂN TÍCH & GÁN CHỈ SỐ TUTIENHIEP BỞI TAG EXTRACTOR (Phiên bản 11.0.0)
* **Tự động nhận diện thể loại Tu Tiên / Tiên Hiệp**:
  - Thêm chỉ số \`Tutienhiep\` trong cơ sở dữ liệu game.
  - Khi game chưa có chỉ số \`Tutienhiep\` (chưa có giá trị 0 hoặc 1), Tag Extractor sẽ tự động phân tích bối cảnh, thế giới, cảnh giới, công pháp và pháp bảo để xác định.
  - Gán \`Tutienhiep=1\` nếu thuộc thể loại Tu Tiên/Tiên Hiệp; gán \`Tutienhiep=0\` cho các thể loại khác.
  - Khi đã có giá trị 0 hoặc 1, hệ thống lập tức ngừng tiêm prompt phân tích để tiết kiệm token và thời gian xử lý.

### 🌟 CẬP NHẬT MỚI: CƠ CHẾ KHOÁ TUỔI THỌ KHI ĐỘT PHÁ ĐẠI CẢNH GIỚI (Phiên bản 10.9.0)
* **Thiết lập rào cản độ tuổi tối thiểu cho đại cảnh giới cao**:
  - Áp dụng khoá tuổi thọ cho các đại cảnh giới từ cảnh giới thứ 3 trở lên trong thế giới tu tiên.
  - Công thức yêu cầu: \`Tuổi tối thiểu = (Số thứ tự đại cảnh giới tiếp theo - 1) * 20\`.
  - Cụ thể: Để đột phá lên đại cảnh giới thứ 3 cần tối thiểu 20 tuổi, đại cảnh giới thứ 4 cần tối thiểu 40 tuổi, và tiếp tục tăng dần cho các cảnh giới cao hơn.
  - Thông báo rõ ràng nguyên nhân thất bại và yêu cầu cụ thể khi nhân vật chưa đạt đủ độ tuổi chín muồi về căn cơ.

### 🌟 CẬP NHẬT MỚI: KHẮC PHỤC LỖI INCOMPLETE JSON SEGMENT CHO FLASH 3.8, 3.7 VÀ GEMINI 4 HYDROGEN (Phiên bản 12.0.4)
* **Loại trừ Structured JSON Schema Streaming cho các model flash 3.8, 3.7 và gemini 4 hydrogen**:
  - Tự động chuyển đổi các model gemini-4-hydrogen, gemini-3.8-flash, gemini-3.7-flash sang chế độ streaming text chuẩn (kèm thẻ XML) thay vì ép buộc Structured Outputs (responseMimeType: application/json), khắc phục triệt để lỗi Incomplete JSON segment at the end từ Google GenAI SDK.

### 🌟 CẬP NHẬT MỚI: TỰ ĐỘNG THAY THẾ TỪ KHÓA NỘI DUNG THÔ GỬI AI KỂ CHUYỆN (Phiên bản 9.80.0)
* **Chuẩn hóa hệ thống từ khóa truyền tin**:
  - Tự động lọc sạch và chuyển đổi các từ "tu tiên", "quản trò", "game" trong prompt thô và chỉ dẫn hệ thống gửi cho AI kể chuyện chính.
  - Thay thế tương ứng bằng "mô phỏng", "giả lập", "thế giới mô phỏng" một cách chính xác, bảo toàn nguyên vẹn định dạng viết hoa của từ gốc.
  - Đảm bảo tính nhất quán của bối cảnh thế giới mô phỏng giả lập.

### 🌟 CẬP NHẬT MỚI: TÍCH HỢP TÍNH NĂNG SỬ DỤNG VẬT PHẨM & KỸ NĂNG XỬ LÝ CHỈ SỐ QUA AI (Phiên bản 9.79.0)
* **Xử lý cơ học biến động chỉ số & trạng thái qua AI**:
  - Tích hợp nút \`⚡ Dùng Vật Phẩm & Kỹ Năng\` trực tiếp vào bảng chỉ số nhân vật.
  - Cho phép chọn checkbox đồng thời nhiều vật phẩm (Đan dược, Binh khí, Bí kíp, Độc dược...) và kỹ năng.
  - Bộ máy AI xử lý tính toán tác động trực tiếp lên Sinh Lực, Linh Lực, Sức Tấn Công, Thọ Nguyên, và học Linh kỹ/Thần thông mới.
  - Kết quả biến động chỉ số được thông báo trực tiếp vào bảng tin hệ thống (System Messages) mà không sinh thêm lượt kể truyện mới.
  - Giới hạn khống chế: Mỗi lượt chơi chỉ được phép thực hiện 1 lần sử dụng duy nhất (khoá nút sau khi dùng cho đến khi qua lượt tiếp theo).

### 🌟 CẬP NHẬT MỚI: TINH GỌN GIAO DIỆN MODAL NHÂN VẬT (Phiên bản 9.78.0)
* **Tối ưu hóa vị trí nút phân tích diện mạo**:
  - Loại bỏ nút [🔍 Phân Tích Diện Mạo Từ Ảnh] trùng lặp ở chân modal (bên dưới nút tải ảnh).
  - Giữ lại duy nhất 1 nút phân tích diện mạo trực quan ngay dưới ảnh đại diện ở phần đầu hồ sơ nhân vật.

### 🌟 CẬP NHẬT MỚI: BỔ SUNG BÓC TÁCH TÌNH TRẠNG DA & BIỂU CẢM KHUÔN MẶT VÀO DIỆN MẠO ẢNH (Phiên bản 9.77.0)
* **Phân tích toàn diện tình trạng da và vi biểu cảm khuôn mặt**:
  - Bổ sung yêu cầu bóc tách chi tiết biểu cảm khuôn mặt (nụ cười mỉm, ánh mắt hoảng sợ/sắc lẹm/mệt mỏi, cơ mặt đang há hốc vì đau đớn, nhíu mày, cau có, hay nét mặt thanh thản thư thái...).
  - Tự động nhận diện tình trạng thực tế của làn da (màu da, độ mịn màng, hoặc các vết tích hiển thị như mồ hôi chảy ròng/lấm tấm, vết cháy, vết bỏng, vết sẹo, vết bẩn, vệt máu, độ nhợt nhạt hoặc ửng hồng...).
  - Tiếp tục tuân thủ luật cấm miêu tả tư thế động của tay chân (ngồi xổm, đứng, giơ tay...) để tránh xung đột ngữ cảnh trong cốt truyện.

### 🌟 CẬP NHẬT MỚI: TÁCH BIỆT DIỆN MẠO BỀN VỮNG KHỎI TIỂU SỬ & CHUẨN HOÁ PROMPT THỊ GIÁC (Phiên bản 9.76.0)
* **Bảo toàn 100% Tiểu Sử & Lai Lịch nhân vật**:
  - Tách bạch hoàn toàn hai mục: "Tiểu Sử & Lai Lịch" (\`description\`) được giữ nguyên gốc vĩnh viễn, không bị ghi đè hay mất dữ liệu khi phân tích ảnh đại diện.
  - Diện mạo bóc tách từ ảnh được lưu trữ riêng biệt tại mục "Diện Mạo Mô Tả (Từ Ảnh Đại Diện)" (\`avatarAppearance\`), cho phép cập nhật hoặc thay thế linh hoạt bất cứ lúc nào khi đổi ảnh mới.
* **Chuẩn hoá Prompt thị giác AI (loại bỏ tư thế tạo dáng)**:
  - Cắt bỏ hoàn toàn việc miêu tả tư thế tạo dáng tức thời (như dáng ngồi, đứng, giơ tay, chống tay trong ảnh).
  - Tập trung tuyệt đối vào các đặc trưng nhận dạng tĩnh và bền vững: y phục, chất liệu, màu sắc, kiểu tóc, đường nét khuôn mặt và khí chất tổng thể.
* **Đồng bộ diện mạo bền vững vào nội dung thô gửi cho AI**:
  - Thẻ \`<bề_ngoài>\` trong prompt gửi AI tự động ưu tiên nạp mô tả từ ảnh đại diện cho tất cả các lượt kể chuyện tiếp theo.
  - Khắc phục triệt để cơ chế tự hủy sau 5 lượt đối với diện mạo từ ảnh đại diện, đảm bảo AI luôn ghi nhớ diện mạo xuyên suốt hành trình.

### 🌟 CẬP NHẬT MỚI: PHÂN TÍCH DIỆN MẠO TỪ ẢNH & HIỂN THỊ KÉP AVATAR TRONG HỘI THOẠI (Phiên bản 9.75.0)
* **Phân tích diện mạo từ ảnh đại diện bằng AI**:
  - Bổ sung nút [🔍 Phân Tích Diện Mạo Từ Ảnh] trong giao diện chi tiết nhân vật và khu vực quản lý avatar khi đã tải ảnh đại diện lên.
  - Tự động nhận diện trang phục, màu tóc, kiểu tóc và đường nét ngoại hình để cập nhật trực tiếp vào hồ sơ nhân vật.
* **Hiển thị kép Avatar trong khung hội thoại**:
  - Khi nhân vật có ảnh đại diện tải lên, hộp thoại sẽ hiển thị song song cả ảnh đại diện gốc và avatar biểu cảm cảm xúc (DynamicAvatar).
  - Giúp vừa ngắm nhìn ngoại hình thực tế của nhân vật vừa theo dõi được biến chuyển cảm xúc linh động qua từng lời nói.

### 🌟 CẬP NHẬT MỚI: TỰ ĐỘNG ROLL TRANG BỊ VÀ ĐỊNH GIÁ CƠ HỌC THEO ĐỘ HIẾM, SỐ DÒNG, ĐỘ LỚN CHỈ SỐ (Phiên bản 9.69.0)
* **Nâng cấp hệ thống kinh tế và cửa hàng cửa hiệu**:
  - Tự động roll trang bị ngẫu nhiên có độ hiếm, số dòng thuộc tính và chỉ số cơ học chuẩn khi cửa hàng được tạo lần đầu.
  - Áp dụng công thức định giá cơ học dựa trên cảnh giới, phẩm cấp, số dòng và độ lớn các chỉ số (phòng tránh triệt để lỗi giá 0 hay lỗi NaN).
  - Định giá đồng bộ khi mua và bán lại trang bị tại sạp hàng và cửa hàng chuyên biệt.

### 🌟 CẬP NHẬT MỚI: CHUẨN HOÁ CHỈ SỐ LÔI KIẾP HOÁ THÂN THEO CẢNH GIỚI (Phiên bản 9.68.0)
* **Đồng bộ công thức tính chỉ số Lôi Kiếp Hoá Thân**:
  - Loại bỏ công thức gán cứng thuộc tính Lôi Kiếp Hóa Thân (như nhân 130% Sinh Lực hay 200% Linh Lực của MC).
  - Thay thế bằng việc gán cảnh giới của Hóa Thân trùng với cảnh giới hiện tại của người chơi (\`pStats.realm\`).
  - Sử dụng chung hàm chuẩn hóa thuộc tính của hệ thống (\`updateEntityStatsFromRealm\`) để tự động khởi tạo chỉ số đồng bộ, chuẩn xác và công bằng như các NPC cùng cảnh giới khác.

### 🌟 CẬP NHẬT MỚI: ĐIỀU CHỈNH HỆ SỐ NHÂN KỸ NĂNG CLASSIC (Phiên bản 9.67.0)
* **Cân bằng lại sức mạnh kỹ năng Tiên hiệp**:
  - Giảm hệ số nhân sát thương/hồi phục của tất cả các kỹ năng xuống còn **1/10 (một phần mười)** so với trước đây để tránh hiện tượng sát thương quá đột biến trong giao diện chiến đấu classic.
  - Tuyệt chiêu cực đại (*Cửu thiên lôi đình*, *Lôi Long Giáng Thế*...): Giảm từ '3.5' xuống còn **'0.35'**.
  - Đao pháp / Linh kỹ chiến đấu: Giảm từ '2.2' xuống còn **'0.22'**.
  - Hỏa cầu thuật / Pháp thuật cơ bản: Giảm từ '1.4' xuống còn **'0.14'**.
  - Trị liệu / Hồi xuân thuật: Giảm từ '2.0' xuống còn **'0.20'**.
  - Các kỹ năng / Thần thông không xác định khác: Giảm hệ số mặc định từ '1.6' xuống còn **'0.16'**.

### 🌟 CẬP NHẬT MỚI: THIẾT KẾ CỰ BÚA KHỔNG LỒ & HÌNH QUẠT TĨNH (Phiên bản 9.66.0)
* **Thiết kế Thần búa cơ khí chân thực**:
  - **Cự búa kim loại ánh bạc**: Vẽ trực tiếp bằng Canvas mô phỏng chuẩn xác từ bản phác thảo của người dùng: cán búa làm bằng gỗ sẫm bền bỉ, đầu búa khối bạc sáng lấp lánh và có dải thép sẫm màu chạy dọc tạo điểm nhấn cơ khí mạnh mẽ.
  - **Hào quang phát sáng trắng**: Bao quanh đầu búa là một dải hào quang rực rỡ lôi cuốn ('White Glow Overlay').
* **Cải tiến vùng chỉ báo hình quạt**:
  - **Hình quạt tĩnh cực kỳ chuẩn xác**: Sửa lỗi vùng hình quạt xoay chuyển theo thân búa; giờ đây hình quạt màu vàng cam đại diện cho vùng tác động 120 độ sẽ cố định chuẩn xác trước mặt người thi triển (không di chuyển xoay tròn), mang lại sự trực quan, chuẩn chỉ tuyệt đối.
  - **Vết nứt đất chấn động**: Khi búa nện xuống đất, một vết nứt rực rỡ cùng hào quang chấn động đất đá được mô phỏng sinh động ngay tại điểm va chạm.

### 🌟 CẬP NHẬT MỚI: TÁI THIẾT KẾ THẦN THÔNG PHÁ GIÁP KÍCH (Phiên bản 9.65.0)
* **Chuyển đổi Phá Giáp Kích thành Thần thông AoE**:
  - **Sát thương AoE hình quạt rộng**: Khi thi triển kỹ năng, người sử dụng sẽ triệu hồi hư ảnh Cự Búa gõ liên tiếp 3 lần (mỗi lần cách nhau 1 giây) về phía trước gây sát thương AoE cực lớn (120% sát thương) hình quạt bán kính 250px góc mở rộng 120 độ.
  - **Khống chế cứng**: Kẻ địch bị trúng chiêu sẽ bị choáng (stun) trong 2 giây cùng hiệu ứng nứt đất chấn động.
  - **Hư ảnh búa thần mờ**: Bổ sung hiệu ứng hoạt ảnh vung búa và khu vực ảnh hưởng hình quạt lấp lánh màu vàng cam trên canvas chiến đấu real-time.

### 🌟 CẬP NHẬT MỚI: ĐIỀU CHỈNH QUY MÔ THẦN THÔNG & LÔI LONG (Phiên bản 9.64.0)
* **Tinh chỉnh kích thước Thần thông**:
  - **Băng Hoàng Phá**: Điều chỉnh lại kích thước luồng sóng tuyết phóng ra \`❄️\` về tầm trung vừa phải (\`baseSize: 96\`) để cân bằng trải nghiệm thị giác.
  - **Lôi Long Giáng Thế**: Giảm phạm vi xoay quanh caster của các lốc xoáy \`🌪️\` xuống còn \`100px\` (thay vì \`200px\`) để hiệu ứng dồn tụ lôi điện gần gũi, bám sát và bảo hộ MC chặt chẽ hơn.

### 🌟 CẬP NHẬT MỚI: NÂNG CẤP HIỆU ỨNG THẦN THÔNG CHIẾN ĐẤU (Phiên bản 9.63.0)
* **Tăng kích cỡ Thần thông cực đại**: Tăng quy mô hiệu ứng hình ảnh của các tuyệt kỹ trong Real-time Combat:
  - **Băng Hoàng Phá**: Tăng kích thước luồng sóng tuyết bay ra \`❄️\` lên gấp 3 lần (\`baseSize: 180\`) để thể hiện uy thế ngưng kết vạn vật.
  - **Liệt Hỏa Phần Thiên**: Tăng kích thước biểu tượng ngọn lửa thiêng giáng thế \`🔥\` lên gấp 3 lần (\`baseSize: 96\`) mang đến cảm giác rực cháy và tàn phá mãnh liệt từ không trung.

### 🌟 CẬP NHẬT MỚI: CHUẨN HOÁ HẬU CHIẾN & CHẶN TỰ KÍCH HOẠT COMBAT KHI BẮT TÙ BINH (Phiên bản 9.81.0)
* **Bảo hộ phân cảnh Hậu Quả Chiến Đấu**:
  - Chuẩn hoá khối dữ liệu kết quả trận đấu qua thẻ XML \`<ket_qua_chien_dau>\` với chỉ thị nghiêm cấm kích hoạt chiến đấu mới hoặc tiếp tục tấn công.
  - Vô hiệu hoá hoàn toàn \`COMBAT_CLIFFHANGER_PROTOCOL\` và chặn sinh tag \`[BEGIN_COMBAT]\` trong lượt kể hậu quả sau khi thoát \`CombatScreenold\`.
  - Tự động tắt cơ chế cơ học trừ HP của người chơi và tất cả NPC/Tù binh trong lượt kể hậu chiến, ngăn chặn NPC đã bị bắt làm tù binh nhảy ra giao tranh lại với MC.

### 🌟 CẬP NHẬT MỚI: LOẠI BỎ LIÊN KẾT CLOUDINARY - HỖ TRỢ TẢI ẢNH ĐẠI DIỆN TRỰC TIẾP TỪ THIẾT BỊ (Phiên bản 9.74.0)
* **Xóa bỏ hoàn toàn liên kết lưu trữ đám mây ngoài Cloudinary**:
  - Khắc phục triệt để lỗi kết nối HTTP 500/404 liên quan đến chữ ký lưu trữ khi tải tệp ảnh từ thiết bị cá nhân của bạn lên ứng dụng.
  - Tự động chuyển đổi và lưu trữ trực tiếp ảnh đại diện dưới dạng chuỗi dữ liệu gốc (Base64 Data URL) vào hệ thống dữ liệu cục bộ **IndexedDB** an toàn.
  - Cho phép tải lên và thay đổi ảnh đại diện người chơi, NPC, Yêu Thú tức thì (0 ms trễ) mà không cần cấu hình API Key hay lo ngại lỗi đường truyền mạng.

### 🌟 CẬP NHẬT MỚI: TỰ ĐỘNG XÓA BỎ PENDING COMBAT CƠ HỌC KHI THOÁT CHIẾN ĐẤU & ĐỘ KIẾP (Phiên bản 9.73.0)
* **Cơ chế dọn dẹp cơ học khi thoát màn hình chiến đấu**:
  - Tự động gỡ bỏ hoàn toàn \`pendingCombat\` và đặt \`isInCombat = false\` ngay khi unmount / thoát ra khỏi \`CombatScreenold\` hoặc \`RealTimeCombatScreen\`.
  - Sửa dứt điểm lỗi lưu trữ \`pendingCombat\` sau khi hoàn thành độ kiếp lôi kiếp thành công, ngăn chặn bảng thông báo "MỘT CUỘC CHIẾN SẮP BẮT ĐẦU!" tự ý hiển thị lại ngoài sảnh chính hoặc động phủ.
  - Thêm cơ chế bảo hộ reset \`pendingCombat\` tự động tại Động Phủ (\`CultivationScreen\`) và khi Xuất Quan.

### 🌟 CẬP NHẬT MỚI: THÊM NÚT ĐỘI HÌNH VÀO GIAO DIỆN CHỜ CHIẾN ĐẤU PENDING COMBAT (Phiên bản 9.72.0)
* **Nút Đội Hình nhanh**: Bổ sung nút \`🛡️ Đội Hình\` tại góc trên bên trái khung thông báo chiến đấu sắp diễn ra (Pending Combat), cho phép người chơi trực tiếp mở bảng chọn đồng minh, nô lệ, tù binh xuất trận trước khi bắt đầu trận chiến.
* **Đồng bộ danh sách Phe Ta tức thì**: Tự động cập nhật danh sách "Phe Ta (Đồng Minh)" ngay sau khi người chơi chọn và xác nhận đội hình.

### 🌟 CẬP NHẬT MỚI: SỬA LỖI HỆ SỐ KỸ NĂNG & CỘNG DỒN SÁT THƯƠNG CLASSIC COMBAT (Phiên bản 9.71.0)
* **Sửa lỗi công thức hệ số chiêu thức (\`skillScale\`)**: Khắc phục triệt để lỗi gán đè khiến kỹ năng yếu hơn đánh thường. Giờ đây hệ số chiêu thức được tính theo tỷ lệ cộng dồn vào 100% sức tấn công cơ bản (\`skillScale = 1.0 + skillBonus\`):
  - Tuyệt kỹ cực đại (*Cửu thiên lôi đình*, *Lôi Long Giáng Thế*...): **135% ATK** (\`1.0 + 0.35\`).
  - Đao pháp / Linh kỹ / Kiếm khí / Kích pháp: **122% ATK** (\`1.0 + 0.22\`).
  - Pháp thuật cơ bản (*Hỏa cầu*, *Băng phong châm*...): **114% ATK** (\`1.0 + 0.14\`).
  - Trị liệu / Hồi xuân thuật: **120% ATK** (\`1.0 + 0.20\`).
  - Các kỹ năng / Thần thông mặc định khác: **116% ATK** (\`1.0 + 0.16\`).
* **Khắc phục lỗi tụt 1 sát thương**: Loại bỏ hiện tượng sát thương bị tụt xuống 1 do trừ phòng thủ khi thi triển kỹ năng tốn MP.

### 🌟 CẬP NHẬT MỚI: TÍNH NĂNG KIỂM TRA MODEL (PING TEST SONG SONG) (Phiên bản 10.4.0)
* **Cơ chế Kiểm Tra Model Trực Tiếp & Song Song (Model Ping Tester)**: Tích hợp công cụ test khả năng hoạt động và đo độ trễ phản hồi theo thời gian thực cho từng model hoặc toàn bộ danh sách model.
* **Hỗ trợ Test Đơn, Chọn Nhiều hoặc Test Tất Cả**: Người dùng có thể nhấn nút **Test** riêng cho từng model, chọn một danh sách model tùy ý để test, hoặc nhấn **Kiểm Tra Tất Cả (Parallel)** để thực thi đồng thời với tốc độ cao nhất.
* **Gửi Prompt Siêu Ngắn 'ping'**: Tối ưu dung lượng token và tốc độ phản hồi bằng prompt tối giản, tự động bấm giờ đo latency (ms/s) và hiển thị chi tiết mã lỗi (429, 404, Quota Exceeded...) nếu có.
* **Tuân thủ Chuẩn Log API (Luuyngudan5)**: Toàn bộ quá trình ping test được khai báo đầy đủ nguồn API Key, Model, Latency, Mục đích sử dụng và Caller file qua \`apiRunningService\`.

### 🌟 CẬP NHẬT MỚI: TỐI GIẢN TOÀN BỘ SUY NGHĨ & TIÊM NỘI DUNG Ở CHẾ ĐỘ ĐỐI THOẠI 500 TỪ (Phiên bản 9.70.0)
* **Triệt tiêu thẻ \`<thinking>\` & Suy nghĩ phức tạp**: Bỏ hoàn toàn hướng dẫn tạo thẻ \`<thinking>\` ở chế độ 500 từ. AI sẽ tối giản hóa suy nghĩ và đi trực tiếp vào lời kể/đối thoại trong thẻ \`<content>\`.
* **Loại bỏ quy trình tiêm rườm rà**: Loại bỏ triệt để việc tiêm Quy trình Thẩm định (Tribunal Audit 8 bước), Audit Checkpoint Protocol, Game Theory Matrix, Few-Shot thinking samples và các Preset phụ tùng khi chọn độ dài 500 từ.
* **Chuẩn hóa độ dài 500 - 600 từ & Tương tác MC-NPC**: Đảm bảo AI tập trung 100% dung lượng vào lời thoại trực tiếp, cử chỉ, biểu cảm và phản ứng qua lại giữa MC và NPC.

### 🌟 CẬP NHẬT MỚI: CHUẨN HOÁ THẨM ĐỊNH CHIẾN ĐẤU & NGOẠI LỆ GIAO TRANH NPC (Phiên bản 9.62.0)
* **Khắc phục Lỗi Kích hoạt Combat khi MC không tham chiến**: Cập nhật chỉ thị thẩm định bước \`[2] COMBAT & LOCATION CHECK\` trong khối \`<thinking>\` của các thanh tra (Athena & Hermes) và giao thức \`COMBAT_CLIFFHANGER_PROTOCOL\`:
  - Chỉ kích hoạt \`COMBAT_CLIFFHANGER_PROTOCOL\` và xuất tag \`[BEGIN_COMBAT]\` khi **Nhân Vật Chính (MC) trực tiếp tham gia chiến đấu** (MC chủ động tấn công hoặc MC là mục tiêu trực tiếp bị tấn công).
  - Đối với các phân cảnh giao tranh giữa các NPC với nhau mà MC không tham gia (hoặc MC đứng xem từ xa, chuyển cảnh sang góc nhìn của NPC khác), các thanh tra sẽ thẩm định là "KHÔNG", nghiêm cấm kích hoạt Cliffhanger hay tag chiến đấu, để AI tự do miêu tả toàn bộ diễn biến và kết quả trận chiến của NPC bằng lời kể thông thường.

### 🌟 CẬP NHẬT MỚI: CHUYỂN NGỮ CẢNH TRUYỆN MỚI NHẤT LÊN ĐẦU PROMPT (Phiên bản 9.61.0)
* **Ưu tiên Ngữ cảnh Truyện Lượt Trước**: Thay thế việc đưa khối \`richsummary\` tóm tắt bằng việc đưa trực tiếp khối Turn Log mới nhất (ví dụ \`<Turn _Log_#10+current_context_17>\`) ngay sau phần \`user_input\`. Việc này giúp AI lập tức bắt nhịp được văn phong, vị trí và hành vi tức thời của MC và thế giới từ lượt vừa diễn ra trước đó.
* **Tối ưu hóa Phân rã Nội dung AI thô**: Tích hợp bộ xử lý \`parseAndSubdivideAiTextLocal\` giúp lọc sạch các thông tin suy nghĩ ngầm (\`<thinking>\`), dữ liệu cập nhật (\`<update_data>\`) hay các lựa chọn (\`<choice>\`), chỉ giữ lại văn phong truyện thuần khiết trong khối \`<Story_Narration>\`.

### 🌟 CẬP NHẬT MỚI: CHUẨN HOÁ TRÍCH XUẤT TÓM TẮT LƯỢT TRƯỚC (Phiên bản 9.60.0)
* **Khắc phục Lệch Chỉ số Lượt Tóm tắt Flash Agent**: Sửa đổi bộ lọc \`previousFlashLog\` trong \`services/geminiService.ts\` từ \`<\` thành \`<=\` đối với \`playerStats.turn\`, đảm bảo khi bước sang lượt N mới, prompt gửi AI luôn nhận đúng thẻ \`<richsummary_N-1>\` chứa nội dung tóm tắt của lượt vừa hoàn thành thay vì bị lùi trễ 2 lượt.
* **Đồng bộ Định danh Thẻ XML Tóm tắt**: Chuẩn hóa biến \`previousTurn\` khi định dạng khối User Input để luôn gắn đúng số thứ tự của lượt tóm tắt gần nhất.

### 🌟 CẬP NHẬT MỚI: CƠ CHẾ NỔ BOM VĨ THÚ & KHỔNG LỒ HÓA LÔI LONG (Phiên bản 9.59.0)
* **Bom Vĩ Thú Bất Động & Hất Tung**: Khi đạn Bom Vĩ Thú phát nổ, tất cả các thực thể nằm trong khu vực ảnh hưởng sẽ bị hất văng thẳng lên không trung, cơ thể bị xoay nằm ngang rũ rượi, rồi rơi tự do ra xa 200px quanh tâm vụ nổ. Khi tiếp đất, các thực thể này vẫn phải nằm ngang tê liệt hoàn toàn trong 1 giây, sau đó mới đứng thẳng dậy phục hồi hoạt động bình thường.
* **Lôi Long Giáng Thế Siêu Đại**: Tăng kích thước lốc xoáy cuồng phong sấm sét \`🌪️\` lên gấp 3 lần (\`baseSize: 78\`), mang đến hiệu ứng thị giác hoành tráng áp đảo quần hùng trên chiến trường.

### 🌟 CẬP NHẬT MỚI: CHUẨN HÓA BIỂU TƯỢNG NGUYÊN TỐ THẦN THÔNG (Phiên bản 9.58.3)
* **Lôi Long Giáng Thế**: Chuyển đổi biểu tượng sóng nước \`🌊\` cũ thành biểu tượng Cuồng Phong/Lốc xoáy \`🌪️\` sấm sét chân thực.
* **Băng Hoàng Phá**: Chuyển đổi biểu tượng \`🌊\` thành biểu tượng Hoa Tuyết \`❄️\` băng giá sắc lạnh để thể hiện tính chất đông cứng tuyệt đối.
* **Liệt Hỏa Phần Thiên**: Chuyển đổi biểu tượng \`🌊\` thành biểu tượng Ngọn Lửa Thần \`🔥\` rực cháy thiêu rụi trời đất khi giáng thế từ thiên không.

### 🌟 CẬP NHẬT MỚI: TỰ DO DI CHUYỂN CAMERA KHI NGƯỜI CHƠI GỤC NGÃ (Phiên bản 9.58.2)
* **Kéo để di chuyển camera (Drag-to-Pan)**: Khi người chơi gục ngã (máu về 0) hoặc không có nhân vật, bạn có thể dễ dàng dùng chuột kéo rê trên màn hình hoặc dùng tay vuốt trên thiết bị di động để di chuyển tự do góc nhìn camera khắp chiến trường.
* **Hỗ trợ phím di chuyển & Joystick**: Vẫn hỗ trợ di chuyển góc nhìn camera bằng các phím WASD hoặc nút Joystick ảo cực kỳ mượt mà.
* **Giới hạn biên bản đồ (Camera Boundary Clamping)**: Góc nhìn camera sẽ được tự động giới hạn chính xác trong phạm vi của bản đồ, ngăn góc nhìn bị lệch ra ngoài vùng hư vô tối tăm.

### 🌟 CẬP NHẬT MỚI: KHẮC PHỤC LỖI KẸT HOẠT HỌA PHÁT CHIÊU THẦN THÔNG (Phiên bản 9.58.1)
* **Sửa lỗi dọn dẹp đạn cũ**: Khắc phục triệt để lỗi logic thoát ngang vòng lặp khiến đạn của các thần thông (Lôi Long Giáng Thế, Liệt Hỏa Phần Thiên) không thể tự động tiêu biến khi hết thời gian, gây nghẽn màn hình hoạt họa. Giờ đây, mọi đạn và hiệu ứng sóng biển 🌊 sẽ biến mất chính xác sau khi hoàn thành chu kỳ thi triển hoặc phát nổ.

### 🌟 CẬP NHẬT MỚI: TÙY BIẾN ANIMATION & CƠ CHẾ CHIẾN ĐẤU THẦN THÔNG (Phiên bản 9.58.0)
* **Lôi Long Giáng Thế**: Các đợt sóng 🌊 xuất hiện thành vòng tròn rộng 700px xung quanh người thi triển, chuyển động xoáy vào trong bất quy tắc về phía tâm, dừng lại ở khoảng cách 200px rồi xoay quanh caster liên tục trong 2 giây trước khi tiêu biến.
* **Băng Hoàng Phá**: Giữ nguyên hiệu ứng 12 hướng toả tròn nhưng các luồng sóng 🌊 bay xuyên qua toàn bộ chướng ngại vật và thực thể (không bị triệt tiêu), đồng thời áp dụng hiệu ứng giảm 30% tốc độ di chuyển trong 3 giây cho mọi kẻ địch bị xuyên qua.
* **Liệt Hỏa Phần Thiên**: Sóng 🌊 xuất hiện ở vị trí 200px trên đầu kẻ địch rồi giáng thẳng xuống đất, gây sát thương bùng nổ diện rộng AoE bán kính 200px và gán hiệu ứng thiêu đốt DoT trong 5 giây (mỗi giây gây 1/10 lượng sát thương kỹ năng). Mỗi nhịp sát thương DoT sẽ hiển thị biểu tượng ngọn lửa 🔥 nhỏ dưới chân kẻ địch.
* **Chuẩn hóa Cooldown 15s**: Tăng thời gian hồi chiêu của cả 3 tuyệt kỹ (Lôi Long Giáng Thế, Băng Hoàng Phá, Liệt Hỏa Phần Thiên) lên 15 giây cho cả người chơi lẫn NPC.

### 🌟 CẬP NHẬT MỚI: SỬA LỖI XỬ LÝ ÂM THANH & CHỐNG BLOCK TRÌNH DUYỆT (Phiên bản 9.56.0)
* **Xử lý ngoại lệ phát Audio (Audio Play Handling)**: Đã thêm bộ kiểm tra sự kiện onerror và xử lý promise catch an toàn cho toàn bộ dịch vụ âm thanh (AudioService & BackgroundMusicPlayer).
* **Khắc phục lỗi "Failed to load because no supported source was found"**: Ngăn chặn triệt me lỗi báo chặn trình duyệt hoặc định dạng đường dẫn nhạc không hỗ trợ khi thiếu tập tin âm thanh địa phương, giúp ứng dụng vận hành mượt mà không làm đứt đoạn trải nghiệm.

### 🌟 CẬP NHẬT MỚI: TỰ ĐỘNG ƯU TIÊN NPC MÁU CAO NHẤT THAM CHIẾN TRƯỚC (Phiên bản 9.55.0)
* **Thứ tự xuất trận tự động theo HP**: Trong cả 2 giao diện chiến đấu (Classic - CombatScreenold và RealTime - RealTimeCombatScreen), hệ thống tự động sắp xếp danh sách các NPC đối thủ và đồng minh theo mức máu (sinhLuc / maxSinhLuc) từ cao xuống thấp.
* **Đưa NPC mạnh nhất/máu lớn nhất lên trước**: NPC có lượng máu lớn nhất sẽ được xếp lên trên cùng và ưu tiên bước vào trận chiến trước, sau đó mới tới các NPC có lượng máu ít hơn.
* **Đồng bộ hàng chờ dự bị**: Cơ chế dự bị khi có đơn vị gục ngã cũng tự động triệu hồi các NPC dự bị có HP lớn nhất tiếp theo tham chiến.

### 🌟 CẬP NHẬT MỚI: CHUẨN HÓA ĐỊNH GIÁ KINH TẾ THEO CẢNH GIỚI (Phiên bản 9.54.0)
* **Định giá thuần Cảnh giới (Major & Minor Realm Valuation)**: Tinh giản toàn bộ cơ chế định giá của Vật Phẩm, Nô Lệ và Tù Binh. Loại bỏ hoàn toàn các hệ số phức tạp ngoài lề (phẩm giai, tu chất, thể chất, linh căn, ý chí, kháng cự). Giá trị được tính toán trực tiếp và nhất quán dựa trên Đại cảnh giới (majorIndex) và Tiểu cảnh giới (minorIndex).
* **Triệt tiêu dứt điểm lỗi "NaN Nguyên thạch"**: Khắc phục lỗi bất tương thích tham số và thiếu hụt chỉ số ý chí/kháng cự khi bán tù binh và nô lệ tại Chợ Nô Lệ, Phường Thị và Thương Thành. Giao diện buôn bán luôn hiển thị mức giá chính xác, minh bạch.
* **Bảo vệ tính toàn vẹn kinh tế**: Đồng bộ giá trị giao dịch ở mọi phương thức bán hàng cho NPC, ngăn ngừa triệt để các phép toán số học không xác định trong iframe.

### 🌟 CẬP NHẬT MỚI: TỰ ĐỘNG KHỞI TẠO & ĐỒNG BỘ ĐẦY ĐỦ SẠP HÀNG KHU VỰC KINH TẾ (Phiên bản 9.53.0)
* **Khai Thị & Tự Động Seed sạp hàng (Vendor Auto-Seeding)**: Khi mở bất kỳ khu vực kinh tế nào (Phường Thị, Thương Thành, Chợ Nô Lệ) mà địa điểm đó bị thiếu thương nhân hoặc hàng hóa, hệ thống sẽ tự động kích hoạt bộ tạo sạp hàng mẫu tương ứng với cảnh giới hiện hành của nhân vật. Giải quyết triệt để lỗi "Không có sạp hàng nào ở đây".
* **Kỷ luật sinh tag của AI**: Áp dụng kỷ luật thép bằng quy tắc bọc thẻ XML trong prompt tạo địa điểm kinh tế, ép AI phải sinh đầy đủ tag NPC và SHOP_ITEM đồng bộ tuyệt đối với khu vực kinh tế được tạo.
* **Cải thiện trải nghiệm mua bán**: Đảm bảo sạp hàng luôn đầy đủ đan dược, vũ khí, linh kĩ, hoặc nô lệ/tù nhân có sẵn để tương tác ngay lập tức mà không gặp giao diện trống rỗng vô nghĩa.

### 🌟 CẬP NHẬT MỚI: CHUẨN HÓA TRÍCH XUẤT TAG CHO CÁC TÁC VỤ VỆ TINH & CHẾ TẠO AI (Phiên bản 9.52.0)
* **Khắc phục lỗi mất Tag ở các tính năng phụ**: Giải quyết triệt để lỗi mất dữ liệu tag hệ thống trong các tác vụ: Chế tạo trang bị/đan dược AI, Đấu giá hội (vật phẩm & nô lệ), Tạo chi tiết địa điểm/kinh tế khi du hành, Làm mới hàng hóa thương nhân (Restock) và Hỗ trợ AI tạo thế giới/nhân vật ban đầu.
* **Bộ tách Tag Chuyên biệt (Satellite Tag Extractor)**: Tách riêng luồng xử lý tag vệ tinh qua dịch vụ độc lập, tự động trích xuất trực tiếp từ phản hồi AI mà không phụ thuộc vào bộ phân tích truyện chính, đảm bảo vật phẩm chế tạo và sự kiện luôn được ghi nhận chính xác 100%.
* **Bảo vệ tài nguyên người chơi**: Khắc phục triệt để tình trạng người chơi bị tiêu hao nguyên liệu khi luyện đan/rèn khí mà không nhận được trang bị/đan dược tương ứng vào Túi Trữ Vật.

### 🌟 CẬP NHẬT MỚI: QUY HOẠCH BẢN ĐỒ & TỰ ĐỘNG HỢP NHẤT KHU VỰC KINH TẾ (Phiên bản 9.51.0)
* **Quy hoạch và Ẩn thanh công cụ phụ**: Thanh công cụ kinh tế ("Khu vực kinh tế") nay sẽ tự động ẩn hoàn toàn ở các địa điểm phụ nếu chưa có dữ liệu cơ sở kinh doanh, chỉ giữ lại ở các địa điểm chính gốc để tối ưu không gian hiển thị.
* **Tự động hợp nhất (Economic Zone Merger)**: Khi người chơi kích hoạt tính năng "Vẽ lại bản đồ" hoặc khi có bất kỳ sự thay đổi quy hoạch địa giới nào, hệ thống sẽ tự động gộp tất cả các khu vực kinh tế, chợ, cửa hàng từ địa điểm phụ vào trung tâm kinh tế của địa điểm chính tương ứng.
* **Tinh giản giao diện**: Loại bỏ hoàn toàn nút "📊 Dữ liệu E&C" và các modal xem log thô không cần thiết để đem lại trải nghiệm mượt mà, trực quan nhất cho Thiên Đạo.

### 🌟 CẬP NHẬT MỚI: TỰ ĐỘNG XOAY TUA MODEL KHI PHẢN HỒI RỖNG (Phiên bản 9.50.2)
* **Khắc phục lỗi bỏ lỡ Fallback**: Sửa lỗi AI hoàn tất phản hồi nhưng nội dung rỗng (hoặc chỉ chứa prefill rác) mà không kích hoạt chuỗi dự phòng.
* **Bộ lọc và Chốt chặn Rỗng**: Hệ thống nay sẽ thực hiện loại bỏ thẻ prefill rác trước khi kiểm tra độ dài văn bản thực tế. Nếu dữ liệu sau khi làm sạch bị trống, lỗi sẽ lập tức được ném ra để tự động xoay tua model xuống cấp thấp hơn.
* **Đồng bộ luồng Stream & Story**: Áp dụng triệt để cơ chế lọc sạch và kích hoạt fallback tự động cho cả luồng stream game chính, stream câu kể truyện, và luồng gọi đồng bộ non-stream.

### 🌟 CẬP NHẬT MỚI: CHỐT CHẶN CẢNH GIỚI - CẤM HẠ CẤP TU VI (Phiên bản 9.50.0)
* **Quy tắc Realm Validation**: AI kể chuyện chính và AI Thiên Đạo Sync (Fast Agent) được tiêm kỷ luật thép: Tuyệt đối không cho phép cập nhật cảnh giới MC/NPC thấp hơn hoặc ngang bằng cảnh giới hiện hành.
* **Tư duy Logic Hệ Thống**: Bổ sung bước kiểm tra thực tế trong thẻ thinking, ép AI so sánh dữ liệu tu vi trước khi xuất tag cập nhật. Đặc biệt trong chế độ "Siêu Mạt Pháp", việc hạ cấp tu vi bị cấm hoàn toàn dưới mọi hình thức.
* **Bảo vệ CSDL**: Thiết lập chốt chặn Gatekeeper tại khâu trích xuất tag, tự động hủy các yêu cầu hạ cấp tu vi nếu phát hiện ảo giác từ AI chính.

### 🌟 CẬP NHẬT MỚI: TỐI ƯU CÀI ĐẶT API & ĐIỀU CHỈNH THỜI GIAN CHỜ AI (Phiên bản 9.49.0)
* **Thanh Trượt Thời Gian Chờ (API Timeout)**: Bổ sung thanh trượt điều chỉnh thời gian chờ từ 10s đến 120s. Hệ thống sẽ tự động chuyển sang fallback chain nếu quá thời gian này mà không nhận được dữ liệu.
* **Cơ Chế Tạo Ảnh Avatar NPC Động**: Sửa đổi mục tạo ảnh đại diện NPC để tự động lấy danh sách các model khả dụng (như Imagen, Gemini Flash Image) trực tiếp từ API Google, giúp tối ưu hóa việc tạo ảnh kể cả khi dùng Proxy.
* **Dọn Dẹp Giao Diện**: Xoá bỏ khung "Danh sách dự phòng của các model" để tinh giản giao diện cài đặt, giúp tập trung vào các thiết lập quan trọng.

### 🌟 CẬP NHẬT MỚI: CHUẨN HÓA QUY TẮC PHÂN CẢNH GIAO HỢP & NSFW NÂNG CAO (Phiên bản 9.48.0)
* **Quy tắc ứng xử nhân vật nam**: Cấm tuyệt đối hành động xé rách y phục nữ nhân hoặc mắng chửi trong phân cảnh làm tình.
* **Bản ngã & Cá tính nữ nhân**: Giữ vững sự kiêu ngã, cấm các câu thoại thô tục mất tự trọng; nhân vật nữ chủ động tìm tư thế thoải mái và khiêu khích thay vì hoàn toàn thụ động hay gọi "chồng/anh yêu" bừa bãi.
* **Mô tả sinh lý & Tiếng thở**: Chuẩn hóa chi tiết mô tả tiếng thở dốc, rên rỉ và tương tác thể xác tinh tế trong giao hợp.

### 🌟 CẬP NHẬT MỚI: FIX LỖI TRỐNG DANH SÁCH ĐỐI THỦ & ĐỒNG MINH TẠM THỜI (Phiên bản 9.47.0)
* **Khắc phục triệt để lỗi trống danh sách**: Đã sửa lỗi không hiển thị các thực thể tạm thời (như Bầy quái, Phân thân, NPC mới phát sinh) trên giao diện chuẩn bị chiến đấu.
* **Cơ chế Phân giải Thực thể Chiến đấu (Combat Entity Resolver)**: Tích hợp bộ lọc tập trung giúp truy xuất chính xác thông tin từ mọi nguồn dữ liệu (NPC, Yêu thú, Đồng hành, Thực thể tạm thời).
* **Đồng bộ Lực chiến Tự động**: Đảm bảo các thực thể tạm thời được tính toán đầy đủ sức mạnh khi sử dụng tính năng "Tự động chiến đấu" hoặc "Bỏ chạy".

### 🌟 CẬP NHẬT MỚI: TỐI ƯU HOÁ PARSER VÀ FIX LỖI MẤT DANH SÁCH KẺ ĐỊCH (Phiên bản 9.46.0)
* **Khắc phục lỗi mất danh sách Kẻ Địch**: Đã sửa lỗi danh sách kẻ địch bị trống khi hệ thống cắt ngang nội dung do đạt giới hạn token.
* **Cơ chế quét XML thông minh (Graceful Parsing)**: Hệ thống XML parser nay đã có khả năng linh hoạt tự động quét và thu thập toàn bộ dữ liệu trả về kể cả khi các thẻ đóng XML (\`</tag>\`) bị khuyết thiếu, đảm bảo thông tin chiến đấu không bị thất thoát.
* **Trích xuất Combat Analysis**: Các Regex trích xuất danh sách đối thủ, tỷ lệ thắng trận, sát thương, trạng thái đã được thiết kế lại để bao dung mọi lỗi ngắt câu do API.

### 🌟 CẬP NHẬT MỚI: TỐI ƯU HOÁ NPC QUẦN CHÚNG VÀ CƠ CHẾ THỰC THỂ HOÁ (Phiên bản 9.45.0)
* **NPC Tạm Thời**: Các NPC tự sinh trong trận chiến (Mob/Quần chúng) giờ đây chỉ tồn tại tạm thời trong trạng thái chiến đấu.
* **Chống Phình Dữ Liệu**: Ngăn chặn việc tự động thêm hàng loạt NPC vô danh vào Knowledge Base, giúp giảm tải dung lượng file lưu và tăng tốc độ xử lý.
* **Cơ Chế Thực Thể Hoá**: Chỉ những NPC bị bắt giữ (Capture) hoặc được AI Quản Trò tương tác sâu (qua tag hệ thống) mới được chính thức ghi nhận vào danh sách Khám Phá.
* **Xử Lý Hậu Chiến**: Tự động dọn dẹp các thực thể tạm thời sau khi kết thúc trận đấu nếu không có tương tác đặc biệt.

### 🌟 CẬP NHẬT MỚI: CHUẨN HOÁ CẤU TRÚC LỜI NHẮC CHO AI VÀ TIÊM TOÀN CỤC (02/09/2026 - 19:40)
*   **Bọc Thẻ Lồng 2 Tầng <loinhacAI> Cho Từng Lời Nhắc:** Định dạng toàn bộ danh sách "Lời nhắc cho AI" (userPrompts) theo cấu trúc XML chuẩn: Thẻ cha \`<loinhacAI>\` bọc ngoài, mỗi lời nhắc con nằm trong thẻ \`<loinhacAI_#i>\`.
*   **Áp Dụng Cho Mọi Bối Cảnh & Chế Độ:** Tiêm trực tiếp khối lời nhắc vào bối cảnh kể chuyện (ContinuePrompt, ContinuePrisonPrompt...) bất kể đang bật hay tắt preset, bật hay tắt chế độ độc quyền phụ tùng (exclusiveMode).
*   **Tôn Trọng Tuyệt Đối Ý Định Người Dùng:** Đảm bảo AI luôn tiếp nhận trọn vẹn và ưu tiên các chỉ thị tùy chỉnh của người chơi trong mọi lượt kể và hành động.

### 🌟 CẬP NHẬT MỚI: CHUẨN HOÁ & BẢO TOÀN CẢNH GIỚI NPC THÔNG MINH (02/09/2026 - 18:30)
*   **Cơ Chế Chốt Chặn 3 Tầng (Smart Realm Gatekeeper):** Nâng cấp hệ thống kiểm tra cảnh giới NPC thành 3 lớp bảo vệ: Loại bỏ rác -> Tự động nắn chỉnh (Fuzzy Repair) -> Bảo toàn nội dung có ý nghĩa.
*   **Tự Động Nắn Chỉnh (Auto-Repair):** Hệ thống tự động nhận diện và sửa lỗi cú pháp nhẹ của AI (ví dụ: thiếu danh xưng chủng tộc) để khôi phục cảnh giới chuẩn nhất thay vì ép NPC về bậc thấp nhất.
*   **Bảo Toàn Cảnh Giới Có Ý Nghĩa:** Tuyệt đối không hạ cấp NPC nếu chuỗi cảnh giới chứa thông tin hợp lệ (độ dài > 2), chỉ ép về cảnh giới nền khi dữ liệu rỗng hoặc là chuỗi vô nghĩa ("???", "undefined",...).

### 🌟 CẬP NHẬT MỚI: CHỐNG HỒI SINH & CHỐNG QUÁN TÍNH NGỮ CẢNH CỰU MC ĐÃ CHẾT (02/09/2026 - 13:15)
*   **Đăng Ký & Lưu Trữ Danh Sách MC Đã Tử Vong (deceasedProtagonists):** Ghi nhận vĩnh viễn tên các nhân vật chính tiền nhiệm đã chết vào KnowledgeBase và WorldSettings khi xảy ra sự kiện Đoạt xá hoặc Luân hồi.
*   **Khóa Chặn Tạo Lại / Hồi Sinh Cựu MC Thành NPC:** Nâng cấp Identity Shield và Deceased MC Shield trong bộ xử lý tag NPC, tuyệt đối không tạo NPC mới trùng tên MC hiện tại hoặc MC tiền nhiệm đã chết.
*   **Triệt Tiêu Quán Tính Ngữ Cảnh Trong Prompt AI:** Bổ sung thẻ chỉ thị XML \`<luat_dinh_danh_mc_hien_tai_+chi_thi_mc>\` và quy tắc trích xuất tag chống ảo giác, ép AI chỉ tập trung 100% POV vào nhân vật chính mới và cấm miêu tả cựu MC đã chết còn sống.

### 🌟 CẬP NHẬT MỚI: CHUẨN HOÁ LUỒNG TỬ VONG / TỰ SÁT & LÀM SẠCH CHỈ SỐ CHỜ LUÂN HỒI - ĐOẠT XÁ (02/09/2026 - 08:10)
*   **Triệt Tiêu Hoàn Toàn Tự Động Gán MC Mới:** Xóa bỏ cơ chế tự động chuyển kiếp khi MC tử vong; chỉ khi người chơi chủ động bấm nút [☸️ LUÂN HỒI TÁI SINH] hoặc [🔥 ĐOẠT XÁ TRÙNG SINH], hệ thống mới tạo sinh mệnh mới hoặc gán thân xác NPC.
*   **Khóa Cứng Ngăn Tạo PendingCombat Khi Chết:** Ngăn chặn tuyệt đối việc phân tích chiến đấu và trích xuất giao tranh từ văn bản AI khi nhân vật chính đã tử vong (HP = 0 hoặc isDead = true).
*   **Làm Sạch Cơ Học Thông Tin & Chỉ Số:** Cuối lượt kể cái chết tức tưởi của MC, toàn bộ thông tin định danh chuyển về "Đang trống", các chỉ số đưa về 0 để dành chỗ cho MC mới sau khi định đoạt số phận.

### 🌟 CẬP NHẬT MỚI: TỐI ƯU HÓA LUỒNG TỬ VONG / TỰ SÁT & MỞ KHÓA LỰA CHỌN ĐOẠT XÁ - LUÂN HỒI (01/09/2026 - 16:30)
*   **Chuyển Ngay Về Giao Diện Kể Chuyện Sau Khi Tự Sát:** Loại bỏ hoàn toàn màn hình trắng che khuất "Không Gian Luân Hồi" và không tự động ép tạo MC mới ngầm khi người chơi tự sát trong chiến đấu.
*   **Chủ Động Lựa Chọn Luân Hồi Hoặc Đoạt Xá:** Cung cấp 2 lựa chọn trực quan ngay tại thanh thao tác: [☸️ LUÂN HỒI TÁI SINH] (tạo MC mới) hoặc [🔥 ĐOẠT XÁ TRÙNG SINH] (chiếm hữu thể xác NPC khả dụng).
*   **Khắc Phục Tình Trạng Treo Màn Hình:** Giao diện tiếp tục hiển thị lời dẫn bi tráng trên StoryLog mà không bị đơ hoặc kẹt lại ở màn hình chuyển giao.

### 🌟 CẬP NHẬT MỚI: SIẾT CHẶT QUY TẮC COMBAT & RÀNG BUỘC TAG CHỈ SỐ 1:1 (01/09/2026 - 15:40)
*   **Khóa Chặt Danh Sách Tham Chiến:** Chỉ gửi danh sách NPC thực sự đang có mặt trên thanh thẻ tên chiến đấu vào Prompt AI, ngăn chặn triệt để tình trạng NPC dự bị nhảy vào hành động.
*   **Ràng Buộc Tag Chỉ Số 1:1:** Ép buộc mọi hành động công kích, kỹ năng, mất máu hoặc hiệu ứng trạng thái của từng NPC trong văn kể phải xuất đúng cặp tag [HP_CHANGE] / [MP_CHANGE] / [STATUS] tương ứng.
*   **Ví Dụ Mẫu Một Lượt Đấu Hoàn Chỉnh:** Tích hợp khối ví dụ One-Shot chuẩn mực từ thinking, hành động đến sinh tag và lựa chọn choice giúp AI mô phỏng nhịp độ giao tranh hỗn chiến chân thực.

### 🌟 CẬP NHẬT MỚI: ĐỒNG BỘ TỰ ĐỘNG CHIẾN ĐẤU & ĐÀO TẨU VỀ TRUNG TÂM XỬ LÝ VÀ XOAY KEY EMBEDDING (01/09/2026 - 15:00)
*   **Đồng Bộ Tự Động Chiến Đấu & Đào Tẩu:** Chuyển giao 100% quyền xử lý kết quả cơ học và sinh lời kể của hai tính năng Tự động chiến đấu (Auto Combat) và Đào tẩu (Flee Combat) về hàm trung tâm xử lý \`handleCombatEnd\`.
*   **Đồng Bộ Hóa Cơ Chế Hậu Quả:** Đảm bảo toàn bộ các tiến trình cơ học phức tạp (bao gồm tính EXP, Permadeath, kích hoạt Mật pháp võ học, và đồng bộ trạng thái nhân vật) hoạt động đồng bộ và đồng nhất với RealTimeCombat.
*   **Xoay API Key Cho Tiến Trình Tạo Vector (Embedding):** Khắc phục triệt để lỗi chạm giới hạn hạn ngạch \`RESOURCE_EXHAUSTED (429)\` bằng cách tích hợp thuật toán xoay API Key động theo danh mục \`main\` cho tiến trình tạo vector (Embedding).

### 🌟 CẬP NHẬT MỚI: TÍCH HỢP LÝ THUYẾT TRÒ CHƠI BẤT CÂN XỨNG VÀO LOGIC THIỆN CẢM (31/08/2026 - 16:00)
*   **Always-On Game Theory Decision Matrix:** Tích hợp mô hình lý thuyết trò chơi không đầy đủ thông tin (Game of Incomplete Information) chạy tự động cho mọi tương tác của NPC/Bạn đồng hành.
*   **Trục Biến Số Trust & Fear Kép:** NPC tự động đánh giá hành vi dựa trên Niềm tin (Trust) và Sự sợ hãi (Fear) kết hợp so khớp chênh lệch cảnh giới tu vi thực tế để tìm điểm Cân bằng Nash (Nash Equilibrium) tối ưu.
*   **Xử Lý Tag GT_TRUST & GT_FEAR:** Hỗ trợ tự động cập nhật, tích lũy và điều chỉnh động hai chỉ số Trust & Fear của NPC thông qua hệ thống tag xử lý mối quan hệ, hiển thị trực quan trạng thái tâm lý chiến lược trong Nhật ký hệ thống.

### 🌟 CẬP NHẬT MỚI: TÍCH HỢP CHẾ ĐỘ "SIÊU MẠT PHÁP" (20/08/2026 - 08:30)
*   **Chế độ Siêu mạt pháp (Super Manual Mode):** Bổ sung tùy chọn trong Cài đặt AI cho phép bỏ qua hoàn toàn các AI phụ (Fast Agent, Pre-combat, Tóm tắt).
*   **AI Chính Tự Gánh Vác:** Ép AI chính tự bóc tách các tag hệ thống (\`[STATS_UPDATE]\`, \`[BEGIN_COMBAT]\`...) và tự viết \`flash_summary\` để tối ưu hóa sự nhất quán và giảm độ trễ do gọi nhiều API.
*   **Cơ Chế Bóc Tách Trực Tiếp:** Hệ thống tự động nhận diện và xử lý các thẻ \`<update_data>\` và \`<flash_summary>\` ngay trong lời kể chính khi chế độ này được kích hoạt.

### 🌟 CẬP NHẬT MỚI: BỔ SUNG THANH ĐIỀU CHỈNH ÂM LƯỢNG VÀ GIẢM 50% ÂM LƯỢNG NHẠC NỀN (08/08/2026 - 16:04)
*   **Giảm 50% Âm Lượng Nhạc Nền:** Đưa mức âm lượng mặc định của nhạc nền SoundCloud từ 40% xuống 20% giúp âm thanh dịu nhẹ, êm ái hơn khi đọc truyện.
*   **Thanh Điều Chỉnh Âm Lượng Riêng:** Thêm thanh kéo tăng/giảm âm lượng trực quan (từ 0% đến 100%) ngay bên cạnh nút bật/tắt nhạc (■)/(▶) trên thanh Header ở giao diện Kể Chuyện.
*   **Đồng Bộ Trạng Thái Âm Lượng:** Tự động lưu mức âm lượng cài đặt vào \`music_volume\` và cập nhật tức thì đến trình phát SoundCloud Widget.

### 🌟 CẬP NHẬT MỚI: CHUẨN HÓA TAG TÁC ĐỘNG HP/MP VÀ TRẠNG THÁI CHIẾN ĐẤU (07/08/2026 - 18:40)
*   **Xử Lý Tag [MONEY_CHANGE]:** Tích hợp \`currencyTagProcessor.ts\` tự động tiếp nhận và xử lý tag \`[MONEY_CHANGE: amount="...", reason="..."]\` từ phản hồi AI.
*   **Cập Nhật Linh Thạch / Tiền Tệ:** Tính toán chính xác số dư biến động (tăng/giảm) của nhân vật chính, đảm bảo không âm.
*   **Thông Báo Nhật Ký Trực Quan:** Tự động sinh \`GameMessage\` thông báo giao dịch tài chính với biểu tượng 💰 sinh động và ghi nhận lý do giao dịch lên nhật ký hệ thống.

### 🌟 CẬP NHẬT MỚI: TỰ ĐỘNG ÉP CHỈ SỐ PHÀM NHÂN (06/08/2026 - 10:05)
*   **Áp Cứng HP/MP 100/50:** Khi tắt hệ thống tu luyện, toàn bộ nhân vật (MC và NPC) sẽ tự động bị ép mức MaxHP là 100 và MaxMP là 50.
*   **Bảo Toàn Cảnh Giới:** Cơ chế ép chỉ số giờ đây chỉ tác động lên các thông số sinh lực/linh lực, tuyệt đối không thay đổi cảnh giới hiện tại của nhân vật.
*   **Vô Hiệu Hóa Chuẩn Hóa:** Toàn bộ cơ chế tự động phát hiện sai lệch thực lực và modal chuẩn hóa sẽ được tắt hoàn toàn khi không bật hệ thống sức mạnh đặc thù.

### 🌟 CẬP NHẬT MỚI: VÔ HIỆU HÓA CHUẨN HÓA THỰC LỰC KHI TẮT TU LUYỆN (06/08/2026 - 09:05)
*   **Vô Hiệu Hóa Tự Động Chuẩn Hóa:** Khi tắt tùy chọn "Bật Hệ Thống Tu Luyện/Sức Mạnh Đặc Thù", toàn bộ cơ chế phát hiện sai lệch chỉ số hoặc tự động kích hoạt tiến trình chuẩn hóa thực lực sẽ hoàn toàn được tắt.
*   **Ngăn Chặn Modal Gây Gián Đoạn:** Hệ thống sẽ bỏ qua mọi quy trình rà soát cảnh giới, thọ nguyên và chỉ số chiến đấu, không còn hiển thị thông báo hay modal chuẩn hóa thực lực, đảm bảo trải nghiệm chơi trơn tru nhất.

### 🌟 CẬP NHẬT MỚI: FIX LỖI TIMEOUT 400S & DỌN DẸP LỖI HỆ THỐNG (05/08/2026 - 21:50)
*   **Tăng Giới Hạn Timeout:** Nâng ngưỡng thời gian chờ từ 400 giây lên 600 giây (10 phút) để đáp ứng các yêu cầu khởi tạo thế giới phức tạp hoặc phân tích nguyên tác chuyên sâu.
*   **Tối Ưu Luồng Stream:** Cải thiện cơ chế bóc tách \`thought\` (tư duy ngầm) để hiển thị mượt mà hơn trong suốt quá trình AI xử lý, giúp người dùng nắm bắt tiến độ real-time.
*   **Dọn Dẹp Lỗi Linter:** Sửa lỗi ép kiểu dữ liệu (\`File\`, \`Quest\`, \`ParsedQs\`) trên toàn hệ thống, đảm bảo mã nguồn đạt độ ổn định và chính xác cao nhất.

### 🌟 CẬP NHẬT MỚI: CƠ CHẾ NÉN THUỘC TÍNH NPC & QUÊN LÃNG TỰ ĐỘNG (31/08/2026 - 21:05)
*   **Cơ Chế Nén Thuộc Tính NPC (>= 100 NPC):** Khi thế giới đạt từ 100 NPC trở lên, những NPC không xuất hiện hay được nhắc đến trong 20 lượt liên tiếp sẽ được tối ưu hóa dữ liệu prompt gửi cho AI (chỉ truyền đúng 3 thuộc tính cốt lõi: Tên, Giới tính, Tu vi/Cảnh giới).
*   **Cơ Chế Quên Lãng Tự Động (60 Lượt):** Tự động chuyển NPC sang mảng \`forgottenNPCs\` và xóa vĩnh viễn khỏi State khi không được nhắc tới trong 60 lượt liên tiếp, ngăn chặn phình to bộ nhớ và tối ưu hóa token.
*   **Đồng Bộ Ngữ Cảnh Prompt:** Tích hợp bộ lọc nén cơ học trên toàn bộ hệ thống kể chuyện chính (\`continuePrompt\`, \`continueprisonPrompt\`, \`promptBuilders\`).

### 🌟 CẬP NHẬT MỚI: TỐI ƯU HIỂN THỊ LUỒNG TƯ DUY & RESET DỮ LIỆU PHASE (05/08/2026 - 20:10)
*   **Reset Console Giữa Các Phase:** Cập nhật cơ chế chuyển giao Phase tại \`WorldInitializationService.ts\`, tự động xóa sạch dữ liệu console streaming của Phase cũ ngay khi chuyển sang Phase mới (L0 -> L0.5), loại bỏ hoàn toàn hiện tượng dữ liệu cũ bị "đơ" trên giao diện.
*   **Hiển Thị Tư Duy Ngầm (Real-time Thought Stream):** Nâng cấp bộ bóc tách stream tại \`geminiService.ts\` (Phase L0.5), cho phép đọc sâu vào cấu trúc phần tử và trích xuất dòng suy nghĩ \`thought\` trong thời gian thực khi mô hình đang xử lý JSON phức tạp.
*   **Bọc Thẻ <thinking> Tự Động:** Toàn bộ dòng lập luận của AI giờ đây được bọc tự động vào cặp thẻ \`<thinking>\` tương thích hoàn hảo với giao diện StreamingConsole, giúp người dùng theo dõi được tiến trình xử lý liên tục thay vì phải chờ đợi mù mịt.

### 🌟 CẬP NHẬT MỚI: AI TỰ ĐỘNG THIẾT LẬP THEO BỐI CẢNH & TRA CỨU NGÔN NGỮ GỐC (05/08/2026 - 18:10)
*   **Dịch Vụ Tra Cứu Nguyên Tác (\`CultivationCanonSearchService\`):** Khi bấm nút "AI Tự động thiết lập theo bối cảnh", hệ thống kích hoạt quy trình trích xuất và suy luận cấp bậc bằng ngôn ngữ gốc của tác phẩm (Tiếng Trung, Tiếng Nhật, Tiếng Anh, v.v.).
*   **Đồng Bộ Cấu Trúc Trạng Thái (\`CultivationStateApplier\`):** Tự động điền đồng thời cả 3 vị trí state (\`majorRealmsRaw\`, \`parsedMajors\`, và \`raceCultivationSystems\`), đảm bảo hiển thị tức thì trên giao diện và áp dụng chính xác cho toàn bộ nhân vật.
*   **Hiển Thị Trạng Thái 2 Bước:** Cập nhật thông báo tiến trình rõ ràng từ bước tìm kiếm nguyên tác bằng ngôn ngữ gốc đến bước biên soạn hệ thống tu luyện.

### 🌟 CẬP NHẬT MỚI: TỰ ĐỘNG CHUẨN HÓA VÀ ĐỒNG BỘ HỆ THỐNG TU LUYỆN ĐỒNG NHÂN (05/08/2026 - 17:45)
*   **Chuẩn Hóa Dữ Liệu Cảnh Giới:** Tạo dịch vụ \`cultivationSyncService.ts\` để tự động phân tích và đồng bộ hệ thống tu luyện từ phản hồi AI khi phân tích đồng nhân.
*   **Áp Dụng Tự Động Vào Settings:** Tự động điền cả \`cultivationSystem\` (Hệ thống chung) và \`raceCultivationSystems\` (Hệ thống theo chủng tộc), đảm bảo cảnh giới được áp dụng đầy đủ vào ô "Đại Cảnh Giới" ngay sau khi bấm phân tích đồng nhân.
*   **Cập Nhật Prompt:** Bổ sung hướng dẫn chi tiết yêu cầu AI trả về tag \`[GENERATED_UNIFIED_SYSTEM]\` hoặc \`[GENERATED_RACE_SYSTEM]\` bất kể tác phẩm gốc sử dụng danh xưng tu luyện nào (Ma Pháp, Kiếm Lai, Vũ Trụ, Cấp Bậc...).

### 🌟 CẬP NHẬT MỚI: SỬA LỖI PHÂN TÁCH KHOẢNG TRẮNG KHI TỰ ĐỘNG THIẾT LẬP NHÂN VẬT (05/08/2026 - 13:05)
*   **Vá Lỗi Phân Tách Khoảng Trắng:** Khắc phục triệt để lỗi khi người chơi sử dụng "Tự động thiết lập" (AI Hỗ Trợ) thì hệ thống chỉ ghi nhận từ đầu tiên trong các thuộc tính như Chủng tộc, Tính cách, Tiểu sử, Bối cảnh ban đầu, Mục tiêu...
*   **Giải Pháp Đồng Bộ 2 Phía:**
    *   *Bộ Phân Tích (Attribute Parser):* Bổ sung cơ chế tự động giữ lại toàn bộ chuỗi ban đầu làm giá trị mặc định cho các thuộc tính \`text\`, \`value\`, và \`name\` nếu chuỗi truyền vào hoàn toàn không chứa dấu \`=\` (không thuộc định dạng khóa-trị tiêu chuẩn).
    *   *Định Dạng Prompt:* Cập nhật cấu trúc hướng dẫn sinh tag trong hệ thống để chỉ định rõ thuộc tính \`text="..."\` hoặc \`value="..."\` bọc trong nháy kép khi mô hình AI sinh các thông tin nhân vật chính.

### 🌟 CẬP NHẬT MỚI: CHUẨN HÓA FAST AGENT GỘP TRÍCH XUẤT TAG VÀ KÝ ỨC (31/08/2026 - 21:18)
*   **Gộp Fast Agent (1 Call Chuyên Dụng):** Đồng bộ hoàn toàn theo luồng lượt chơi chuẩn thông qua \`DataExtractionService.extractTagsAndMemory\` (model combat/fast) để vừa trích xuất toàn bộ tag hệ thống, vừa tạo tóm tắt nhanh và chi tiết diễn biến.
*   **Đồng Bộ Ký Ức Ngoại Tuyến (Offline Dual Memory):** Tích hợp \`saveFlashAgentMemoryOffline\` lưu trữ trực tiếp vào RAG Vector Store và lịch sử tri thức mà không cần thêm bất kỳ cuộc gọi API phụ nào.

### 🌟 CẬP NHẬT MỚI: HOÁN ĐỔI ĐỒNG MINH VÀ HIỆU ỨNG RÚT LUI TRONG REALTIME COMBAT (15/09/2026 - 15:10)
*   **Hoán Đổi Thành Viên Đội Hình:** Trong giao diện "Sơ đồ chiến đấu" của RealTimeCombat, cho phép chọn bất kỳ đồng minh đang chiến đấu nào để lùi về dự bị và đưa đồng minh dự bị vào thay thế.
*   **Hiệu Ứng Rút Lui & Xuất Trận Trực Quan:** Nhân vật khi bị đổi xuống dự bị sẽ kích hoạt trạng thái di chuyển sang mép bên trái bản đồ và tự động ẩn đi, đồng thời nhân vật dự bị mới sẽ chạy từ mép trái vào bãi chiến trường tham chiến.

### 🌟 CẬP NHẬT MỚI: TỰ ĐỘNG CHIẾN ĐẤU & BỎ CHẠY VỚI LỜI KỂ HẬU QUẢ AI (31/08/2026 - 20:50)
*   **Tự Động Chiến Đấu (Auto Combat):** Cơ chế cơ học tự động so khớp lực chiến (HP, Công, Thủ, Cảnh giới) giữa phe ta và phe địch để định đoạt kết quả thắng/thua, phân định thương vong NPC/Yêu thú, tính toán tổn thất HP và trao thưởng EXP, Linh thạch.
*   **Đào Tẩu Chiến Trường (Flee Combat):** Tỉ lệ 100% thoát hiểm thành công, áp dụng hình phạt trừ 1 tiểu cảnh giới tu vi (xóa EXP tích lũy), mất 70% Linh thạch và giảm -50 điểm thiện cảm với toàn bộ NPC có mặt.
*   **Tạo Lời Kể Hậu Quả Sau Chiến Đấu:** Tích hợp quy trình gọi AI tự động sinh lời kể kịch tính, phong phú cùng 3 lựa chọn hành động tiếp nối tương tự RealTimeCombat, chuyển các nút thao tác lên vị trí đầu thuận tiện nhất.

### 🌟 CẬP NHẬT MỚI: CHUYỂN ĐỔI MODEL CHO CÁC TÁC VỤ DÒNG THỜI GIAN (05/08/2026 - 09:35)
*   **Tác vụ Dòng Thời Gian:** Cấu hình thành công các tác vụ thêm sự kiện trong timeline bao gồm "Thêm Sự Kiện (+10)", "Tạo Lại Lịch Sử Theo Nguyên Tác" và "🔮 Tạo thêm sự kiện".
*   **Sử Dụng Model "economy":** Chuyển đổi hoàn toàn cơ chế gọi AI cho các tác vụ này sang danh sách model "economy" thay vì "main" để tiết kiệm tài nguyên và tối ưu hóa chi phí vận hành, đồng thời giữ nguyên tính năng grounding và đối chiếu nguyên tác chính xác.

### 🌟 CẬP NHẬT MỚI: ĐỒNG BỘ QUY TRÌNH & CHỈNH SỐ LƯỢNG 10 SỰ KIỆN CHO DÒNG THỜI GIAN (05/08/2026 - 08:48)
*   **Đồng Bộ Quy Trình "🔮 Tạo Thêm Sự Kiện":** Chuẩn hóa quy trình tạo thêm sự kiện trong Gameplay hoàn toàn giống với "Thêm Sự Kiện" ở màn hình cấu hình.
*   **Điêu Chỉnh Số Lượng 10 Sự Kiện:** Cấu hình "Thêm Sự Kiện (+10)" và "🔮 Tạo thêm sự kiện" tạo ra đúng 10 sự kiện nối tiếp (đồng bộ với "Tạo Lại Lịch Sử Theo Nguyên Tác").

### 🌟 CẬP NHẬT MỚI: MẶC ĐỊNH BẬT TRA CỨU SÂU CHO CUỘC PHIÊU LƯU MỚI (05/08/2026 - 08:35)
*   **Mặc Định Bật Tra Cứu Sâu (Deep Grounding):** Tự động kích hoạt tính năng Tra Cứu Sâu (Google Search Grounding & Tự Động Dịch Tiếng Gốc) làm cấu hình mặc định mỗi khi người chơi bắt đầu "Cuộc Phiêu Lưu Mới".
*   **Tối Ưu Trải Nghiệm Khởi Tạo:** Đảm bảo hệ thống luôn sẵn sàng tìm kiếm thông tin chính xác nhất từ Google Search cho các nguyên tác mà không cần người dùng thao tác bấm chọn thủ công.

### 🌟 CẬP NHẬT MỚI: TỰ ĐỘNG HÓA MODEL CHỈ ĐỊNH "MAIN - ECONOMY - COMBAT" (05/08/2026 - 08:30)
*   **Sửa Lỗi Khởi Tạo Thế Giới (#sym:502):** Khắc phục triệt để lỗi "#sym:502" trong quá trình khởi tạo bối cảnh thế giới bằng cách loại bỏ hoàn toàn các model hardcode không tồn tại như \`gemini-3.1-flash-lite-preview\`.
*   **Tuân Thủ Quy Tắc Danh Sách Động:** Đồng bộ 100% các tác vụ gọi API trong hệ thống để tự động sử dụng danh sách mô hình động (\`main\`, \`economy\`, \`combat\`, \`lite\`), đảm bảo không có bất kỳ dòng code nào bị gán cứng model ID, mang lại tính ổn định tuyệt đối và tránh xung đột model.
*   **Tối Ưu Phản Hồi Từ Settings:** Hệ thống luôn tôn trọng 100% cấu hình API Key và cấu hình Model của người dùng từ màn hình cài đặt API.

### 🌟 CẬP NHẬT MỚI: TÍCH HỢP MA TRẬN LÝ THUYẾT TRÒ CHƠI TOÀN DIỆN & ĐỒNG BỘ SUY NGHĨ (31/08/2026 - 20:40)
*   **Trích Xuất & Tính Toán Always-On Toàn Diện (gameTheoryContextBuilder):** Mở rộng quét toàn bộ các NPC trong bối cảnh/nguyên tác (thay vì chỉ giới hạn trong đội hình). Tự động tính toán ma trận lợi ích Trust, Fear, Coop/Exploit/Flee và chiến lược Cân bằng Nash (Nash Equilibrium) cho mọi NPC xuất hiện trong tình huống.
*   **Độc Lập Tuyệt Đối Với Preset & Chế Độ Thay Thế:** Tiêm trực tiếp khối ma trận chiến lược vào vị trí ưu tiên cao nhất của prompt, đảm bảo cơ chế phân tích Game Theory luôn hoạt động ổn định và chính xác bất kể người chơi đang bật Preset hay chế độ tùy biến nào.
*   **Đồng Bộ Chuẩn Hóa Khối <thinking>:** Cập nhật toàn diện quy trình suy nghĩ và ví dụ mẫu Few-Shot sang chuẩn mới "=== PHÂN TÍCH LOGIC THIỆN CẢM & GAME THEORY ===", ép AI bắt buộc phải phân tích các chỉ số lợi ích trước khi xuất hành vi.

### 🌟 CẬP NHẬT MỚI: VÁ LỖI CƯỚP FOCUS MODAL & TỰ ĐỘNG ĐIỀN NGUYÊN TÁC (04/08/2026 - 23:35)
*   **Vá Lỗi Cướp Focus Triệt Để:** Khắc phục hoàn toàn hiện tượng khi đang gõ chữ tìm kiếm trong Modal thì bị cướp focus và văng con trỏ ra ngoài. Bằng cách tách biệt cơ chế thiết lập focus khởi tạo của Modal ra khỏi các sự kiện cập nhật của component cha, đảm bảo trải nghiệm gõ phím mượt mà 100%.
*   **Điền Tác Phẩm Mới Tự Động:** Khi người dùng nhập một tác phẩm mới không nằm trong 287 tác phẩm có sẵn (ví dụ: "ta là giáo chủ") và bấm Đóng hoặc bấm ra ngoài Modal tìm kiếm, hệ thống sẽ tự động gán tên đó trực tiếp vào ô nhập liệu "Chọn Tác Phẩm (Nguyên Tác)".
*   **Tạo Bản Ghi Ảo Đồng Bộ:** Tự động tạo một bản ghi bối cảnh và cốt truyện ảo dựa trên tên tác phẩm tự nhập, đảm bảo toàn bộ hệ thống phân tích và tạo đồng nhân diễn ra hoàn hảo không bị gián đoạn.

### 🌟 CẬP NHẬT MỚI: QUY TRÌNH KHỞI TẠO THẾ GIỚI 2 PHA (PHASED WORLD INITIALIZATION) (04/08/2026 - 15:30)
*   **Trích Xuất Nhân Vật & Cốt Truyện Toàn Diện (Pha 1):** Kích hoạt quy trình trích xuất chi tiết 15 trường thông tin cốt lõi của nhân vật chính và cốt truyện (Tên, Giới tính, Chủng tộc, Linh căn, Thể chất, Thọ nguyên, Số tiền khởi đầu...) bằng Google Search Grounding ngôn ngữ gốc trước khi sinh thế giới.
*   **Tiền Đề Thế Giới Đồng Bộ (Pha 2):** Sử dụng trực tiếp gói dữ liệu trích xuất ở Pha 1 làm tiền đề cứng để định hình Thiết lập Thế giới, Địa điểm, Phe phái và Vật phẩm khởi đầu, loại bỏ hoàn toàn hiện tượng lệch lạc thông tin giữa nhân vật và thế giới.
*   **Tích Hợp Giao Diện Trực Quan:** Tự động ánh xạ toàn bộ 15 trường dữ liệu chi tiết của nhân vật chính vào giao diện Thiết lập Bối cảnh, mang lại trải nghiệm chuẩn xác tuyệt đối theo nguyên tác.

### 🌟 CẬP NHẬT MỚI: TỰ ĐỘNG GỘP SUY NGHĨ VÀO HÀNH ĐỘNG GỢI Ý (04/08/2026 - 09:11)
*   **Làm Giàu Nội Dung Hành Động:** Khi bấm vào gợi ý AI, hệ thống sẽ tự động gộp cả Tiêu đề và Suy nghĩ nội tâm (thought) vào ô nhập liệu theo định dạng: \`Tiêu đề] /* Suy nghĩ\`.
*   **Tăng Độ Sâu Nhập Vai:** Giúp AI nắm bắt được cả "thái độ" và "ý định" ngầm của nhân vật, từ đó đưa ra phản hồi sát với mong muốn của người chơi hơn.
*   **Tối Ưu Giao Diện Thu Nhỏ:** Bổ sung nút thu nhỏ cho bảng thông báo "Đang chuyển đổi Model dự phòng", giúp người chơi chủ động quản lý không gian màn hình khi gặp sự cố mạng.

### 🌟 CẬP NHẬT MỚI: TỰ ĐỘNG CẢNH BÁO THIẾU SỰ KIỆN DỰ TRỮ (04/08/2026 - 08:03)
*   **Tự Động Cảnh Báo Khi Cạn Kiệt Sự Kiện:** Tự động chặn hành động gửi và hiển thị cảnh báo khi số lượng sự kiện dòng thời gian chưa hoàn thành giảm xuống dưới 2 sự kiện.
*   **Hẹn Giờ Delay 5 Lượt (Cooldown):** Cơ chế thông minh sẽ tự động cho phép người chơi tiếp tục chơi sau khi xem cảnh báo, và chỉ nhắc lại sau mỗi 5 lượt chơi nếu danh sách sự kiện vẫn chưa được bổ sung.

### 🌟 CẬP NHẬT MỚI: HỆ THỐNG HƯỚNG DẪN 3.0 (numeric markers) (03/08/2026 - 09:35)
*   **Điểm Chỉ Dẫn Số Hóa Toàn Diện:** Mở rộng hệ thống nút số nhấp nháy sang màn hình "Cuộc Phiêu Lưu Mới".
*   **Lộ Trình Onboarding:** Hướng dẫn người chơi theo trình tự chuẩn: AI Hỗ Trợ -> Nhân Vật -> Thế Giới -> Yếu Tố Khởi Đầu.
*   **Tương Tác Theo Yêu Cầu:** Người chơi bấm vào từng con số để hiện bóng thoại diễn giải tương ứng. Bấm ra ngoài hoặc bấm vào số khác để chuyển đổi.
*   **Tối Ưu Thị Giác & Kim Chỉ Dài:** Giữ nguyên phong cách kim chỉ dài cổ phong (28px) và bóng thoại đứng im, đảm bảo sự tập trung cao nhất khi đọc chỉ dẫn.

### 🌟 CẬP NHẬT MỚI: HỆ THỐNG HƯỚNG DẪN TRỰC QUAN 2.0 (03/08/2026 - 08:54)
*   **Nút "?" Nhấp Nháy Trực Quan:** Thêm nút dấu chấm hỏi ở góc khung chính với hiệu ứng nhấp nháy cổ phong để kích hoạt hướng dẫn.
*   **Bóng thoại Cố Định & Kim Chỉ Dài:** Cải tiến bóng thoại hướng dẫn hoàn toàn đứng im, không còn trôi nổi. Sử dụng kim chỉ dẫn kéo dài (20px) giúp giao diện thoáng đãng và tránh chồng lấp.
*   **Tích hợp Tài liệu Chi tiết:** Cho phép mở tài liệu hướng dẫn chuyên sâu ngay bên trong bóng thoại của nút Hướng Dẫn.

### 🌟 CẬP NHẬT MỚI: HỆ THỐNG HƯỚNG DẪN TRỰC QUAN (OVERLAY) (03/08/2026 - 15:44)
*   **Lớp phủ hướng dẫn thông minh:** Thêm tính năng "Hướng Dẫn" trực quan. Khi kích hoạt, các bóng thoại sẽ xuất hiện chỉ vào từng nút bấm trên trang chủ, giải thích chi tiết công năng của từng khu vực.
*   **Tương tác mượt mà:** Sử dụng hiệu ứng motion/react để bóng thoại có hiệu ứng "thở" nhẹ nhàng, giúp người chơi mới dễ dàng nắm bắt cách vận hành của Thiên Đạo.

### 🌟 CẬP NHẬT MỚI: CƠ CHẾ CƠ HỌC TỰ ĐỘNG XÓA BỎ SỰ KIỆN & NHIỆM VỤ RÁC CHỈ CHỨA DẤU BA CHẤM (...) (03/08/2026 - 16:45)
*   **Bộ lọc Cơ học Chống Ba Chấm (Sanitization Mechanic):** Tự động kiểm tra và loại bỏ triệt để mọi sự kiện dòng thời gian (Timeline Events) cũng như nhiệm vụ (Quests/Chapters) có tên/tiêu đề hoặc nội dung chỉ chứa dấu ba chấm (\`...\` hoặc \`…\`) hoặc rỗng rác.
*   **Đồng bộ trên Cả 2 Giao diện:** Áp dụng ở cả khâu parse dữ liệu AI, khâu đồng bộ Thiên Đạo (QuestSyncService), giao diện Thiết lập Bối cảnh lẫn màn hình Cuộc Phiêu Lưu Kể Chuyện thực tế.

### 🌟 CẬP NHẬT MỚI: TỰ ĐỘNG PHÂN TÍCH QUỐC GIA & TRA CỨU GOOGLE SEARCH CHO DÒNG THỜI GIAN NGUYÊN TÁC (03/08/2026 - 15:58)
*   **Tạo dịch vụ mới TimelineAccuracyService:** Hệ thống tự động sử dụng model danh sách "economy" để phân tích tác phẩm, nhận diện quốc gia/ngôn ngữ nguyên tác (Trung Quốc, Nhật Bản, Hàn Quốc, Âu Mỹ, Việt Nam...) và trích xuất từ khóa tên gốc bản địa.
*   **Google Search Grounding Trực tuyến:** Kích hoạt tính năng tìm kiếm Google Search bằng ngôn ngữ gốc bản địa để tra cứu niên biểu sự kiện lịch sử chuẩn xác nhất từ các nguồn chính thống (Wiki, Baike, Fandom...).
*   **Tiêm Ngữ Cảnh Chuẩn Xác:** Bổ sung dữ liệu tra cứu trực tuyến vào prompt khởi tạo và nối tiếp dòng thời gian, triệt tiêu hiện tượng AI bịa đặt hoặc làm sai lệch diễn biến nguyên tác.

### 🌟 CẬP NHẬT MỚI: CẢI TIẾN TẠO THÊM SỰ KIỆN DÒNG THỜI GIAN (03/08/2026 - 13:10)
*   **Tiêm Bối Cảnh Lượt Chơi:** Khi bấm nút "Tạo thêm sự kiện" ở giao diện Dòng Thời Gian Thiết Lập mà chưa có sự kiện nào, hệ thống tự động tiêm tên Nguyên Tác (Chủ đề thế giới) cùng với nội dung 2 lượt diễn biến gần nhất từ cuộc phiêu lưu.
*   **Tra cứu và Nối tiếp Tự nhiên:** AI tra cứu chi tiết diễn biến vừa diễn ra để khởi tạo tiếp nối các sự kiện dòng thời gian bám sát mạch truyện thực tế.

### 🌟 CẬP NHẬT MỚI: TÍNH NĂNG "THÊM SỰ KIỆN (+20)" CHO DÒNG THỜI GIAN NGUYÊN TÁC (03/08/2026 - 09:55)
*   **Nút "Thêm Sự Kiện (+20)" mới:** Thêm nút bấm "Thêm Sự Kiện (+20)" nằm ngay bên cạnh nút "Tạo Lại Lịch Sử Theo Nguyên Tác" tại mục Cấu hình Thế giới.
*   **Tạo nối tiếp mượt mà:** Hệ thống tự động trích xuất 5 sự kiện gần nhất hiện có trong danh sách làm bối cảnh đầu vào, gửi prompt yêu cầu AI phân tích và nối tiếp thêm 20 sự kiện tiếp diễn chi tiết (bao gồm biến cố, nhân vật phụ, địa điểm, mục tiêu) mà không làm mất các sự kiện đã có.

### 🌟 CẬP NHẬT MỚI: HIỂN THỊ SỐ LƯỢT TURN BÊN CẠNH TÊN SAVEGAME (02/08/2026 - 07:25)
*   **Hiển thị lượt chơi (Turn Count):** Thêm nhãn nổi bật \`Lượt: X\` bên cạnh tên từng file lưu (Save Game) tại màn hình danh sách file lưu cục bộ (\`LoadGameScreen\`) và màn hình xuất/nhập file (\`ImportExportScreen\`), giúp người chơi dễ dàng nhận biết tiến trình của từng file.

### 🌟 CẬP NHẬT MỚI: TỐI ƯU HIỂN THỊ CHATBOT & LỌC THẺ SUY NGHĨ (01/08/2026 - 16:45)
*   **Lọc bỏ thẻ suy nghĩ (<thinking>):** Cập nhật hệ thống trung tâm (\`callGeminiAPI\`) để tự động nhận diện và làm sạch toàn bộ các khối suy nghĩ nội bộ (\`<thinking>...</thinking>\`) từ phản hồi của model, đảm bảo giao diện chatbot và các màn hình trò chuyện luôn sạch sẽ, trực quan và chuyên nghiệp.

### 🌟 CẬP NHẬT MỚI: TÍCH HỢP "CỔNG KHÔNG GIAN" ĐƯA CANVAS VÀO GAMEPLAY (01/08/2026 - 16:30)
*   **Kết nối Cổng không gian (DynamicCanvasEffect):** Tích hợp hoàn tất cơ chế đưa trực tiếp mã hình ảnh từ Canvas Prompt Studio vào hai màn hình chính: Kể chuyện (Story) và Chiến đấu (Combat) thông qua kiến trúc truyền tin Event-Driven.
*   **Mô tả tự do và Phân tích thông minh:** Người chơi có thể tự gõ yêu cầu tự nhiên (ví dụ: "vòng ma pháp dưới chân RealtimeCombat" hay "hiệu ứng tuyết rơi toàn màn hình kể chuyện"), AI siêu nhẹ sẽ tự động parse sang JSON đích danh để gán đúng phân khu (\`story\` / \`combat\`) và lớp phủ (\`overlay\` / \`background\`) tương ứng mà không làm tốn chi phí gọi code lớn.
*   **Tối ưu hiệu năng và Xử lý rác rưởi:** Mỗi Canvas chạy sandboxed, tự động dọn dẹp các tiến trình \`requestAnimationFrame\`, \`setInterval\` cũ để tránh tràn bộ nhớ và rò rỉ RAM (memory leak). Trạng thái được bảo lưu mượt mà qua các màn chơi.

### 🌟 CẬP NHẬT MỚI: CANVAS PROMPT STUDIO TẠI GIAO DIỆN DEV (01/08/2026 - 15:00)
*   **Canvas Prompt Studio:** Thêm nút "Canvas Prompt Studio" (Tạo Canvas) trong Giao diện DEV cho phép tạo và vẽ hình ảnh/đồ họa 2D trực tiếp lên HTML5 Canvas bằng AI Prompt.
*   **Mã hóa Canvas 2D linh hoạt:** AI sẽ sinh mã JavaScript vẽ Canvas thuần với đầy đủ hiệu ứng đường nét, tạo dải màu (gradient), phát sáng, hạt năng lượng...
*   **Trực quan hóa và Tải ảnh PNG:** Hỗ trợ điều chỉnh kích thước Canvas (400x400, 500x500, 600x600), xem mã nguồn JS chi tiết và xuất hình ảnh chất lượng cao dạng PNG.

### 🌟 CẬP NHẬT MỚI: TÍNH NĂNG CHATBOT SANDBOX ĐỘC LẬP TẠI TRANG CHỦ (01/08/2026 - 11:00)
*   **Chatbot Sandbox độc lập:** Thêm nút "Chatbot Sandbox" / "Chatbot" tại màn hình chính, cho phép đối thoại tự do với AI mà không bị ràng buộc bởi quy tắc hay bối cảnh lịch sử game.
*   **Gọi Model Lõi (Main):** Tự động sử dụng mô hình trong danh sách "main" được thiết lập ở Cài Đặt API.
*   **Nạp ngầm Preset đang bật:** Tự động trích xuất các Preset đang được kích hoạt từ "Preset ngự thiện phòng" vào thẻ "&lt;prompt_phu_tung&gt;" trong system prompt để thử nghiệm hiệu quả phản hồi của AI.

### 🌟 CẬP NHẬT MỚI: KỸ NĂNG BOM VĨ THÚ TRONG CHIẾN ĐẤU 3.0 (30/07/2026 - 22:35)
*   **Kỹ năng hủy diệt "Bom Vĩ Thú":** Thêm kỹ năng mới "Bom Vĩ Thú" cho người chơi. Kỹ năng yêu cầu tụ lực (channeling) trong 5 giây với hiệu ứng năng lượng Âm Dương tích tụ quanh nhân vật.
*   **Cơ chế bay và nổ hình nấm:** Sau khi tụ lực, nhân vật bắn ra quả cầu Vĩ Thú bay theo quỹ đạo hình parabol cực đẹp. Khi chạm đất, quả cầu tạo ra vụ nổ hình nấm (mushroom cloud) khổng lồ bán kính 250px, gây sát thương cực lớn lên mọi kẻ địch trong vùng ảnh hưởng.
*   **Hiệu ứng rung màn hình và chớp sáng:** Tích hợp hiệu ứng rung lắc màn hình (screen shake) và chớp sáng trắng (screen flash) cực mạnh khi bom nổ, tăng cường cảm giác uy lực và hoành tráng cho trận đấu.

### 🌟 CẬP NHẬT MỚI: TỰ ĐỘNG XUỐNG DÒNG CHO TIÊU ĐỀ/TÊN MỤC QUÁ DÀI (30/07/2026 - 10:44)
*   **Tự động xuống dòng thông minh:** Thay thế thuộc tính rút gọn chữ (\`truncate\`) bằng cơ chế \`flex-1 min-w-0 break-words whitespace-normal leading-relaxed\` giúp các mục có tiêu đề hoặc tên phân khu quá dài tự động xuống dòng và hiển thị toàn vẹn 100% nội dung.
*   **Cố định vị trí nút thao tác:** Thay đổi cách căng lề từ \`items-center\` sang \`items-start\` ở container cha, giữ các nút bấm thao tác (Xem thô, Giải thích AI, Bật/Tắt) luôn nằm gọn gàng, cố định ở góc trên bên phải khi tiêu đề xuống dòng nhiều hàng, tối ưu trải nghiệm thị giác.

### 🌟 CẬP NHẬT MỚI: CẬP NHẬT TÊN MỤC VĂN PHONG KỂ CHUYỆN (30/07/2026 - 10:23)
*   **Cập nhật nhãn <Van_phong_ke_chuyen_No.01>:** Đổi tên hiển thị từ "Văn phong kể chuyện" thành "Văn phong kể chuyện kèm ảnh avatar " trong mục cấu hình bộ lọc prompt gốc.

### 🌟 CẬP NHẬT MỚI: BẢO TOÀN BIỂU TƯỢNG CẢM XÚC (EMOJIS/ICONS) KHI DỊCH PRESET (30/07/2026 - 10:20)
*   **Bảo toàn biểu tượng cảm xúc tuyệt đối:** Tích hợp bộ quy tắc thông minh trong prompt dịch của mô hình Economy kết hợp với hàm hậu xử lý regex Unicode nâng cao \`/^([^\\p{L}\\p{N}]+)/u\` giúp tự động khôi phục và giữ nguyên vẹn 100% các icon, emoji đặc trưng (như 🌙, 🔸, 🔹, 📖, 🌕, 💀, 🧪, ◆, etc.) ở đầu các tiêu đề và tên phân khu sau khi dịch sang tiếng Việt.

### 🌟 CẬP NHẬT MỚI: ĐÁNH SỐ VŨ TRỤ & CƠ CHẾ SACRED TIMELINE (DÒNG THỜI GIAN THIÊNG LIÊNG) (02/08/2026 - 15:20)
*   **Đánh số Vũ trụ tự động:** Mỗi khi tạo mới một thế giới, hệ thống tự động gán mã định danh Vũ trụ theo định dạng chuẩn "1 chữ cái - 4 chữ số" (ví dụ: A-3182, D-2741) hiển thị trực tiếp trên thanh Header và danh sách File Lưu.
*   **Hiển thị UniverseId & Khung Vàng Lấp Lánh:** Mã định danh Vũ trụ (UniverseId) xuất hiện sinh động cạnh tên từng file Save. File Save ứng với cột mốc Dòng Thời Gian Thiêng Liêng (Sacred Timeline - lượt cao nhất) được nổi bật bằng khung viền vàng hoàng kim phát sáng cùng hiệu ứng hạt ma thuật lấp lánh bay bên trong.
*   **Sổ Thiên Tào Toàn Cục (Sacred Timeline):** Hệ thống lưu trữ kỷ lục lượt chơi xa nhất đạt tới của mỗi Vũ trụ cùng danh sách kết cục tử vong của các NPC.
*   **Tiêm Luật Nhân Quả (Karma Injection Prompt):** Khi quay lại các file Save game ở quá khứ (Lượt hiện tại < Lượt kỷ lục), AI tự động bị tiêm thẻ XML luật nhân quả bắt buộc NPC từng chết phải lặp lại câu thoại cuối cùng y hệt và tử vong đột ngột vì tai nạn thảm khốc bất ngờ, bảo toàn định mệnh tuyệt đối không thể đảo ngược.

### 🌟 CẬP NHẬT MỚI: TỐI ƯU HÓA DỊCH PRESET SANG TIẾNG VIỆT & RE-DESIGN UI (30/07/2026 - 10:12)
*   **Sử dụng model Economy:** Chuyển đổi toàn bộ tác vụ dịch Preset sang sử dụng các mô hình ngôn ngữ trong danh sách **"economy"** giúp xử lý nhanh chóng, chính xác và tiết kiệm token tối đa.
*   **Vá lỗi Parse JSON thông minh:** Thiết kế bộ bóc tách JSON siêu việt tự động loại bỏ thẻ \`<thinking>\` hoặc văn bản phụ trợ của AI trước khi parse, triệt tiêu hoàn toàn lỗi \`Unexpected token '<' is not valid JSON\`.
*   **Thiết kế lại Giao diện các nút bấm:** Gom các nút thao tác hỗ trợ gồm **"Chọn tất cả"**, **"🌐 Dịch TV"**, và **"✨ Phân tích AI"** vào một khung ngang (box) riêng biệt, gọn gàng nằm ngay dưới tiêu đề Preset, giúp giao diện trực quan, đẹp mắt và không bị xô lệch chữ.

### 🌟 CẬP NHẬT MỚI: TÍCH HỢP NÚT DỊCH PRESET SANG TIẾNG VIỆT (30/07/2026 - 10:02)
*   **Dịch thông minh qua Gemini API:** Tích hợp nút **"🌐 Dịch TV"** nằm ngay bên cạnh nút **"Chọn tất cả"** tại mỗi file Preset trong phần cấu hình "Preset ngự thiện phòng".
*   **Bảo toàn cấu trúc và tối ưu hóa:** Sử dụng Gemini API dịch toàn bộ tiêu đề (title), tên phân khu (name), và lời giải thích (description) hiển thị của Preset sang tiếng Việt chuẩn xác, súc tích, mượt mà mà vẫn giữ nguyên cấu trúc phân tách logic.

### 🌟 CẬP NHẬT MỚI: QUY TRÌNH PHÂN TÍCH SINH LỰC (HP) TRONG <thinking> (30/07/2026 - 06:33)
*   **Tách biệt quy tắc phân tích HP:** Tạo file quy tắc phân tích trạng thái sinh lực (HP) độc lập tại \`prompts/hpThinkingRules.ts\` để tối ưu luồng và tránh phình to prompt hệ thống.
*   **Bắt buộc phân tích HP trong thẻ tư duy:** Nạp quy tắc mới vào \`prompts/promptTaskHelpers.ts\` và tích hợp làm cơ chế tư duy bắt buộc khi bật quy trình thẩm định.
*   **Duy trì ngầm trạng thái sinh lực:** Cập nhật \`services/geminiService.ts\` nhằm đảm bảo quy tắc phân tích HP vẫn được duy trì ngầm trong thẻ \`<thinking>\` ngay cả khi người dùng tắt quy trình thẩm định (bật Preset).

### 🌟 CẬP NHẬT MỚI: ƯU TIÊN MODEL ĐÃ CHỌN & CHUẨN HOÁ LUỒNG FALLBACK (Phiên bản 9.43.0)
*   **Ưu tiên Tuyệt đối Model đã chọn:** Sửa đổi cơ chế điều phối \`getModelChainForTask\` và \`storyStreamService.ts\` để đảm bảo model được người dùng chỉ định luôn luôn là model xuất phát đầu tiên ở vị trí [0], loại bỏ hoàn toàn việc ép dùng model mặc định khi đổi nguồn API Key / Proxy.
*   **Duyệt Fallback thông minh:** Khi model chính gặp sự cố, hệ thống tự động chuyển tiếp qua danh sách các model dự phòng trong chuỗi Fallback đã cấu hình.
*   **Cảnh báo & Đổi Model khi Cạn kiệt:** Chỉ khi toàn bộ danh sách Fallback đều gặp lỗi, hệ thống mới dừng lại và hiển thị Modal cảnh báo lỗi kèm dropdown đề xuất chọn Model mới để tiếp tục tác vụ mà không bị gián đoạn.

### 🌟 CẬP NHẬT MỚI: TỐI ƯU FALLBACK MODEL VÀ CHUẨN HOÁ CƠ CHẾ SINH TỬ (Phiên bản 9.42.0)
*   **Tối ưu Fallback Model:** Cập nhật \`storyStreamService.ts\` để tự động thử nghiệm toàn bộ danh sách Model dự phòng (Fallback Chain) trước khi hiển thị Modal thông báo lỗi cho người dùng.
*   **Chuẩn hoá cơ chế 0 HP:** Thiết lập chốt chặn cơ học tại \`useGameActions.ts\` và \`pendingCombatManager.ts\` để đảm bảo Sinh lực (HP) của nhân vật được giữ nguyên ở mức 0 khi thực hiện hành động Tự sát (Luân hồi), ngăn chặn việc tự động hồi phục về 1 HP.
*   **Linh hoạt hoá cảnh giới NPC:** Sửa đổi \`realmUtils.ts\` để bảo toàn các cảnh giới có nội dung ý nghĩa do AI tạo ra, chỉ ép về cảnh giới cơ bản khi nội dung là vô nghĩa hoặc rác dữ liệu.
*   **Điểm dừng Narrative NSFW:** Củng cố điểm dừng kể chuyện bắt buộc ngay sau khi cao trào kết thúc trong \`intimacyRulesBuilder.ts\`, loại bỏ các miêu tả hậu kỳ không cần thiết.

### 🌟 CẬP NHẬT MỚI: CHẶN TRIỆT ĐỂ AI TỰ Ý BAN TÊN CHO MC (Phiên bản 9.39.0)
*   **Phân định đối tượng Ban Tên:** Cập nhật quy tắc \`NAMING_TASK_RULE\` trong \`prompts/namingTaskRules.ts\` để khẳng định quy tắc ban tên CHỈ áp dụng cho NPC vô danh.
*   **Khóa cứng định danh MC:** Sửa đổi \`formatUserInputBlock\` trong \`services/geminiService.ts\` để nhấn mạnh MC đã có tên cố định, loại bỏ các cụm từ gây nhầm lẫn khiến AI lầm tưởng MC chưa có tên.
*   **Giao thức Reborn nghiêm ngặt:** Tái thiết lập và nâng cấp \`buildHardcoreRebornInstruction\` để ép AI tuyệt đối không được tự ý đổi tên hay tạo tag trích xuất tên mới cho MC vừa luân hồi.

### 🌟 CẬP NHẬT MỚI: TRIỆT ĐỂ LỌC BỎ RICH SUMMARY TIỀN KIẾP (Phiên bản 9.38.0)
*   **Lọc bỏ Flash Agent Log của MC cũ:** Cập nhật bộ lọc \`previousFlashLog\` trong \`services/geminiService.ts\` bắt buộc chỉ lấy log tóm tắt có lượt lớn hơn hoặc bằng mốc Luân hồi (\`reincarnationTurn\`), ngăn chặn tuyệt đối việc nhầm lẫn tiêm \`<richsummary>\` của MC cũ vào lượt MC mới.
*   **Xóa sạch đệm Tóm tắt khi Luân hồi:** Tự động lọc bỏ toàn bộ log loại \`flash_agent\` trong \`ragHistoryLog\` khi chuyển giao MC (\`handleSuccession\`), đảm bảo MC mới không bị dính vết tóm tắt hành vi/thân phận của tiền nhân.

### 🌟 CẬP NHẬT MỚI: TÁCH RỜI KÝ ỨC VÀ CÁCH LY BẢN NGÃ MC (Phiên bản 9.37.0)
*   **Cách ly Ký ức Ngắn hạn:** Tự động reset và xoá bỏ toàn bộ nhật ký lời kể (\`pageLog\`), tóm tắt ngắn hạn (\`pageSummaries\`) và trạng thái (\`FlashState\`) của MC cũ ngay sau khi bấm Luân hồi Tái sinh.
*   **Chống Contamination Context:** Cơ chế lọc thông minh trong \`useMainGameLoop\` đảm bảo AI không nhận được bất kỳ tóm tắt hay lời kể nào của các lượt trước khi luân hồi, giúp MC mới bắt đầu với một "tờ giấy trắng" hoàn toàn.
*   **Cảnh báo Tiền kiếp trong RAG:** Tiêm chỉ dẫn đặc biệt \`[CẢNH BÁO TIỀN KIẾP]\` vào ngữ cảnh RAG để AI hiểu rằng các thông tin về MC cũ chỉ là truyền thuyết/lịch sử thế giới, không phải ký ức của MC hiện tại.

### 🌟 CẬP NHẬT MỚI: ĐỊNH DANH BẢN NGÃ VÀ KÍCH HOẠT TAG EXTRACTION LƯỢT LUÂN HỒI (Phiên bản 9.36.0)
*   **Kích hoạt Tag Extraction & Fast Agent lượt Luân Hồi:** Tự động kích hoạt quy trình trích xuất Tag Extraction và Fast Agent Memory ngay ở lượt sinh lời kể Luân Hồi Tái Sinh để bộ nhớ offline cập nhật liên tục.
*   **Định danh Bản Ngã sau User Input:** Bổ sung dòng định danh ngay sau thẻ \`<user_input>\`: *"Tên nhân vật chính là [tên nhân vật chính gốc] (tên nhân vật nguyên thủy, chưa tiến hành đổi tên qua tag change_name), [tên hiện tại]"*. Sau khi Chung Cực Tử Vong luân hồi, thông tin tên cũ sẽ được tự động xóa bỏ và thay thế hoàn toàn bằng tên MC mới.

### 🌟 CẬP NHẬT MỚI: CHUẨN HOÁ CHỈ DẪN PROMPT TỰ SÁT HÓA ĐẠO (Phiên bản 9.35.0)
*   **Thắt chặt chỉ dẫn AI khi tự sát:** Bổ sung quy tắc bọc thẻ XML chuẩn hóa chỉ dẫn Prompt gửi AI cho kết cục tự sát hóa đạo (\`reincarnate\`).
*   **Ngăn chặn triệt để sinh lại / đổi xác MC:** Nghiêm cấm AI sinh tình tiết cho MC hồi sinh, đổi xác hoặc tiếp tục tồn tại dưới bất kỳ hình thức nào dưới danh nghĩa MC cũ.

### 🌟 CẬP NHẬT MỚI: TỰ ĐỘNG CHUYỂN ĐỔI KÝ TỰ ESCAPED NEWLINE \\n THÀNH XUỐNG DÒNG HỢP LỆ (Phiên bản 9.34.0)
*   **Định dạng nội dung thô gửi/nhận AI:** Tự động chuyển đổi các chuỗi ký tự escape \`\\n\` thành ký tự xuống dòng thực tế trên tất cả các modal xem prompt thô, debug panel và xem preset.
*   **Cải thiện trải nghiệm đọc:** Giúp nội dung prompt, thông tin nhân vật và các chỉ dẫn gửi cho AI hiển thị rõ ràng, trực quan, không còn bị dính chùm dạng ký tự thô.

### 🌟 CẬP NHẬT MỚI: ĐỒNG BỘ QUY TRÌNH CHUNG CỰC TỬ VONG (Phiên bản 9.33.0)
*   **Thống nhất 3 kết cục sinh tử:** Cạn kiệt Thọ Nguyên, Tử vong trong chiến đấu và Tự sát hóa đạo đều quy về chung một quy trình duy nhất mang tên **Chung Cực Tử Vong**.
*   **Đồng bộ giao diện Luân Hồi Tái Sinh:** Toàn bộ mọi kết cục tử vong đều chuyển về khung giao diện Chung Cực Tử Vong trên màn hình chính với nút kích hoạt Luân Hồi Tái Sinh khởi tạo kiếp sống mới.

### 🌟 CẬP NHẬT MỚI: XOÁ BỎ HOÀN TOÀN CƠ CHẾ ĐOẠT XÁ (Phiên bản 9.32.0)
*   **Đơn giản hóa luồng sinh tử:** Loại bỏ hoàn toàn cơ chế Đoạt Xá Trùng Sinh (chiếm hữu thân xác NPC).
*   **Tập trung vào Luân Hồi Tái Sinh:** Giờ đây khi tử vong hoặc tự sát hóa đạo sau thất bại chiến đấu, linh hồn người chơi sẽ luôn chuyển thẳng vào quy trình Luân Hồi Tái Sinh để khởi đầu kiếp sống mới.

### 🌟 CẬP NHẬT MỚI: TỐI ƯU LUỒNG HIỂN THỊ LỜI KỂ ĐOẠT XÁ (Phiên bản 9.31.0)
*   **Bảo vệ Prompt Đoạt Xá:** Khắc phục triệt để sự cố prompt đoạt xá/đổi vai bị ghi đè bởi chuỗi hành động thô. Đảm bảo AI luôn nhận đầy đủ prompt chỉ dẫn hệ thống "[HỆ THỐNG]: ĐOẠT XÁ THÀNH CÔNG!" để miêu tả trọn vẹn diễn biến nhập hồn vào thân xác mới.
*   **Tự động làm sạch và Render Lời Kể:** Đảm bảo nội dung lời kể đoạt xá từ AI luôn được bóc tách và làm sạch khỏi các thẻ XML hệ thống, đồng thời cập nhật tức thì lên giao diện nhật ký câu chuyện.

### 🌟 CẬP NHẬT MỚI: ĐỘNG CƠ TÍNH SÁT THƯƠNG CƠ HỌC THUẦN TÚY (Phiên bản 9.27.0)
*   **Phân công nhiệm vụ rõ ràng:** AI chỉ chịu trách nhiệm diễn giải cốt truyện, miêu tả chiêu thức văn học hào hùng và ra quyết định bạo kích/sượt qua (\`hit_type="crit|normal|glance"\`).
*   **Động cơ cơ học Deterministic:** Giao phó toàn bộ việc tính toán sát thương, trị liệu hồi máu cho Động cơ toán học (TypeScript Engine) đảm nhiệm độc lập. Sát thương thực tế được tính toán chuẩn xác dựa trên ATK kẻ ra chiêu, DEF kẻ chịu đòn, hệ số chiêu thức và chênh lệch đại cảnh giới tu vi thực tế, giúp loại bỏ tình trạng AI "nhẩm sai" hoặc "bốc thuốc số".
*   **Tương thích ngược hoàn hảo:** Tự động đồng bộ với hệ thống thông báo chỉ số hiện tại và giữ nguyên các tag chỉ số thủ công làm dự phòng.

### 🌟 CẬP NHẬT MỚI: KHÓA CỐ ĐỊNH 5 THẺ XML HỆ THỐNG CỐT LÕI (30/07/2026 - 05:40)
*   **Bảo vệ luồng game tối thượng:** 5 thẻ XML quan trọng bao gồm: Cảnh báo hành động ưu tiên (\`<Canh_bao_hanh_dong_No.03>\`), Thông tin MC (\`<Thong_tin_MC_No.04>\`), Nhiệm vụ ưu tiên của AI (\`<Nhiem_vu_AI_No.07>\`), Xử lý tình huống sống còn (\`<Tinh_huong_song_con_No.10>\`), và Lời nhắc người chơi & AI (\`<Loi_nhac_nguoi_choi_No.13>\`) hiện đã được chuyển sang trạng thái **LUÔN HOẠT ĐỘNG** ngầm một cách vô điều kiện.
*   **Tinh gọn giao diện:** Các mục cấu hình cho 5 thẻ này đã được loại bỏ hoàn toàn khỏi bộ cài đặt bộ lọc prompt gốc để người dùng tránh bấm nhầm tắt đi làm phá vỡ logic vận hành của AI.

### 🌟 CẬP NHẬT MỚI: KHẮC PHỤC HIỂN THỊ VÀ TOAST LỖI KHI LUÂN HỒI TÁI SINH (Phiên bản 9.25.0)
*   **Tích hợp màn hình chờ Luân hồi:** Khi chọn "Luân Hồi Tái Sinh" hoặc "Đoạt Xá Trùng Sinh" tại Không Gian Luân Hồi, giao diện tự động khóa các nút và hiển thị trạng thái chờ "Đang giao tiếp với Thiên Đạo..." để người chơi biết hệ thống đang xử lý và tránh thao tác nhấp chuột trùng lặp.
*   **Sửa lỗi crash API do tham chiếu địa điểm:** Sửa triệt để lỗi toast báo "Lỗi API: Cannot read properties of undefined (reading 'find')" phát sinh trong quá trình chuyển kiếp bằng cách thêm cơ chế kiểm tra an toàn (null-safety fallback) cho danh sách địa điểm đã khám phá và tất cả mảng thực thể trong các dịch vụ AI/Prompt Builders.

### 🌟 CẬP NHẬT MỚI: PHÂN TÁCH BÁO CÁO SÁT THƯƠNG THEO TỪNG NGUỒN (Phiên bản 9.24.0)
*   **Chia tách nguồn gây sát thương:** Thay vì dồn dập và gom hết sát thương vào một dòng vô danh rườm rà, giao diện Báo Cáo Tác Động Chỉ Số giờ đây tự động phân tách chi tiết từng nguồn gây sát thương/hồi phục (Tên NPC, Quái Vật, hay Người Chơi) kết hợp tên chiêu thức sử dụng.
*   **Hỗ trợ cú pháp Tag nâng cấp:** Hệ thống tự bóc tách thuộc tính động \`source\` và \`skill\` từ các tag chỉ số chuẩn (\`[HP_CHANGE]\`, \`[MP_CHANGE]\`, \`[STATUS]\`) bất kể thứ tự truyền vào từ AI, đảm bảo hiển thị log trực quan sinh động.
*   **Tương thích ngược hoàn hảo:** Tự động giữ nguyên câu hiển thị mặc định cũ đối với các tag lược giản không truyền nguồn ra chiêu.

### 🌟 CẬP NHẬT MỚI: HỆ THỐNG LOG BIẾN ĐỘNG SINH LỰC (HP) CƠ HỌC (30/07/2026 - 05:25)
*   **Log cơ học chuẩn xác:** Khi Sinh lực (HP) của nhân vật chính biến động từ tag \`[STATS_UPDATE]\`, hệ thống tự động tính toán chính xác lượng HP thay đổi kèm theo tỉ lệ phần trăm dựa trên HP tối đa của MC.
*   **Hiển thị trực quan:** Định dạng log mới hiển thị rõ ràng thông tin dưới dạng \`💚 TênMC: HP_Cũ/HP_TốiĐa ➔ HP_Mới/HP_TốiĐa (Hiệu_Số_HP (Phần_Trăm_Biến_Động))\` trong bảng System Message.

### 🌟 CẬP NHẬT MỚI: TÁI CẤU TRÚC BỘ LỌC PROMPT GỐC TÁCH BIỆT THEO THẺ XML (30/07/2026 - 04:42)
*   **Tách nhỏ từng mục thẻ XML độc lập:** Bỏ hoàn toàn cơ chế gom cụm rườm rà. Tất cả 14 thẻ XML trong System Prompt gốc (\`<Van_phong_ke_chuyen_No.01>\`, \`<Luat_truyen_nguc_tu_No.02>\`, \`<Canh_bao_hanh_dong_No.03>\`, \`<Thong_tin_MC_No.04>\`,...) giờ đây đều được chia tách thành từng mục riêng biệt với công tắc Bật/Tắt độc lập.
*   **Tự động đồng bộ danh sách hệ thống:** Tạo file cấu hình trung tâm \`src/config/promptTagsConfig.ts\` quản lý tập trung toàn bộ danh sách thẻ XML, tự động render giao diện và duy trì tính tương thích ngược với dữ liệu lưu cũ.

### 🌟 CẬP NHẬT MỚI: XỬ LÝ CHUẨN TỰ SÁT THÀNH CÔNG (29/07/2026 - 10:18)
*   **Tự sát thành công = Luân hồi chuyển kiếp:** Khi người chơi lựa chọn Tự Sát sau khi bại trận và may mắn trúng 50% thành công, hệ thống coi như nhân vật đã chết hẳn và kích hoạt ngay lập tức cơ chế **Luân Hồi Chuyển Kiếp** (tạo nhân vật mới hoàn toàn từ đầu, ép buộc AI đổi tên mới bằng thẻ \`[MC_RENAME]\`), thay vì nhầm lẫn sang đoạt xá NPC có sẵn.

### 🌟 CẬP NHẬT MỚI: TÍNH NĂNG TỰ ĐỘNG CHIẾN ĐẤU & BỎ CHẠY TRONG PENDING COMBAT (Phiên bản 9.19.0)
*   **Tự Động Chiến Đấu (Auto Combat):** Hệ thống tự động so khớp lực chiến (HP, Tấn công, Phòng thủ, Cảnh giới) giữa phe ta và phe địch, tính toán xác suất thắng/thua, quyết định thương vong từng NPC, trừ sinh lực thực tế của người chơi và phân chia chiến lợi phẩm (Linh Thạch, EXP).
*   **Bỏ Chạy Khỏi Vòng Vây (Flee Combat):** 100% tháo chạy thành công khỏi vòng vây hiểm nguy, nhưng phải chịu phạt nghiêm khắc: Rớt 1 tiểu cảnh giới tu vi (reset EXP bậc hiện tại về 0), mất 70% ngân lượng Linh thạch, và giảm 50 điểm thiện cảm với toàn bộ NPC tham chiến.
*   **Hộp Thoại Xác Nhận An Toàn:** Tích hợp Modal cảnh báo hậu quả chi tiết trước khi xác nhận bỏ chạy, ngăn ngừa mọi thao tác bấm nhầm.

### 🌟 CẬP NHẬT MỚI: HỆ THỐNG LUÂN HỒI / ĐOẠT XÁ KHỐC LIỆT (29/07/2026 - 10:00)
*   **Cơ chế Tử vong Tích lũy (Death Count):** Tích hợp bộ đếm cơ học số lần tử vong. Khi Nhân Vật Chính (MC) gục ngã quá 2 lần (lần chết thứ 3 trở đi) vì bất kỳ lý do gì (ngoại trừ thọ nguyên cạn kiệt), các cơ chế cứu giúp hay giam giữ bình thường sẽ bị khóa chặt.
*   **Hệ thống Roll Cơ Học 50/50:** Khi tử vong lần thứ 3 trở đi, hệ thống sẽ thực hiện một cú roll 50/50 tự động:
    *   **50% Đoạt Xá NPC:** Linh hồn của bạn đoạt xá thành công một NPC tự do ngẫu nhiên trong thế giới. Toàn bộ tên, tu vi, kỹ năng và chỉ số của bạn sẽ được ghi đè bằng NPC đó, reset số lần tử vong về 0, và NPC đó sẽ bị xóa khỏi danh sách gặp gỡ để tránh trùng lặp.
    *   **50% Không Gian Luân Hồi:** Linh hồn bạn bị cuốn phăng vào Không gian Luân hồi sâu thẳm. Bạn bắt buộc phải Luân Hồi Chuyển Kiếp để tạo một MC mới hoàn toàn từ đầu (với chỉ số tân thủ) và AI bắt buộc phải đặt cho bạn một cái tên mới hoàn chỉnh, độc lập (sử dụng tag \`[MC_RENAME]\`).
    *   **Fallback:** Nếu thế giới không còn bất kỳ NPC tự do nào, hệ thống tự động kích hoạt 100% dòng Luân Hồi Chuyển Kiếp.

### 🌟 CẬP NHẬT MỚI: KHẮC PHỤC LỖI LUÂN HỒI KHI THẤT BẠI TRONG TỰ SÁT (29/07/2026 - 09:36)
*   **Chặn luân hồi/đoạt xá khi thất bại tự sát:** Khi người chơi tự sát thất bại và bị bắt làm tù nhân, hệ thống đảm bảo tuyệt đối không kích hoạt cơ chế đoạt xá (nếu có NPC tự do) hay luân hồi chuyển kiếp (nếu không có NPC tự do). Thân phận người chơi được giữ nguyên là tù nhân, sẵn sàng trải nghiệm các tương tác tù giam.
*   **Đồng bộ dữ liệu và Prompt nghiêm ngặt:** Chuyển chính xác kết quả cụ thể chiến bại (Tù nhân) vào hệ thống prompt AI, cấm tuyệt đối AI tự ý viết lệnh \`[MC_RENAME]\` hoặc miêu tả MC đã vong mạng.

### 🌟 CẬP NHẬT MỚI: ĐỒNG BỘ CƠ HỌC NHIỆM VỤ CỐT TRUYỆN THEO TIMELINE (28/07/2026 - 21:42)
*   **Tự Động Chữa Lành Nhiệm Vụ (Mechanical Quest Healing):** Tích hợp thuật toán tự động nhận diện nhiệm vụ cốt truyện bị thiếu, trống hoặc lệch so với tiến trình thực tế của Timeline. Lấy dòng thời gian làm mốc chuẩn để tự khôi phục, dọn dẹp hoặc nâng mốc phù hợp.
*   **Nút Đồng Bộ Thiên Đạo Trực Tiếp:** Thêm nút bấm "Đồng Bộ" cơ học ngay trong giao diện danh sách nhiệm vụ, cho phép người chơi chủ động sửa lỗi, kích hoạt nhiệm vụ cốt truyện mới khớp chính xác với mốc Timeline hiện tại bất kỳ lúc nào.

### 🌟 CẬP NHẬT MỚI: HỆ THỐNG PHÁT HIỆN & SỬA LỖI TAG AI (28/07/2026 - 21:05)
*   **Phát hiện lỗi cấu trúc Tag:** Tích hợp cơ chế kiểm tra lỗi cú pháp cho tag \`[RELATIONSHIP_UPDATE]\` (ví dụ: AI viết nhầm \`id\` thay vì \`targetId\`).
*   **Thông báo & Sửa lỗi Real-time:** Khi phát hiện lỗi, hệ thống sẽ hiển thị bảng Modal thông báo chi tiết lý do lỗi và cho phép người chơi tự sửa hoặc nhờ AI (Model Economy) tự động sửa lại tag cho đúng.
*   **Khả năng áp dụng liên tục:** Sau khi tag được sửa, hệ thống sẽ lập tức áp dụng biến động vào trạng thái game mà không làm gián đoạn dòng chảy cốt truyện.

### 🌟 CẬP NHẬT MỚI: NGẮN CHẶN TAG MA CHO CÁC SỰ KIỆN QUÁ KHỨ & HỒI ỨC (28/07/2026 - 19:35)
*   **Ngăn chặn Tag "Ma" từ quá khứ:** Cập nhật quy tắc trích xuất của AI Thiên Đạo Sync (Fast Agent), cấm tuyệt đối việc tự động tạo các tag tương tác thời gian thực ([INTERACTION: type="sex"], [BEGIN_COMBAT], [LOCATION_CHANGE], [STATS_UPDATE],...) cho các sự kiện thuộc về quá khứ, hồi ức, giấc mơ, hoặc chiếu lại qua pháp bảo Lưu Ảnh Thạch.
*   **Ràng buộc thời gian thực strict:** Mọi tag tương tác và biến động trạng thái chỉ được phép sinh ra khi hành động thực sự xảy ra trực tiếp trong thời gian thực ở lượt hiện tại.

### 🌟 CẬP NHẬT MỚI: NỚI LỎNG CƠ CHẾ HOÀN THÀNH NHIỆM VỤ CỐT TRUYỆN (28/07/2026 - 10:35)
*   **Ưu tiên Ý chính của Nhiệm vụ:** Cập nhật cơ chế đánh giá của Thiên Đạo Sync, chuyển từ việc bắt bẻ từng chi tiết rườm rà sang tập trung vào mục tiêu cốt lõi. (Ví dụ: Nhiệm vụ "Tham gia thí luyện..." sẽ hoàn thành ngay khi MC tham gia, không bắt buộc phải tàn sát hay đạt mọi tiêu chí phụ).
*   **Hoàn thành hồi tố (Historical Completion):** Hệ thống hiện tại sẽ tự động quét dữ liệu lịch sử (Knowledge Base/Ký ức). Nếu MC đã hoàn thành hành động mục tiêu từ trước khi nhận nhiệm vụ (ví dụ: đã hạ gục boss mục tiêu), nhiệm vụ sẽ được tự động đánh dấu hoàn thành ngay khi vừa được giao để đảm bảo tính logic tuyệt đối của cốt truyện.
*   **Tối ưu hóa phán đoán của Sync Agent:** Nâng cấp AI phụ để nhận diện thông minh hơn các bối cảnh "Tham gia" và "Hạ gục" trong lời kể, giúp trải nghiệm thăng cấp và nhận thưởng mượt mà hơn.
### 🌟 CẬP NHẬT MỚI: ĐỒNG BỘ RAW PROMPT AI & CẢI TIẾN CƠ CHẾ BAN TÊN NPC (28/07/2026 - 10:05)
*   **Chính xác hóa Raw Prompt/Response:** Khắc phục triệt để lỗi lệch lượt khi xem dữ liệu RAG và phản hồi thô của AI. Hệ thống hiện tại luôn hiển thị chính xác nội dung của lượt chơi gần nhất, tự động xóa các lượt lưu cũ để tiết kiệm bộ nhớ.
*   **Bảo toàn quy tắc <ten_ca_nhan>:** Đảm bảo cơ chế tự động ban tên riêng cho NPC luôn hoạt động ngay cả khi người chơi bật "Preset" và tắt các mục prompt gốc. NPC chung chung sẽ luôn được định danh bằng tên riêng chuẩn bối cảnh.
*   **Hồi phục sinh lực khi "Thả Đi":** Bổ sung cơ chế tự động cộng 1 Sinh Lực cho NPC hoặc Yêu Thú khi được thả sau trận chiến, giúp tránh lỗi mất dữ liệu do NPC bị hệ thống xóa vì có 0 HP.
### 🌟 CẬP NHẬT MỚI: TỐI ƯU GIAO DIỆN CHỌN ĐỒNG MINH THAM CHIẾN REAL-TIME (27/07/2026 - 08:30)
*   **Mở rộng giới hạn đội hình đồng minh:** Tăng giới hạn tối đa lên đến **999 Nô Lệ & Tù Binh** được phép tham gia trận chiến real-time cùng lúc.
*   **Bộ lọc danh sách chuẩn chỉ:** Danh sách đồng minh tham chiến loại bỏ hoàn toàn các loại NPC khác, chỉ tập trung hiển thị chính xác các đối tượng là Nô lệ và Tù binh.
*   **Tính năng Chọn/Bỏ chọn nhanh:** Bổ sung nút bấm "Chọn tất cả / Bỏ chọn tất cả" giúp thao tác sắp xếp đội hình nhanh chóng chỉ với một cú chạm.
*   **Thứ tự ưu tiên thông minh:** Khi số lượng đồng minh được chọn vượt quá giới hạn chiến đấu tối đa, hệ thống tự động ưu tiên đưa những NPC từ dưới cùng danh sách vào trận chiến trước.
*   **Mở rộng tính năng Sắp Xếp (Sorting):** Thêm bộ lọc sắp xếp NPC theo **Độ thỏa mãn (Satisfaction)** bên cạnh bộ lọc Thiện cảm và Cảnh giới. Đồng thời, cho phép thay đổi linh hoạt chiều sắp xếp (từ cao xuống thấp hoặc từ thấp lên cao).

### 🌟 CẬP NHẬT MỚI: TỰ ĐỘNG XÓA NPC CẠN THỌ NGUYÊN & KHỞI TẠO LUÂN HỒI CHUYỂN KIẾP (26/07/2026 - 09:40)
*   **Xóa cơ học NPC cạn thọ nguyên khỏi Database:** Khi thọ nguyên của NPC giảm xuống dưới 1 năm (tọa hóa qua đời), hệ thống sẽ lập tức loại bỏ hoàn toàn dữ liệu của NPC đó khỏi danh sách \`discoveredNPCs\` trong database thay vì giữ lại trạng thái "Đã tử vong (Tọa hóa)".
*   **Tự động sinh Nhân Vật Chính mới khi Chuyển Kiếp:** Trong quy trình "Luân Hồi Chuyển Kiếp", nếu toàn bộ NPC trong thế giới đều đã qua đời (không còn NPC nào sống), hệ thống sẽ tự động tạo ra một Nhân Vật Chính hoàn toàn mới mang đầy đủ họ tên Hán Việt, Linh căn, Thể chất đặc biệt và Bối cảnh Tiên Hiệp sinh động để tiếp tục hành trình.

### 🌟 CẬP NHẬT MỚI: TỐI ƯU CƠ CHẾ TỌA HÓA CƠ HỌC & LUÂN HỒI CHUYỂN KIẾP (26/07/2026 - 10:15)
*   **Chấm dứt triệt để lỗi "Bất Tử" khi hết Thọ Nguyên:** Khi Thọ Nguyên của Nhân Vật Chính (MC) cạn kiệt (dưới 1 năm), hệ thống khóa cứng trạng thái tử vong (\`isDead = true\`, Thọ nguyên 0/120, Sinh lực 0/120), ngăn chặn hoàn toàn các tiến trình tự động chuẩn hóa chỉ số (Stat Normalization) tự động reset chỉ số thọ nguyên và sinh lực trở lại đầy đủ.
*   **Khóa Cơ Học Ô Nhập Nội Dung:** Khi nhân vật qua đời, toàn bộ khu vực nhập hành động và các nút Preset bên dưới màn hình Gameplay sẽ bị đóng băng cơ học. Thay vào đó là bảng thông báo Tọa Hóa chuyên biệt với màu sắc cảnh báo rõ ràng.
*   **Nút Gợi Ý Hành Động "Luân Hồi Chuyển Kiếp":** Hệ thống cung cấp nút bấm duy nhất cho phép người chơi kích hoạt dòng chảy "Luân Hồi Chuyển Kiếp" cho lượt chơi tiếp theo. Khi kích hoạt, hệ thống sẽ tự động chọn một NPC còn sống trong thế giới (hoặc tạo nhân vật mới nếu toàn bộ NPC đã quy tiên) để kế thừa danh tính, chỉ số và tiếp bước hành trình tu tiên một cách liền mạch, trọn vẹn và đúng luật tự nhiên.

### 🌟 CẬP NHẬT MỚI: ĐỒNG BỘ SỨC MẠNH NPC CHIẾN ĐẤU TỰ ĐỘNG THEO NỀN THẾ GIỚI (25/07/2026 - 17:35)
*   **Đồng bộ sức mạnh theo nền thế giới:** Khi cốt truyện xuất hiện một nhân vật hoặc kẻ địch mới chưa từng có trong cơ sở dữ liệu game, hệ thống tự động kích hoạt tạo NPC tạm thời (Combat Autogen).
*   **Tham chiếu chuẩn bối cảnh:** Thay vì dùng chỉ số thực tế sau trang bị hoặc chỉ số của riêng người chơi làm mốc, hệ thống giờ đây sử dụng hàm \`calculateRealmBaseStats\` kết hợp với **Cảnh giới nền thế giới** (\`worldRealmBase\`) để làm mốc tham chiếu sức mạnh nguyên bản.
*   **Cân tài cân sức:** Chỉ số gốc này sẽ nhân với một tỉ lệ ngẫu nhiên \`scale = 0.8 + Math.random() * 0.4\` (dao động từ 80% đến 120%), giúp cuộc chiến luôn cân bằng tuyệt đối với bối cảnh chung của thế giới hiện tại, bất chấp chỉ số cá nhân hay trang bị của người chơi.

### 🌟 CẬP NHẬT MỚI: TỰ ĐỘNG CHUYỂN NỀN GAME THEO THỜI GIAN & TỐI ƯU GIAO DIỆN NÚT GỬI (25/07/2026 - 15:45)
*   **Nền Header linh hoạt theo thời gian:**
    *   **Buổi Sáng:** Nền trời xanh mây trắng bồng bềnh trôi nhẹ, kết hợp hiệu ứng lấp lánh rạng rỡ đầy năng lượng.
    *   **Buổi Chiều:** Nền trời hoàng hôn đỏ cam rực rỡ, mây trắng lững lờ trôi kèm hiệu ứng lấp lánh ấm áp.
    *   **Ban Đêm:** Nền trời xanh thẫm đầy sao lung linh nhấp nháy, kết hợp với mây trắng mờ huyền bí.
*   **Tối ưu hóa Bố cục Nút Gửi (Mobile & Desktop):** 
    *   Căn chỉnh lại bố cục Mobile, đưa nút **Gửi Hành Động** xuống một dòng riêng biệt, giúp hoàn toàn giải quyết tình trạng bị che khuất bởi các nút preset truyện dài.
    *   Thêm tính năng tự động rút gọn (truncate) nhãn của các hộp lựa chọn (Dropdown) trên cả giao diện điện thoại và máy tính, giữ cho khung nhập liệu luôn gọn gàng, thanh lịch và dễ thao tác nhất.

### 🌟 CẬP NHẬT MỚI: TỐI ƯU NHỊP ĐỘ ĐẤU GIÁ (24/07/2026 - 15:30)
*   **Rút ngắn thời gian chờ Đấu Giá:** Giảm thời gian chờ giữa các lần ra giá từ 20 giây xuống còn **8 giây** giúp nhịp độ phiên đấu giá nhanh, kịch tính và mượt mà hơn.

### 🌟 CẬP NHẬT MỚI: HỆ THỐNG "TIỀN LƯƠNG", "THỎA MÃN" & "TÙ BINH / NÔ LỆ ĐÀO TẨU" (24/07/2026 - 10:15)
*   **Thang đo Mức độ Thỏa mãn (Satisfaction):** Tích hợp chỉ số tâm lý Thỏa mãn vào thuộc tính cơ bản của tù nhân và nô lệ. Chỉ số này sẽ tự động suy giảm ngẫu nhiên từ 5% đến 15% sau mỗi lượt chơi.
*   **Hành động Phát Lương (Salary Button):** Thêm nút "Tiền Lương" ngay tại thẻ thông tin chi tiết của mỗi tù nhân và nô lệ. Phát lương tiêu tốn Linh thạch bằng 10% kinh nghiệm hiện tại của NPC, giúp tăng ngay 20% mức độ thỏa mãn (tối đa 100%) và 3% thanh kinh nghiệm của NPC (không vượt bình cảnh đại cảnh giới).
*   **Cơ chế Đào tẩu tự động:** Nếu mức độ thỏa mãn tụt dưới 30%, đối tượng đó sẽ rơi vào danh sách có nguy cơ bỏ trốn. Khi chuyển lượt, có 5% tỉ lệ kích hoạt sự kiện hệ thống đào tẩu, đối tượng sẽ tự bẻ khóa cấm chế, xiềng xích và trốn thoát thành công sang danh sách NPC thế giới (với quan hệ "Tù nhân đào tẩu" / "Nô lệ đào tẩu" và giảm 20 điểm thiện cảm).

### 🌟 CẬP NHẬT MỚI: GHI NHẬN & BƠM THÔNG TIN MUA / BÁN VẬT PHẨM & BẢO VẬT ĐẤU GIÁ & CỬA HÀNG (23/07/2026 - 22:20)
*   **Mở rộng sang Vật phẩm & Bảo vật:** Toàn bộ lịch sử mua hoặc bán vật phẩm, bảo vật đấu giá từ cả **Sảnh Đấu Giá Bảo Vật** và **Cửa Hàng Vạn Bảo (Shop)** đều được tích hợp cơ chế ghi nhận chi tiết dưới dạng \`event_summary\` (tự động lưu RAG) tương tự như hệ thống giao dịch Nô Lệ & Tù Binh.
*   **Bơm bối cảnh tự động:** Ở lượt chơi tiếp theo, hệ thống tự động lọc và bơm trực tiếp thông tin giao dịch vật phẩm / bảo vật này vào phân lớp bối cảnh động \`<HệThốngBơmThôngTinGiaoDịchNôLệTùBinh>\` gửi tới AI để AI tái hiện chân thực nhất vật phẩm vừa sở hữu hoặc trao đổi thành công vào lời kể cốt truyện.

### 🌟 CẬP NHẬT MỚI: GHI NHẬN & BƠM THÔNG TIN MUA / BÁN NÔ LỆ VÀ TÙ BINH (23/07/2026 - 19:30)
*   **Ghi nhận toàn bộ giao dịch Mua / Bán:** Toàn bộ lịch sử mua hoặc bán nô lệ, tù binh từ cả **Sảnh Đấu Giá** và **Cửa Hàng (Shop)** đều được hệ thống ghi nhận chi tiết dưới dạng \`event_summary\` (tự động lưu RAG). Các thông tin ghi vết gồm: Số lượt chơi, Ngày tháng năm, Địa điểm giao dịch, Tên nô lệ/tù binh, Giới tính, Mức giá giao dịch/thu về kèm loại tiền tệ, và Trạng thái giao dịch.
*   **Tự động bơm bối cảnh (Memory Injection):** Ở lượt ngay tiếp theo sau khi thực hiện giao dịch mua/bán thành công, hệ thống tự động phân tích và bơm trực tiếp thông tin giao dịch dưới dạng Phân lớp ký ức động (Dynamic Context Layer) vào prompt gửi tới AI để AI nắm bắt và tạo lời kể liền mạch, chân thực nhất.

---

### 🌟 CẬP NHẬT MỚI: CHUẨN HOÁ CẢNH GIỚI NPC BẰNG AI (23/07/2026 - 19:00)
*   **Tự động quét & chuẩn hoá:** Thêm tính năng kích hoạt chuẩn hoá cảnh giới cho NPC, Hậu cung, Tù binh khi phát hiện danh hiệu hoặc cảnh giới chưa khớp hệ thống chuẩn của thế giới.
*   **Mô hình AI Main:** Tính năng luôn gọi đúng mô hình được thiết lập cho **Cốt Truyện Chính (Main)** trong cài đặt API, hiển thị tên mô hình và thời gian xử lý thực tế sau khi hoàn thành.
*   **Quy đổi liên thể loại:** Kể cả khi tên cảnh giới gốc thuộc thể loại khác (Ma pháp Tây phương, Đô thị Level, S/A/B/C...), AI sẽ tự động phân tích cấp độ tương đối và quy đổi thông minh sang mảng Đại/Tiểu cảnh giới chuẩn của thế giới hiện tại.

---

### CẬP NHẬT LỚN: HỆ THỐNG CHIẾN ĐẤU OFFLINE & SỰ KIỆN

### 1. Hệ Thống Combat Client Offline
*   **Chiến đấu thời gian thực:** Chế độ mới hoạt động hoàn toàn trên trình duyệt, không cần chờ AI phản hồi từng lượt. Tốc độ cực nhanh và mượt mà.
*   **Cơ chế:** Dựa trên chỉ số (HP, MP, ATK) thực tế của nhân vật và đối thủ.
*   **AI Kẻ Địch:** NPC và Yêu Thú nay thông minh hơn, biết ưu tiên tấn công đồng minh yếu máu của bạn hoặc tấn công ngẫu nhiên để gây rối loạn.

### 2. Kỹ Năng & Vật Phẩm Chiến Đấu
*   **Linh Lực Bộc Phát:** Mọi kỹ năng tiêu tốn cố định **8% Max MP**. Lượng MP này được chuyển hóa trực tiếp thành sức mạnh cộng thêm cho đòn đánh.
*   **Sử dụng:** Chọn một kỹ năng (có tiền tố \`combat\`) hoặc đan dược, sau đó chọn mục tiêu (Địch hoặc Ta) để thi triển.

### 3. Cơ Chế "Hắc Thiểm" (Black Flash)
*   **Điều kiện:** Khi sinh lực (HP) của **MỤC TIÊU** xuống dưới **80%**.
*   **Kích hoạt:** Mỗi khi tấn công, có tỉ lệ ngẫu nhiên kích hoạt không gian Hắc Thiểm.
*   **Minigame:** Một vòng tròn đỏ sẽ thu nhỏ lại. Hãy căn thật chuẩn và nhấn khi nó khớp với vòng tròn trắng tâm điểm.
*   **Phần thưởng:** Nếu thành công, đòn đánh sẽ gây sát thương chí mạng (Gấp 4-10 lần bình thường tùy vào chuỗi combo)!

### 4. Cơ Chế "Phản Sát" (Counter)
*   **Kích hoạt:** Nút "Phản Sát" màu đỏ sẽ thỉnh thoáng sáng lên và rung động trong trận đấu.
*   **Minigame:** Bắt các điểm sáng xuất hiện nhanh trên màn hình radar trong thời gian giới hạn.
*   **Phần thưởng:** Tạo ra lớp giáp "Phản Sát Hộ Thể", giảm sát thương nhận vào và phản đòn lại kẻ địch dựa trên số điểm bạn bắt được.

### 5. Sự Kiện Thế Giới & Tái Ngộ NPC
*   **Sự Kiện Thế Giới:** Thế giới game giờ đây sống động hơn với các sự kiện ngẫu nhiên: Bí cảnh xuất hiện, Thiên tai, Xung đột phe phái... buộc bạn phải phản ứng.
*   **Tái Ngộ:** Các NPC cũ (Bạn bè, Kẻ thù, Người yêu) sẽ không biến mất mãi mãi. Họ sẽ chủ động tìm gặp lại bạn dựa trên duyên phận và độ thiện cảm, tạo nên những cuộc hội ngộ bất ngờ.
`;

const InitialScreen: React.FC<InitialScreenProps> = ({ setCurrentScreen, openDevInterface }) => {
  const [showUpdateNotesModal, setShowUpdateNotesModal] = useState(false);
  const [updateNotes, setUpdateNotes] = useState<string | null>(null);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [errorNotes, setErrorNotes] = useState<string | null>(null);
  const { onStartDebugCombat } = useGame();

  const [showUserManualModal, setShowUserManualModal] = useState(false);
  const { isApiVerified, checkApiConnection, apiConnectionInfo } = useGame();
  const [isMusicPlaying, setIsMusicPlaying] = useState(true);
  const [isCheckingApi, setIsCheckingApi] = useState(false);
  const [isOriginalSlotModalOpen, setIsOriginalSlotModalOpen] = useState(false);
  const [isGuideOverlayActive, setIsGuideOverlayActive] = useState(false);
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null);
  const [pingErrorMessage, setPingErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (showUserManualModal && isMusicPlaying) {
      audioService.play('/public/background_music10.mp3', true);
    } else {
      audioService.stop();
    }
  }, [showUserManualModal, isMusicPlaying]);

  useEffect(() => {
    // Check music preference
    const musicPref = localStorage.getItem('music_enabled');
    if (musicPref === 'false') {
      setIsMusicPlaying(false);
    } else {
      setIsMusicPlaying(true);
    }
    
    // Stop all background music when on the Homepage
    audioService.stop();

    return () => {
      audioService.stop();
    };
  }, []);

  const toggleMusic = () => {
    const newState = !isMusicPlaying;
    setIsMusicPlaying(newState);
    localStorage.setItem('music_enabled', newState.toString());
    window.dispatchEvent(new Event('music_state_changed'));
    audioService.stop();
  };

  const fetchUpdateNotes = useCallback(async () => {
    setIsLoadingNotes(true);
    setErrorNotes(null);
    
    // Instead of fetching from GitHub, we use the local constant for the requested update info.
    // Simulating a short delay for smooth UI transition.
    setTimeout(() => {
        setUpdateNotes(LOCAL_UPDATE_NOTES);
        setIsLoadingNotes(false);
    }, 300);
    
  }, []);
  
  const handleShowUpdateNotes = () => {
    if (!updateNotes && !errorNotes && !isLoadingNotes) {
      fetchUpdateNotes();
    }
    setShowUpdateNotesModal(true);
  };
  
  const handleShowUserManual = () => {
    setIsGuideOverlayActive(true);
  };

  const handleLoadGameClick = () => {
    setCurrentScreen(GameScreen.LoadGameSelection);
  };

  const handleNewAdventure = async () => {
    setCurrentScreen(GameScreen.GameSetup);
  };

  const handlePingApi = async () => {
    setIsCheckingApi(true);
    setPingErrorMessage(null);
    try {
      await checkConnectionWithAutoReload(
        () => checkApiConnection(true, 'combat'),
        () => {
          setPingErrorMessage(null);
        },
        () => {
          setPingErrorMessage("Có vẻ như đang có lỗi kết nối, yêu cầu reload lại.");
          setIsCheckingApi(false);
          localStorage.removeItem('AUTO_RETRY_CONNECTION');
          localStorage.removeItem('RETRY_COUNT');
        }
      );
    } catch (error) {
      console.error("Manual ping failed", error);
    } finally {
      setIsCheckingApi(false);
    }
  };

  const isAutoRetrying = localStorage.getItem('AUTO_RETRY_CONNECTION') === 'true';

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-[#1a1712] p-6 py-8 text-center relative overflow-x-hidden">
      {/* Guide Overlay */}
      <GuideOverlay 
        isActive={isGuideOverlayActive} 
        onClose={() => {
          setIsGuideOverlayActive(false);
          setActiveGuideId(null);
        }} 
      />

      <div className="w-full max-w-lg p-8 rounded-lg bg-[#2d2820] backdrop-blur-md border-[3px] border-[#a68c68] shadow-[0_0_20px_rgba(0,0,0,0.5)] relative z-[51]">
        {/* Nút "?" nhấp nháy kích hoạt Hướng dẫn trực quan */}
        <GuideToggleButton 
          isActive={isGuideOverlayActive} 
          onClick={() => {
            const nextState = !isGuideOverlayActive;
            setIsGuideOverlayActive(nextState);
            if (!nextState) setActiveGuideId(null);
          }} 
        />
        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-[#e0b578] to-[#997042] mb-6 tracking-wide font-serif">
          {GAME_TITLE}
        </h1>
        <p className="text-lg text-[#dcc9a6]/80 mb-10 font-serif italic">{VIETNAMESE.welcomeMessage(GAME_TITLE)}</p>
        
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-grow relative">
              <Button 
                variant="primary" 
                size="lg" 
                className="w-full bg-[#8e6e44] hover:bg-[#6b5333] text-[#f4e4c1] border border-[#a68c68] shadow-lg"
                onClick={handleNewAdventure}
              >
                {VIETNAMESE.newGame}
              </Button>
              {isGuideOverlayActive && (
                <GuideMarker id="new-adventure" index={1} text="Bấm vào đây để bắt đầu tạo ra cuộc phiêu lưu mới, thiết lập nhân vật và bối cảnh nguyên tác của riêng bạn!" position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
              )}
            </div>
            
            <div className="relative">
              <Button
                variant="ghost"
                size="md"
                className="w-12 h-12 flex items-center justify-center border border-[#a68c68]/30 hover:bg-[#5c4a31]/50 text-[#dcc9a6]"
                onClick={toggleMusic}
                title={isMusicPlaying ? "Tắt nhạc" : "Bật nhạc"}
              >
                {isMusicPlaying ? '■' : '▶'}
              </Button>
              {isGuideOverlayActive && (
                <GuideMarker id="music-toggle" index={2} text="Bật hoặc tắt nhạc nền phong cách cổ phong Tiên Hiệp du dương." position="bottom" activeId={activeGuideId} onToggle={setActiveGuideId} />
              )}
            </div>
          </div>

          <div className="relative">
            <Button 
              variant="secondary" 
              size="lg" 
              className="w-full bg-[#3e3527] hover:bg-[#5c4a31] text-[#dcc9a6] border border-[#a68c68]" 
              onClick={handleLoadGameClick}
            >
              {VIETNAMESE.loadGame}
            </Button>
            {isGuideOverlayActive && (
              <GuideMarker id="load-game" index={3} text="Xem danh sách và tải lại các tiến trình chơi (Save Game) đã được lưu cục bộ hoặc trên đám mây." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
            )}
          </div>

          <div className="relative">
            <Button 
              variant="secondary" 
              size="lg" 
              className="w-full bg-[#2d3b4e] hover:bg-[#3d4f68] text-[#c1d4f4] border border-[#6882a6] flex items-center justify-center gap-2" 
              onClick={() => setCurrentScreen(GameScreen.Chatbot)}
            >
              <MessageSquare size={18} />
              <span>Chatbot Sandbox</span>
            </Button>
            {isGuideOverlayActive && (
              <GuideMarker id="chatbot" index={4} text="Đối thoại tự do với AI (mô hình Main) để thử nghiệm các văn phong, bối cảnh mà không làm ảnh hưởng tới cốt truyện game." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
            )}
          </div>

          <div className="relative">
            <Button 
              variant="ghost" 
              size="md" 
              className="w-full text-[#dcc9a6]/70 hover:text-white" 
              onClick={() => setCurrentScreen(GameScreen.ImportExport)}
            >
              {VIETNAMESE.importExportData}
            </Button>
            {isGuideOverlayActive && (
              <GuideMarker id="data-io" index={5} text="Sao lưu, khôi phục hoặc xuất/nhập file dữ liệu lưu của bạn dưới dạng text/JSON một cách dễ dàng." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
            )}
          </div>

          <div className="w-full py-4 border-y border-[#a68c68]/20 my-4 bg-[#3e3527]/30 rounded-lg relative">
            <button 
              onClick={() => setIsOriginalSlotModalOpen(true)}
              className="w-full flex items-center justify-center gap-3 py-3 bg-gradient-to-r from-[#5c4a31] to-[#3e301d] hover:from-[#6b5333] hover:to-[#4a3a24] text-[#f4e4c1] rounded-md font-bold transition-all shadow-lg active:scale-95 border border-[#a68c68]/20"
            >
              <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }} className="inline-block">
                <Database size={20} />
              </motion.div>
              <span className="text-lg tracking-wide uppercase">KHE CẮM NGUYÊN TÁC</span>
            </button>
            <p className="text-center text-xs text-[#dcc9a6]/50 mt-2">
              (Quản lý dữ liệu & Vector hóa tri thức)
            </p>
            {isGuideOverlayActive && (
              <GuideMarker id="original-work" index={6} text="Tải lên, quản lý dữ liệu bối cảnh tiểu thuyết và tiến hành vector hóa tri thức bồi đắp bối cảnh chính xác cho AI." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-grow relative">
              <Button 
                  variant="ghost" 
                  size="md" 
                  className={`w-full border ${isApiVerified ? 'bg-[#2d4d29]/30 text-[#a3d9a5] border-[#a3d9a5]/30' : 'border-[#a68c68]/30 text-[#dcc9a6]/70'}`} 
                  onClick={() => {
                    setCurrentScreen(GameScreen.ApiSettings);
                  }}
                >
                {VIETNAMESE.apiSettings}
              </Button>
              {isGuideOverlayActive && (
                <GuideMarker id="api-settings" index={7} text="Cấu hình khóa API Gemini của bạn, tùy chỉnh linh hoạt các mô hình cho Cốt truyện chính, Kinh tế và Chiến đấu." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
              )}
            </div>
            
            <div className="relative">
              <Button
                variant="ghost"
                size="md"
                className={`w-12 h-12 flex items-center justify-center border border-[#a68c68]/30 ${isApiVerified ? 'text-[#a3d9a5] border-[#a3d9a5]/30' : 'text-[#dcc9a6]/70'}`}
                onClick={handlePingApi}
                disabled={isCheckingApi}
                title="Kiểm tra kết nối API"
              >
                <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }} className="inline-block">
                  <RefreshCw size={18} className={isCheckingApi || isAutoRetrying ? 'animate-spin' : ''} />
                </motion.div>
              </Button>
              {isGuideOverlayActive && (
                <GuideMarker id="api-ping" index={8} text="Ping kiểm tra nhanh trạng thái kết nối thực tế của khóa API Gemini và Embedding hiện tại." position="bottom" activeId={activeGuideId} onToggle={setActiveGuideId} />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-4">
            <div className="relative">
              <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-xs text-[#dcc9a6]/50 hover:text-[#dcc9a6]" 
                  onClick={handleShowUpdateNotes}
                >
                {VIETNAMESE.updateNotesButton || "Cập Nhật"}
              </Button>
              {isGuideOverlayActive && (
                <GuideMarker id="update-notes" index={9} text="Xem nhật ký chi tiết các tính năng mới, cơ chế cập nhật cơ học và sửa lỗi hệ thống qua từng phiên bản." position="bottom" activeId={activeGuideId} onToggle={setActiveGuideId} />
              )}
            </div>
            
            <div className="relative">
              <Button 
                variant="ghost" 
                size="sm" 
                className={`w-full text-xs ${isGuideOverlayActive ? 'text-yellow-400 font-bold bg-yellow-400/10' : 'text-[#dcc9a6]/50 hover:text-[#dcc9a6]'}`}
                onClick={() => {
                  const nextState = !isGuideOverlayActive;
                  setIsGuideOverlayActive(nextState);
                  if (!nextState) setActiveGuideId(null);
                }}
              >
                {isGuideOverlayActive ? "Tắt Hướng Dẫn" : "Hướng Dẫn"}
              </Button>
              {isGuideOverlayActive && (
                <GuideMarker id="manual" index={10} text="Bạn đang ở chế độ hướng dẫn. Bấm lại vào nút này để tắt lớp phủ hoặc bấm vào nút bên dưới để xem tài liệu chi tiết." position="bottom" activeId={activeGuideId} onToggle={setActiveGuideId}>
                   <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUserManualModal(true);
                    }}
                    className="px-2 py-1 bg-[#a68c68] text-white rounded text-[10px] hover:bg-[#8e6e44] transition-colors"
                   >
                     Mở Tài Liệu Chi Tiết
                   </button>
                </GuideMarker>
              )}
            </div>
          </div>
          
          <div className="relative">
            <Button 
              variant="ghost" 
              size="md" 
              className="w-full text-[#dcc9a6]/30 hover:text-[#dcc9a6] text-xs mt-4" 
              onClick={onStartDebugCombat}
            >
              battle 3.0
            </Button>
            {isGuideOverlayActive && (
              <GuideMarker id="battle" index={11} text="Đấu trường giả lập chiến đấu thời gian thực Offline để thử nghiệm sức mạnh, kỹ năng và đan dược của nhân vật." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
            )}
          </div>
          
          <div className="relative">
            <Button 
              variant="ghost" 
              size="md" 
              className="w-full text-[#dcc9a6]/30 hover:text-[#dcc9a6] text-xs mt-1" 
              onClick={openDevInterface}
            >
              DEV Console
            </Button>
            {isGuideOverlayActive && (
              <GuideMarker id="dev-console" index={12} text="Bảng điều khiển dành cho nhà phát triển để can thiệp chỉ số, theo dõi log RAG và gỡ lỗi hệ thống." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
            )}
          </div>
        </div>
      </div>
      <p className="mt-8 text-xs text-[#dcc9a6]/30 font-serif">Phiên bản {APP_VERSION}</p>

      {pingErrorMessage && (
        <div className="mt-4 px-4 py-3 rounded-lg bg-red-900/40 text-red-300 border border-red-500/50 text-xs sm:text-sm font-medium animate-pulse flex items-center justify-center gap-2 max-w-md mx-auto">
          <span>⚠️</span>
          <span>{pingErrorMessage}</span>
          <button 
            onClick={() => window.location.reload()} 
            className="ml-2 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors font-bold shadow-md"
          >
            Reload Ngay
          </button>
        </div>
      )}

      {apiConnectionInfo && (
        <div className={`mt-4 px-4 py-2 rounded-full text-[10px] sm:text-xs font-medium border transition-all duration-500 flex flex-wrap items-center justify-center gap-x-2 ${
          apiConnectionInfo.success 
            ? 'bg-[#2d4d29]/20 text-[#a3d9a5] border-[#a3d9a5]/30' 
            : 'bg-[#4d2929]/20 text-[#d9a5a5] border-[#d9a5a5]/30'
        }`}>
          <span>{apiConnectionInfo.success ? '✓' : '✗'} {apiConnectionInfo.source} {apiConnectionInfo.success ? 'OK' : 'Fail'}</span>
          <span className="opacity-30">|</span> 
          <span>Gemini: <span className="font-mono text-[#e0b578]">{apiConnectionInfo.model}</span></span>
          
          {apiConnectionInfo.embeddingModel && (
            <>
              <span className="opacity-30">|</span>
              <span>
                Embed: <span className={`font-mono ${apiConnectionInfo.embeddingSuccess ? 'text-sky-400' : 'text-red-400'}`}>
                  {apiConnectionInfo.embeddingModel}
                </span>
                {apiConnectionInfo.embeddingSuccess ? ' ✓' : ' ✗'}
              </span>
            </>
          )}
        </div>
      )}

      {showUpdateNotesModal && (
        <Modal
          isOpen={showUpdateNotesModal}
          onClose={() => setShowUpdateNotesModal(false)}
          title={VIETNAMESE.updateNotesModalTitle || "Thông Tin Cập Nhật Game"}
        >
          {isLoadingNotes && <Spinner text={VIETNAMESE.loadingUpdateNotes || "Đang tải..."} className="my-4" />}
          {errorNotes && <p className="text-red-400 bg-red-900/30 p-3 rounded-md border border-red-600 my-4">{errorNotes}</p>}
          {updateNotes && !isLoadingNotes && !errorNotes && (
            <div 
              className="text-sm text-gray-200 max-h-[60vh] overflow-y-auto custom-scrollbar p-1 bg-gray-800/50 rounded"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(updateNotes) }}
            />
          )}
          {!updateNotes && !isLoadingNotes && !errorNotes && (
            <p className="text-gray-400 italic my-4">{VIETNAMESE.noUpdateNotesAvailable || "Chưa có thông tin cập nhật."}</p>
          )}
        </Modal>
      )}

      {showUserManualModal && (
        <Modal
            isOpen={showUserManualModal}
            onClose={() => setShowUserManualModal(false)}
            title="Hướng Dẫn Sử Dụng"
        >
          <div 
            className="text-sm text-gray-200 max-h-[60vh] overflow-y-auto custom-scrollbar p-2 bg-gray-800/50 rounded"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(USER_MANUAL_TEXT) }}
          />
        </Modal>
      )}

      <OriginalSlotWrapper 
        isOpen={isOriginalSlotModalOpen} 
        onClose={() => setIsOriginalSlotModalOpen(false)} 
        setIsCheckingApi={setIsCheckingApi}
      />
    </div>
  );
};

const OriginalSlotWrapper: React.FC<{ isOpen: boolean; onClose: () => void; setIsCheckingApi: (val: boolean) => void }> = ({ isOpen, onClose, setIsCheckingApi }) => {
    return (
        <OriginalWorkSlot 
            isOpen={isOpen} 
            onClose={onClose} 
            onStartProcessing={() => setIsCheckingApi(true)} 
            onEndProcessing={() => setIsCheckingApi(false)} 
        />
    );
};

export default InitialScreen;
