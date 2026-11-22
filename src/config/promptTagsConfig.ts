export interface PromptXmlSection {
  key: string;
  label: string;
  tag: string;
  desc: string;
}

export const PROMPT_XML_SECTIONS: PromptXmlSection[] = [
  {
    key: 'thinkingProtocol',
    label: 'Quy trình thẩm định & Suy nghĩ',
    tag: '<qui_trinh_tham_dinh>',
    desc: 'Bao gồm các chỉ thị về suy nghĩ sâu, phân tích logic trước khi trả lời.'
  },
  {
    key: 'vanPhong',
    label: 'Văn phong kể chuyện kèm ảnh avatar ',
    tag: '<Van_phong_ke_chuyen_No.01>',
    desc: 'Các lời nhắc ẩn về phong cách từ ngữ, ngôn ngữ truyện.'
  },
  {
    key: 'truyenNgucTu',
    label: 'Luật truyện ngục tù dã man',
    tag: '<Luat_truyen_nguc_tu_No.02>',
    desc: 'Các luật lệ đặc thù của bối cảnh ngục tù khắt khe.'
  },
  {
    key: 'huongDanXungHo',
    label: 'Hướng dẫn xưng hô',
    tag: '<Huong_dan_xung_ho_No.05>',
    desc: 'Quy tắc xưng hô giữa MC, NPC và chủ nhân theo đúng mối quan hệ.'
  },
  {
    key: 'doDai',
    label: 'Điều phối độ dài',
    tag: '<Do_dai_No.06>',
    desc: 'Giới hạn độ dài tối thiểu/tối đa cho nội dung dẫn truyện.'
  },
  {
    key: 'quyTacDiChuyen',
    label: 'Quy tắc di chuyển',
    tag: '<Quy_tac_di_chuyen_No.08>',
    desc: 'Quy tắc vàng về kiểm tra và phát sinh tag di chuyển địa điểm.'
  },
  {
    key: 'coCheChuNhan',
    label: 'Cơ chế chủ nhân & Thân phận',
    tag: '<Co_che_chu_nhan_No.09>',
    desc: 'Phản ứng chỉ số Ý chí, Phục tùng, Phản kháng, Sợ hãi và tâm trạng chủ nhân.'
  },
  {
    key: 'gocNhin',
    label: 'Quy tắc góc nhìn & Ngôi kể',
    tag: '<Goc_nhin_No.11>',
    desc: 'Chỉ thị về góc nhìn thứ nhất hoặc góc nhìn thứ ba toàn tri.'
  }
];
