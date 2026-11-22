export const LSR_DATA = {
    "entries": {
        "6": {
            "comment": "Nhấn mạnh sau cùng (Core Instruction)",
            "content": `<table_rule>
# Lưu ý về thao tác bảng
## Cấu trúc bảng
#0 Thông tin Hiện tại|0:Thời gian|1:Địa điểm
#1 Nhân vật Gần đây|0:Tên nhân vật|1:Số lượt vắng mặt|2:Mục tiêu tức thì|3:Vị trí|4:Tư thế|5:Trạng thái cơ thể|6:Trang phục|7:Trạng thái đặc biệt
#2 Thông tin Nhân vật|0:Tên nhân vật|1:Giới tính|2:Tuổi|3:Thân phận|4:Đặc điểm cơ thể|5:Phong cách trang phục ưa thích|6:Tính cách|7:Sở thích|8:Mục tiêu dài hạn|9:Mối quan hệ|10:Thái độ với <user>|11:Mối quan hệ quan trọng giữa các nhân vật|12:Thiết lập bối cảnh quan trọng|13:Ghi chú quan trọng
#3 Thông tin Tình dục|0:Tên nhân vật|1:Bộ phận cơ thể tương đối nhạy cảm|2:Lần đầu|3:Kỹ năng tình dục thành thạo|4:Chi tiết bộ phận riêng tư|5:Đối tượng tình dục gần đây|6:Ghi chú quan trọng
#4 Lịch trình|0:Tóm tắt|1:Nội dung tổng thể|2:Tiến độ hiện tại|3:Người thực hiện|4:Người ủy thác|5:Phần thưởng hoàn thành|6:Địa điểm|7:Thời gian bắt đầu|8:Thời gian kết thúc hoặc giới hạn|9:Ghi chú quan trọng
#5 Năng lực Đặc biệt|0:Năng lực|1:Người sở hữu|2:Công dụng|3:Hạn chế|4:Ghi chú quan trọng
#6 Vật phẩm Quan trọng|0:Vật phẩm|1:Người sở hữu|2:Vị trí hiện tại|3:Số lượng|4:Hình thái|5:Công dụng|6:Hạn chế|7:Ghi chú quan trọng
#7 Tổ chức Quan trọng|0:Tổ chức|1:Cấu trúc thành viên đã biết|2:Đặc điểm thành viên|3:Mục đích|4:Ghi chú quan trọng
#8 Địa điểm Quan trọng|0:Địa điểm|1:Vị trí|2:Cấu trúc không gian|3:Ghi chú quan trọng
#9 Tổng kết Lớn|0:Phạm vi thời gian|1:Nội dung
#10 Lịch sử Sự kiện|0:Thời gian|1:Địa điểm|2:Sự kiện
#11 Chỉ dẫn Quan trọng|0:Nội dung
</table_rule>`
        }
    }
};

export const LSR_REGEX = [
    {
        "name": "Hide TableStored",
        "regex": /<table_stored>[\s\S]*?(?:<\/table_stored>|$)/gs
    },
    {
        "name": "Hide TableThink",
        "regex": /<tableThink>[\s\S]*?(?:<\/tableThink>|$)/gs
    },
    {
        "name": "Hide TableEdit",
        "regex": /<tableEdit>[\s\S]*?(?:<\/tableEdit>|$)/gs
    },
    {
        "name": "Hide User Input Wrapper",
        "regex": /<user_input>[\s\S]*?(?:<\/user_input>|$)/gs
    },
    {
        "name": "Hide Content Tags",
        "regex": /<\/?content>/g
    }
];
