
export interface YeuThuDataEntry {
    id: string;
    name: string;
    pinyin: string;
    description: string;
    source: string;
}

export const YEU_THU_DATABASE: YeuThuDataEntry[] = [
    {
        id: "SonHaiDiThuChi-[001]",
        name: "Cửu Dư",
        pinyin: "犰狳",
        description: "Tựa như con thỏ mà mỏ chim, mắt cú mèo mà đuôi rắn, thấy người thì giả chết. Các nhà khí tượng cổ đại cho rằng Cửu Dư xuất hiện là dấu hiệu nông trại có châu chấu hại mùa. Cửu Dư có nguyên hình ở trong thực tại, còn được gọi là “Khải thử”, bởi vì cơ thể và hình dạng của nó giống như là một con chuột lớn khoác áo giáp. Cái vỏ trên người Cửu Dư được tạo thành bởi rất nhiều mảnh xương nhỏ, trên mỗi mảnh xương mọc ra một lớp chất sừng, vô cùng cứng rắn. Cho nên, bộ vỏ này đã trở thành vũ khí phòng thân tốt nhất của nó.",
        source: "《Sơn Hải Kinh · Đông Sơn Kinh · Núi Dư Nga》 ghi chép: “Có loài thú, dạng nó như con thỏ mà mỏ chim, mắt cú mèo mà đuôi rắn, thấy người thì ngủ, tên là Cửu Dư 犰狳, tiếng nó tự kêu tên mình, thấy thì châu chấu hại mùa.”"
    },
    {
        id: "SonHaiDiThuChi-[002]",
        name: "Thiên Cẩu",
        pinyin: "天狗",
        description: "Ở trong truyền thuyết Trung Quốc, hiện tượng nguyệt thực được gọi là “Thiên Cẩu ăn mặt trăng”, mọi người hoang mang lo sợ khua chiêng gõ trống bắn pháo để xua đuổi Thiên Cẩu. Loài động vật giống con cáo mà đầu trắng này rất có thể là một loài động vật có vú cổ đại nào đó, đã từng thật sự tồn tại qua.",
        source: "《Sơn Hải Kinh · Tây Sơn Kinh》: “Lại hướng tây 300 dặm là Âm Sơn 陰山. Dòng sông Trọc Dục 濁浴 đi ra, rồi chảy về hướng nam trút vào đầm Phiền 蕃, trong nước nhiều sò vằn. Có loài thú, dạng nó như con cáo mà đầu trắng, tên là Thiên Cẩu, tiếng nó như tiếng “ríu ríu”, có thể ngăn điềm dữ.”"
    },
    {
        id: "SonHaiDiThuChi-[003]",
        name: "Nhân Mã",
        pinyin: "人马",
        description: "“Nhân Mã” thật ra là một loài cá rất thần kỳ. “Nhân Mã” cũng được gọi là “Mã Nhân 马人”, toàn thân được bao phủ bởi mảng lớn vảy, trông rất giống cá chép thế nhưng thân hình lớn hơn. Tuy rằng cơ thể là cá, nhưng khuôn mặt lại rất giống ngũ quan của con người.",
        source: "《Cổ Kim Chú · Ngư Trùng》 của Thôi Báo triều đại nhà Tấn: “Nhân Mã, có vảy giáp, như cá chép lớn, nhưng tay chân tai mắt mũi không khác gì con người. Thấy người một lúc lâu mới vào trong nước.”"
    },
    {
        id: "SonHaiDiThuChi-[004]",
        name: "Nhân Xà",
        pinyin: "人蛇",
        description: "Nhân Xà là một loài dị thú có tay người chân người, nhưng lại là thân rắn đầu rắn. Nhân Xà có chiều cao bảy thước, toàn thân màu xanh sẫm, bởi vì có chân tay, có thể đi đứng thẳng. Nhân xà ưa thích quần cư, cũng ưa thích lập bầy ra ngoài kiếm ăn. Nhân Xà ăn thịt người, bình thường Nhân Xà gặp phải con người sẽ cười to trước, sau đó mới nhanh chóng ăn tươi nuốt sống sạch sẽ. Thế nhưng tốc độ đi của Nhân Xà vô cùng chậm chạp, nếu như con người gặp phải Nhân Xà cười với mình, lập tức quay đầu chạy, Nhân Xà cũng không đuổi kịp con người.",
        source: "《Xà Phổ》 mà Trần Nguyên Long triều Thanh viết: “Nhân Xà 人蛇, dài bảy thước, màu sắc như mực. Đầu rắn, đuôi rắn, thân rắn, đuôi dài khoảng một thước, mà tay người chân người, dài ba thước. Đi đứng như người, ra ngoài thì tập hợp theo bầy, thấy người thì cười cợt, cười chút thôi liền cắn. Nhưng đi rất chậm, nghe nó cười thì chạy ngay mới có thể thoát.”"
    },
    {
        id: "SonHaiDiThuChi-[005]",
        name: "Cửu Nhĩ Khuyển",
        pinyin: "九耳犬",
        description: "Chó săn trong truyền thuyết, có chín lỗ tai. Có thể đoán trước được tình huống thu hoạch của thợ săn trong mỗi lần đi săn. Nếu như lỗ tai của Cửu Nhĩ Khuyển nhúc nhích, thì nói rõ lần này thợ săn ra ngoài sẽ có thu hoạch tốt.",
        source: "《Quảng Đông Tân Ngữ · Thần Ngữ · Lôi Thần》 của Khuất Đại Quân 屈大均 triều Thanh: “Thời Trần, Trần Hồng 陈鉷 người Lôi Châu 雷州 không con, nghề nghiệp săn bắt, nhà có Cửu Nhĩ Khuyển, rất linh. Hễ sắp đi săn, tai chó dự đoán, một tai nhúc nhích thì săn được một con, nhiều thì nhúc nhích ba bốn tai, ít thì một hai tai. Một lần đi săn, mà chín tai đều nhúc nhích, Hồng mừng lớn, cho rằng nhất định sẽ được nhiều thú, một khu có bụi gai, Cửu Nhĩ Khuyển quay chung quanh không đi. Lạ thay, có một trứng lớn, đường kính một thước, mang trở về, giông tố mãnh liệt. Trứng nở, chính là một nam tử, tay có chữ, trái viết Lôi 雷, phải viết Châu 州.”"
    },
    {
        id: "SonHaiDiThuChi-[006]",
        name: "Cửu Vĩ Xà",
        pinyin: "九尾蛇",
        description: "Dị xà trong truyền thuyết, hình thể to lớn, cơ thể có vảy giáp bao phủ, có chín cái đuôi, mỗi một đuôi đều có một cái lổ nhỏ, có khả năng bắn ra vô số đạn không khí, bị bắn trúng không chết cũng tàn phế.",
        source: "《Tục Tử Bất Ngữ · Cửu Vĩ Xà》do Viên Mai triều Thanh viết: “Có kẻ tên Mao Bát 茅八, thời trẻ từng buôn giấy vào Giang Tây 江西. Núi sâu nhiều xưởng giấy, người trong xưởng lưu lại liền chốt cửa, dè chừng không nên đi nơi khác, rằng trong núi nhiều dị vật, không chỉ có hổ sói, một tối trăng rất sáng, Mao không ngủ được, muốn mở cửa ra ngoài ngắm trăng, co ro bốn lần, ỷ vào võ dũng vẫn còn có thể chịu đựng được, bèn mở cửa ra ngoài. Đi chưa được mấy chục bước, chợt thấy bầy khỉ mấy chục con, khóc lóc chạy đến, chọn một cây lớn leo lên, Mao cũng nhìn lén từ xa. Không bao lâu liền trông thấy một con rắn, từ trong rừng đi ra, cơ thể như cột vòm, hai mắt sáng quắc, bộ da đều như vẩy cá mà cứng, từ eo trở xuống có chín đuôi, kéo nhau mà đi, có tiếng như thiết giáp. Song đến dưới cây, nó bèn dựng đuôi, xoay tròn thành điệu múa. Mỗi đuôi có một lỗ nhỏ, bên trong lỗ tiết ra nước dãi như đạn bắn lên cây. Bên trong bầy khỉ, có con kêu gào rơi xuống đất, bụng nứt ra mà chết. Bèn từ từ ăn ba con khỉ, kéo đuôi mà đi. Mao sợ, quay về, tất nhiên là đêm tối không dám ra ngoài.”"
    },
    {
        id: "SonHaiDiThuChi-[007]",
        name: "Tam Giác Thú",
        pinyin: "三角兽",
        description: "Tam Giác Thú đại biểu cho sự may mắn, các đế vương gia thời cổ đại thường hay vẽ hình tượng Tam Giác Thú lên cờ xí dùng cho hoạt động lễ nghi. Nếu như một người nào đó từ nhỏ có khí chất đế vương, cũng có khả năng sẽ hấp dẫn Tam Giác Thú. Trên đầu Tam Giác Thú mọc ba cái sừng, trên chân có ngọn lửa, bộ lông có màu xanh lục.",
        source: ""
    },
    {
        id: "SonHaiDiThuChi-[008]",
        name: "Đan Ngư",
        pinyin: "丹鱼",
        description: "Thần ngư trong truyền thuyết, khắp toàn thân từ trên xuống dưới được bao bọc bởi ánh hào quang chói mắt, nghe nói bôi máu của Đan Ngư lên chân có thể đi đứng được ở trên mặt nước. Truyền thuyết Đan Ngư bắt đầu sớm nhất ở Bắc Nguỵ, là vật điềm lành. Truyền thuyết kể rằng nhìn thấy Đan Ngư thì sẽ gặp chuyện tốt, thế nhưng xác suất nhìn thấy thần ngư lại là nhỏ càng thêm nhỏ.",
        source: "《Thủy kinh chú · Đan thủy》 của Lệ Đạo Nguyên thời Bắc Ngụy có miêu tả Đan Ngư: “Sông Đan Thủy 丹水 sinh ra Đan Ngư 丹鱼. Trước Hạ Chí mười ngày, chờ đợi ở Sông Đan Thủy vào ban đêm, cá bơi lội bên hông, trên vầng sáng đỏ chiếu sáng như lửa. Lấy lưới đánh bắt, cắt máu nó để bôi chân, có thể đi bộ trên nước. Cư trú lâu dài ở vùng nước sâu.”"
    },
    {
        id: "SonHaiDiThuChi-[009]",
        name: "Bạch Viên",
        pinyin: "白猿",
        description: "Bạch Viên là một loài dị thú có ngoại hình rất giống con khỉ, tay chân rất dài, giỏi leo trèo, tiếng kêu cực kỳ thê thảm. Bạch Viên ở cổ đại được cho là hầu đã trải qua nhiều năm phát triển biến hoá mà thành, tượng trưng trường thọ nhiều phúc.",
        source: "《Sơn Hải Kinh · Nam Sơn Kinh》: “Núi Đường Đình 堂庭, có nhiều Bạch Viên 白猿.”"
    },
    {
        id: "SonHaiDiThuChi-[010]",
        name: "Lộc Thục",
        pinyin: "鹿蜀",
        description: "Lộc Thục là một loài thần thú cổ đại, dáng vẻ giống như ngựa, đầu màu trắng, đuôi màu đỏ, thân mình đầy vằn hổ, kêu lên giống như con người đang hát. Truyền thuyết kể rằng mặc da lông của Lộc Thục ở trên người mình thì có thể khiến cho con cháu gia tộc hưng thịnh, ở thời Sùng Trinh nhà Minh, trên phố loan truyền rằng có người từng thấy qua Lộc Thục.",
        source: "《Sơn Hải Kinh · Nam Sơn Kinh》: “Núi Nữu Dương 杻陽, có loài thú, dạng nó như con ngựa mà đầu trắng, vằn nó như con hổ mà đuôi màu đỏ, tiếng kêu như tiếng hát, tên nó là Lộc Thục 鹿蜀, mang vào thì hòa hợp con cháu.”"
    },
    {
        id: "SonHaiDiThuChi-[011]",
        name: "Toàn Quy",
        pinyin: "旋龟",
        description: "Toàn Quy là một loại dị thú đầu chim, cơ thể giống rùa đen, đuôi giống rắn độc. Âm thanh khi Toàn Quy kêu lên rất giống tiếng gõ vào gỗ, người ta mang theo Toàn Quy ở trên người, có thể ngăn cản ù tai, tăng cường thính lực, còn có thể trị vết chai chân. Từng cùng Hoàng Long hiệp trợ Đại Vũ sửa trị lũ lụt.",
        source: "《Sơn Hải Kinh · Nam Sơn Kinh》: “Núi Nữu Dương 杻陽, có dòng nước lạ chảy ra, mà chảy về đông trút vào nước sông Hiến Dực 憲翼, trong nước nhiều loài cá rùa đen tuyền, dạng nó như con rùa mà đầu chim đuôi rắn ‘Hủy’ 虺 (một loại rắn độc), tên nó là Toàn Quy 旋龟, tiếng của nó như gõ vào cây, mang vào thì không điếc, có thể dùng làm bệ nền.”"
    },
    {
        id: "SonHaiDiThuChi-[012]",
        name: "Lục",
        pinyin: "鯥",
        description: "Lục, là một loài quái ngư ở giữa ranh giới sinh tử. Thường ngủ đông vào mùa đông, chỉ ra ngoài hoạt động vào mùa hè, cho nên mọi người xem Lục như là biểu tượng cho sự khởi tử hoàn sinh, sau khi ăn nó có thể trị bệnh u bướu.",
        source: "《Sơn Hải Kinh · Nam Sơn Kinh》: “Để Sơn 柢山, nhiều nước, không cỏ cây. Có loài cá, dạng nó như con trâu, sống ở gò đất, đuôi rắn mà có cánh, đuôi nó ở tại dưới lườn[2], tiếng kêu như con trâu ‘lưu’ 留牛 (không biết loại trâu gì), tên nó là Lục 鯥, chết đi rồi sống lại, ăn vào thì không bị bệnh u bướu.”"
    },
    {
        id: "SonHaiDiThuChi-[013]",
        name: "Loại",
        pinyin: "类",
        description: "Loại còn được gọi là Lệnh Hồ, dáng vẻ giống mèo rừng, đầu có lông dài, là một loài kỳ thú lưỡng tính. Người ăn qua thịt Loại sẽ không còn lòng ganh tỵ nữa.",
        source: "《Sơn Hải Kinh · Nam Sơn Kinh》: “Núi Đản Viên 亶爰, có loài thú, dạng nó như con mèo rừng mà có lông mao, tên nó là Loại 类, tự làm con đực con cái, ăn vào thì không ganh ghét.”"
    },
    {
        id: "SonHaiDiThuChi-[014]",
        name: "Chuyên Dã",
        pinyin: "猼訑",
        description: "Chuyên Dã là một loài quái thú, dáng vẻ nó như một con sơn dương, thế nhưng có chín cái đuôi và bốn cái lỗ tai, con mắt của Chuyên Dã mọc ở trên lưng. Nghe nói con người lấy được da lông của nó khoác lên người, thì sẽ không còn lòng sợ hãi nữa.",
        source: "《Sơn Hải Kinh · Nam Sơn Kinh》 có ghi chép về Chuyên Dã: “Cơ Sơn 基山, có loài thú, dạng nó như con dê, chín đuôi, bốn tai, mắt nó ở lưng, tên nó là Chuyên Dã 猼訑, mang vào thì không sợ sệt.”"
    },
    {
        id: "SonHaiDiThuChi-[015]",
        name: "Quán Quán",
        pinyin: "灌灌",
        description: "Quán Quán là một loài chim may mắn, dáng vẻ như chim cưu, kêu lên rất giống tiếng người ngáy ngủ. Truyền thuyết kể rằng đeo lông vũ của Quán Quán ở trên người, có khả năng không bị mê hoặc.",
        source: "《Sơn Hải Kinh · Nam Sơn Kinh》: “Núi Thanh Khâu 青丘, có loài chim, dạng nó như chim cưu (một loại chim họ bồ câu), tiếng nó giống kêu a, tên là Quán Quán 灌灌, mang vào thì không mê hoặc.”"
    },
    {
        id: "SonHaiDiThuChi-[016]",
        name: "Cổ Điêu",
        pinyin: "蛊雕",
        description: "Cổ Điêu còn được gọi là Soán Điêu, là một loài quái thú như chim mà không phải chim. Dáng vẻ của nó giống chim đại bàng, trên đầu có sừng. Kêu lên giống như trẻ sơ sinh đang khóc, và ăn thịt người.",
        source: "《Sơn Hải Kinh · Nam Kinh thứ hai》 có ghi chép về Cổ Điêu: “Núi Lộc Ngô 鹿吳, nước sông Trạch Canh 澤更 đi ra, rồi chảy về hướng nam trút vào Bàng Thủy. Có loài thú, tên là Cổ Điêu 蛊雕, dạng nó như chim đại bàng mà có sừng, tiếng nó như tiếng kêu của trẻ sơ sinh, ăn thịt người.”"
    },
    {
        id: "SonHaiDiThuChi-[017]",
        name: "Tê",
        pinyin: "犀",
        description: "Tê rất giống trâu nước, chân và bàn chân giống voi lớn, đầu giống con heo, trên đầu mọc ba cái sừng, lần lượt là ở trên đỉnh đầu, cái trán và cái mũi. Trong miệng thường xuyên khạc ra bọt máu. Sừng Tê có khả năng giải độc.",
        source: "《Sơn Hải Kinh · Nam Kinh thứ ba》 có ghi chép về Tê: “Hướng đông 500 dặm là hòn núi Đảo Quá 祷过, trên đó nhiều vàng ngọc, ở dưới nhiều loài tê hủy (tê giác) 犀兕, lắm voi.”"
    },
    {
        id: "SonHaiDiThuChi-[018]",
        name: "Li Lực",
        pinyin: "狸力",
        description: "Li Lực là một loài kỳ thú, dáng vẻ của nó giống như con heo, chân gà, kêu lên giống như tiếng chó sủa. Li Lực tượng trưng cho công trình xây dựng phồn vinh, chỉ cần là nơi Li Lực xuất hiện, nhất định là đang xây dựng rầm rộ.",
        source: "《Sơn Hải Kinh · Nam Kinh thứ hai》: “Cử Sơn 柜山, có loài thú, dạng như con heo sữa, có cựa, tiếng nó như chó sủa, tên nó là Li Lực 狸力, thấy được thì huyện đó nhiều công trình.”"
    },
    {
        id: "SonHaiDiThuChi-[019]",
        name: "Hủy",
        pinyin: "兕",
        description: "Tướng mạo của Hủy rất giống một con trâu, thân thể màu xám đen, trên đầu mọc một cái sừng. Hủy còn được gọi là Độc Giác Thú, tượng trưng cho văn đức. Tương truyền Hủy không cắn người và thích nghe tiếng suối chảy.",
        source: "《Sơn Hải Kinh · Nam Kinh thứ ba》 có ghi chép về Hủy: “Hướng đông 500 dặm là hòn núi Đảo Quá 祷过, trên đó nhiều vàng ngọc, ở dưới nhiều loài tê hủy (tê giác) 犀兕, lắm voi.”"
    },
    {
        id: "SonHaiDiThuChi-[020]",
        name: "Hổ Giao",
        pinyin: "虎蛟",
        description: "Hổ Giao là quái giao không phải cá không phải rắn sống trong nước, có thân cá đuôi rắn. Tiếng kêu của Hổ Giao giống như chim uyên ương, ăn được thịt của Hổ Giao có thể phòng ngừa bệnh u bướu, mà còn thể trị các loại vết thương lở loét.",
        source: "《Sơn Hải Kinh · Nam Kinh thứ ba》: “Núi Đảo Quá 祷过, sông Ngân Thủy 泿水 đi ra, rồi chảy về hướng nam trút vào biển. Trong đó có con Hổ Giao 虎蛟, dạng nó thân cá mà đuôi rắn, tiếng nó như chim uyên ương, ăn vào thì không bị u bướu, có thể khỏi bệnh trĩ (loại bệnh loét nhọt ở hậu môn).”"
    },
    {
        id: "SonHaiDiThuChi-[021]",
        name: "Phượng Hoàng",
        pinyin: "凤皇",
        description: "Phượng Hoàng là vua của muôn chim, cùng Lân, Quy, Long gọi chung là tứ linh. Phượng Hoàng là Chu Điểu của phương nam, tượng trưng cho đức hạnh và điềm lành. Trên người có các vằn chữ “đức”, “nghĩa”, “lễ”, “nhân”, “tín”. Thấy được thì thiên hạ yên ổn.",
        source: "《Sơn Hải Kinh · Nam Kinh thứ ba》: “Núi Đan Huyệt 丹穴, có loài chim, dạng nó như con gà, năm màu mà có vằn, tên là Phượng Hoàng 凤皇, vằn ở đầu là chữ “đức” 德, vằn ở cánh là chữ “nghĩa” 义, vằn ở lưng là chữ “lễ” 礼, vằn ở ngực là chữ “nhân” 仁, vằn ở bụng là chữ “tín” 信. Đó là giống chim ăn uống tự nhiên, tự ca tự múa, thấy được thì thiên hạ yên ổn.”"
    },
    {
        id: "SonHaiDiThuChi-[022]",
        name: "Chuyên Ngư",
        pinyin: "鱄鱼",
        description: "Chuyên Ngư là một loài quái ngư, dạng như cá diếc mà đuôi lợn, tiếng nó như heo sữa. Truyền thuyết kể rằng Chuyên Ngư là điềm báo thiên hạ đại hạn, song song đó Chuyên Ngư còn là mỹ vị hiếm có thế gian.",
        source: "《Sơn Hải Kinh · Nam Kinh thứ ba》: “Kê Sơn, sông Hắc Thủy 黑水 đi ra, rồi chảy về hướng nam trút vào biển. Trong đó có nhiều Chuyên Ngư 鱄鱼, dạng nó như cá diếc mà đuôi lợn, tiếng nó như heo sữa, thấy được thì thiên hạ đại hạn.”"
    },
    {
        id: "SonHaiDiThuChi-[023]",
        name: "Ngung",
        pinyin: "颙",
        description: "Ngung là một loài quái điểu mặt người thân cú, bốn mắt có tai. Giống như Chuyên Ngư, cũng là điềm báo đại hạn.",
        source: "《Sơn Hải Kinh · Nam Kinh thứ ba》: “Núi Lệnh Khâu 令丘, có loài chim, dạng nó như chim cú, mặt người, bốn mắt mà có tai, tên nó là ngung 颙, tiếng nó tự kêu tên mình, thấy được thì thiên hạ đại hạn."
    },
    {
        id: "SonHaiDiThuChi-[024]",
        name: "Hàm Dương",
        pinyin: "羬羊",
        description: "Hàm Dương là một loài quái thú, dáng vẻ giống như con dê, thế nhưng có cái đuôi ngựa, mỡ của loài dê này có thể trị khỏi bệnh tật về da cho con người.",
        source: "《Sơn Hải Kinh · Tây Sơn Kinh》: “Núi Tiền Lai 钱来, có loài thú, dạng nó như con dê mà đuôi ngựa, tên là Hàm Dương 羬羊, mỡ của nó có thể trị khỏi da khô.”"
    },
    {
        id: "SonHaiDiThuChi-[025]",
        name: "Đồng Cừ",
        pinyin: "䳋渠",
        description: "Đồng Cừ là một loài kỳ điểu có thể tránh né thiên tai, dáng nó giống như chim núi, có lông vũ màu đen và chân màu đỏ, có thể dùng để trị các loại bệnh về da.",
        source: "《Sơn Hải Kinh · Tây Sơn Kinh》: “Núi Tùng Quả 松果, có loài chim, tên nó là Đồng Cừ 䳋渠, dạng nó như con chim trĩ, thân đen chân đỏ, có thể chữa khỏi nứt da.”"
    },
    {
        id: "SonHaiDiThuChi-[026]",
        name: "Phì Di (Xà)",
        pinyin: "肥遗蛇",
        description: "Còn được gọi là Phì Di Xà, là một con độc xà có sáu chân và bốn cánh, Phì Di Xà hiện thân tức thiên hạ đại hạn.",
        source: "《Sơn Hải Kinh · Tây Sơn Kinh》: “Núi Thái Hoa 太华, gọt thành bốn phương, nó cao 5000 nhận (1 nhận bằng 8 thước, chừng sáu thước bốn tấc tám phân bây giờ), nó rộng 10 dặm, chim thú tuyệt chẳng sinh sống. Có loài rắn, tên là Phì Di 肥遗, sáu chân bốn cánh, thấy thì thiên hạ đại hạn.”"
    },
    {
        id: "SonHaiDiThuChi-[027]",
        name: "Phì Di (Điểu)",
        pinyin: "肥遗鸟",
        description: "Phì Di Điểu là một loài chim có ích, có thể chữa khỏi bệnh tật, còn có thể giết chết sâu bọ có hại. Vẻ ngoài của Phì Di Điểu rất giống chim cút, lông vũ khắp người có màu vàng, mỏ đỏ.",
        source: "《Sơn Hải Kinh · Tây Sơn Kinh》: “Anh Sơn 英山, có loài chim, dạng nó như chim cút, thân vàng mà mỏ đỏ, tên nó là Phì Di 肥遗, ăn vào khỏi hủi độc, có thể giết sâu bọ.”"
    },
    {
        id: "SonHaiDiThuChi-[028]",
        name: "Thông Lung",
        pinyin: "葱聋",
        description: "Thông Lung là một loài kỳ dương, dạng nó như con dê mà bờm đỏ, đầu màu đen.",
        source: "《Sơn Hải Kinh · Tây Sơn Kinh》: “Núi Phù Ngu 符禺, thú ở đó nhiều loài Thông Lung 葱聋, dạng nó như con dê mà bờm đỏ.”"
    },
    {
        id: "SonHaiDiThuChi-[029]",
        name: "Mân",
        pinyin: "鴖",
        description: "Mân là loài chim chống lửa, dáng vẻ như chim phỉ thúy, mỏ có màu đỏ. Là con vật phòng chống hoả hoạn.",
        source: "《Sơn Hải Kinh · Tây Sơn Kinh》 có ghi chép về Mân: “Núi Phù Ngu 符禺, chim ở đó nhiều loài Mân 鴖, dạng nó như chim phỉ thúy mà mỏ đỏ, có thể chống lửa.”"
    },
    {
        id: "SonHaiDiThuChi-[030]",
        name: "Quặc Như",
        pinyin: "玃如",
        description: "Quặc Như là một loài quái thú dạng như con hươu mà đuôi trắng, móng ngựa tay người mà bốn sừng.",
        source: "《Sơn Hải Kinh · Tây Sơn Kinh》: “Núi Cao Đồ 皋涂, có loài thú, dạng nó như con hươu mà đuôi trắng, móng ngựa tay người mà bốn sừng, tên là Quặc Như 玃如. “"
    },
    {
        id: "SonHaiDiThuChi-[031]",
        name: "Điệp",
        pinyin: "鸓",
        description: "Điệp là một loài kỳ điểu có hai đầu, dáng vẻ của nó giống như chim hỉ thước, lông vũ màu đỏ đen, một thân, hai đầu và bốn chân. Điệp là loài chim điềm lành trong truyền thuyết thời cổ, có thể trừ lửa.",
        source: "《Sơn Hải Kinh · Tây Sơn Kinh》: “Thúy Sơn 翠山, chim ở đó nhiều loài Điệp 鸓, dạng nó như chim hỉ thước, màu đỏ đen mà hai đầu bốn chân, có thể chống lửa.”"
    },
    {
        id: "SonHaiDiThuChi-[032]",
        name: "Du Sơn Thần",
        pinyin: "羭山神",
        description: "Du Sơn Thần là Sơn Thần của tổng cộng 19 ngọn núi từ núi Tiền Lai đến Quy Sơn, ngoại hình giống như một con dê.",
        source: "《Sơn Hải Kinh · Tây Sơn Kinh》: “Từ núi Tiền Lai đến Quy Sơn, gồm 19 ngọn núi, Du Sơn Thần 羭山神 cũng vậy.”"
    },
    {
        id: "SonHaiDiThuChi-[033]",
        name: "Phù Hề",
        pinyin: "凫徯",
        description: "Phù Hề là quái điểu mặt người thân gà trống. Trong truyền thuyết Phù Hề là điềm báo chiến loạn, Phù Hề hiện thân tức quốc gia binh lửa giao chiến.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ hai》: “Núi Lộc Đài 鹿台, có loài chim, dạng nó như gà trống mà mặt người, tên là Phù Hề 凫徯, tiếng nó tự kêu tên mình, gặp thì có chiến tranh.”"
    },
    {
        id: "SonHaiDiThuChi-[034]",
        name: "Chu Yếm",
        pinyin: "朱厌",
        description: "Chu Yếm thuộc về loài viên hầu, lông ở đầu thì là màu trắng, ở chân thì lại là màu đỏ, Chu Yếm cũng giống như Phù Hề đều là tượng trưng cho tai hoạ chiến tranh.",
        source: ""
    },
    {
        id: "SonHaiDiThuChi-[035]",
        name: "Nhân Diện Mã Thân Thần",
        pinyin: "人面马身神",
        description: "Sơn Thần của 10 ngọn núi, có cơ thể là ngựa, nhưng đầu lại là một khuôn mặt người. Còn được gọi là Thập Bối Thần hoặc Tây Sơn Thập Thần.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ hai》: “Từ Kiềm Sơn đến Lai Sơn, gồm 17 ngọn núi, mười vị thần của nó, đều là mặt người mà thân ngựa.”"
    },
    {
        id: "SonHaiDiThuChi-[036]",
        name: "Nhân Diện Ngưu Thân Thần",
        pinyin: "人面牛身神",
        description: "Sơn Thần của 7 ngọn núi, có thân trâu, mặt người, bốn chân một tay, cầm trượng mà đi, tốc độ đi rất nhanh nên còn được gọi là vị thần thú bay.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ hai》 ghi chép: “Từ Kiềm Sơn đến Lai Sơn, gồm 17 ngọn núi… bảy  vị thần của nó đều là mặt người mà thân trâu, bốn chân mà một tay, cầm trượng mà đi, là vị thần thú bay.”"
    },
    {
        id: "SonHaiDiThuChi-[037]",
        name: "Cử Phụ",
        pinyin: "举父",
        description: "Cử Phụ cũng gọi là Khoa Phụ, hình dáng giống như con khỉ mà tay có vằn, đuôi báo mà hay ném. Có thể nâng đá ném người.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ ba》: “Núi Sùng Ngô 崇吾, có loài thú, dạng nó như con khỉ mà tay có vằn, đuôi báo (hổ) mà hay ném, tên là  Cử Phụ.”"
    },
    {
        id: "SonHaiDiThuChi-[038]",
        name: "Long Thân Nhân Diện Thú",
        pinyin: "龙身人面兽",
        description: "Long Thân Nhân Diện Thú là Sơn Thần của 14 ngọn núi, có cơ thể của con rồng và khuôn mặt của con người.",
        source: "《Sơn Hải Kinh ・ Nam Kinh thứ ba》: “Từ núi Thiên Ngu đến núi Nam Ngu, gồm 14 ngọn núi, thần ở đó đều là thân rồng mà mặt người.”"
    },
    {
        id: "SonHaiDiThuChi-[039]",
        name: "Bi",
        pinyin: "罴",
        description: "Bi có ngoại hình rất giống con gấu, toàn thân được bao phủ bởi hoa văn vàng bạc đan xen, có thể một mình nhổ lên một cây đại thụ. Từng trợ giúp Hoàng Đế đại chiến Viêm Đế.",
        source: "《Sơn Hải Kinh · Tây Sơn Kinh》: “Núi Ba Trủng 嶓冢, thú có nhiều loài Tê Hủy Hùng Bi 犀兕熊罴.”"
    },
    {
        id: "SonHaiDiThuChi-[040]",
        name: "Khê Biên",
        pinyin: "谿边",
        description: "Khê Biên là một loài kỳ thú có ngoại hình giống con chó, nghe nói da của nó dùng làm chiếu có thể ngừa sâu độc.",
        source: "《Sơn Hải Kinh · Tây Sơn Kinh》: “Núi Thiên Đế 天帝, có loài thú, dạng nó như con chó, tên là Khê Biên 谿边, ngồi trên da của nó thì không bị ngải độc.”"
    },
    {
        id: "SonHaiDiThuChi-[041]",
        name: "Sổ Tư",
        pinyin: "数斯",
        description: "Sổ Tư là một loài kỳ điểu, dáng vẻ giống chim cú, nhưng lại có một đôi chân người. Ăn thịt của Sổ Tư có thể trị bệnh động kinh.",
        source: "《Sơn Hải Kinh · Tây Sơn Kinh》: “Núi Cao Đồ 皋涂, có loài chim, dạng nó như chim cú mà chân người, tên là Sổ Tư 数斯, ăn vào khỏi u bướu.”"
    },
    {
        id: "SonHaiDiThuChi-[042]",
        name: "Man Man",
        pinyin: "蛮蛮",
        description: "Man Man cũng gọi là Bỉ Dực Điểu, một loài chim tượng trưng cho sự may mắn và sát cánh cùng bay. Man Man có một cánh và một mắt, cần trống mái kết hợp lại sau đó mới có thể bay lượn trên trời. Tuy nhiên, gặp nó cũng có thể là điềm báo thiên hạ đại hồng thủy.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ ba》: “Núi Sùng Ngô 崇吾, có loài chim, dạng nó như vịt trời, mà một cánh một mắt, hợp ý nhau bèn bay, tên là Man Man 蛮蛮, gặp thì thiên hạ đại hồng thủy.”"
    },
    {
        id: "SonHaiDiThuChi-[043]",
        name: "Cổ",
        pinyin: "鼓",
        description: "Cổ là con của Sơn Thần Chung Sơn Chúc Âm, mặt người thân rồng. Từng cùng một vị thần khác giết chết thần Bảo Giang ở núi Côn Luân nên bị Hoàng Đế xử tử.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ ba》 có ghi chép về Cổ: “Chung Sơn, con nó là Cổ 鼓, dạng nó như mặt người mà thân rồng, cùng Khâm Phi 钦䲹 giết Bảo Giang ở sườn núi phía nam Côn Luân, vua bèn giết chúng ở núi Dao Nhai 瑶崖 phía đông Chung Sơn.”"
    },
    {
        id: "SonHaiDiThuChi-[044]",
        name: "Văn Diêu Ngư",
        pinyin: "文鳐鱼",
        description: "Văn Diêu Ngư là một loài kỳ ngư thuộc giống cá bay. Dạng nó như cá chép, thân cá mà cánh chim, có đốm màu xám bạc mà đầu trắng mỏ đỏ, hay bay vào đêm. Sự xuất hiện của nó là dấu hiệu năm được mùa.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ ba》: “Núi Thái Khí 泰器, sông Quán Thủy 观水 đi ra, chảy hướng tây trút vào sông Lưu Sa 流沙. Nơi đó nhiều Văn Diêu Ngư 文鳐鱼, dạng nó như cá chép, thân cá mà cánh chim, có đốm màu xám bạc mà đầu trắng mỏ đỏ, luôn đi đến Tây Hải, bơi lội đến Đông Hải, hay bay vào đêm.”"
    },
    {
        id: "SonHaiDiThuChi-[045]",
        name: "Anh Chiêu",
        pinyin: "英招",
        description: "Anh Chiêu là Sơn Thần của núi Hòe Giang, có khuôn mặt người, thân ngựa, hai cánh chim và vằn hổ, là vị thần trông coi Bình Phố, đồng cỏ tự nhiên thuộc quyền cai quản của hoàng đế.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ ba》: “Núi Hòe Giang, thực ra đó là vườn bằng của hoàng đế, thần Anh Chiêu 神英招 cai quản, dạng nó như thân ngựa mà mặt người, vằn hổ mà cánh chim, tuần ở Tây Hải, phát tiếng như tiếng ríu.”"
    },
    {
        id: "SonHaiDiThuChi-[046]",
        name: "Thiên Thần",
        pinyin: "天神",
        description: "Thiên Thần là một con quái thú hai đầu, ngoại hình giống con trâu, có hai đầu và tám chân, đuôi ngựa. Nơi nó xuất hiện nhất định sẽ xuất hiện chiến loạn.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ ba》: “Núi Hòe Giang, có sông Dâm Thủy, trong xanh bao la. Có vị Thiên Thần 天神, dạng nó như trâu, mà tám chân hai đầu đuôi ngựa, tiếng kêu ùn ùn to lớn 勃皇 (như tiếng phát ra từ tấm màng mỏng khi người đang chơi nhạc cụ), gặp thì có chiến tranh.”"
    },
    {
        id: "SonHaiDiThuChi-[047]",
        name: "Lục Ngô",
        pinyin: "陆吾",
        description: "Lục Ngô là Sơn Thần thủ vệ đế đô Hoàng Đế trên gò núi Côn Luân. Nó mặt người thân hổ móng hổ, mọc chín cái đuôi. Kiêm quản biên giới của chín khu vực trên trời và mùa vụ vườn hoa của Thiên Đế.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ ba》: “Gò núi Côn Luân, thực ra đó là đế đô của Hoàng Đế, thần Lục Ngô 神陆吾 cai quản. Thần đó thân hổ mà chín đuôi, mặt người mà móng hổ. Cũng là thần, cai quản chín bộ trên trời và mùa vụ vườn hoa của Thiên Đế.”"
    },
    {
        id: "SonHaiDiThuChi-[048]",
        name: "Thổ Lâu",
        pinyin: "土蝼",
        description: "Thổ Lâu là một loài quái thú ăn thịt người có bốn sừng, dạng như con dê.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ ba》: “Gò núi Côn Luân, có loài thú, dạng nó như con dê mà bốn sừng, tên là Thổ Lâu 土蝼, ăn thịt người.”"
    },
    {
        id: "SonHaiDiThuChi-[049]",
        name: "Hoạt Ngư",
        pinyin: "䱻鱼",
        description: "Hoạt Ngư là một loài quái ngư dạng như rắn mà có bốn chân, cả người phát sáng, tiếng kêu giống chim uyên ương. Hoạt Ngư là con vật tượng trưng cho hạn hán.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ ba》: “Núi Lạc Du 乐游, sông Đào Thủy 桃水 đi ra, chảy hướng tây trút vào đầm Tắc 稷泽, nơi đó nhiều bạch ngọc. Trong nước nhiều Hoạt Ngư 䱻鱼, dạng nó như rắn mà có bốn chân, ăn thịt cá.”"
    },
    {
        id: "SonHaiDiThuChi-[050]",
        name: "Trường Thừa",
        pinyin: "长乘",
        description: "Trường Thừa là Sơn Thần, dáng vẻ của nó giống người nhưng lại có một cái đuôi báo. Tương truyền do chín cái đức của trời sinh ra.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ ba》: “Hướng tây theo đường thủy 400 dặm, là Lưu Sa, 200 dặm đến núi Lỏa Mẫu, thần Trường Thừa 神长乘 cai quản, đó là chín cái đức của trời. Thần đó dạng như người mà đuôi báo.”"
    },
    {
        id: "SonHaiDiThuChi-[051]",
        name: "Giảo",
        pinyin: "狡",
        description: "Giảo là một loài Cát thú, là tượng trưng cho năm được mùa. Giảo có ngoại hình như là một con chó, thân có vằn báo nhưng lại có sừng trâu.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ ba》: “Ngọc Sơn 玉山, đó là nơi ở của Tây Vương Mẫu. Có loài thú, dạng nó như con chó mà vằn báo, sừng nó như con trâu, tên là Giảo 狡, tiếng nó như tiếng chó sủa, gặp thì nước đó được mùa to.”"
    },
    {
        id: "SonHaiDiThuChi-[052]",
        name: "Thắng Ngộ",
        pinyin: "胜遇",
        description: "Thắng Ngộ là một loài thủy điểu ăn cá, là điềm báo nạn lụt. Dáng vẻ như chim trĩ đuôi dài, toàn thân màu đỏ, âm thanh rất giống hươu đang kêu to.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ ba》: “Ngọc Sơn 玉山, đó là nơi ở của Tây Vương Mẫu. Có loài thú, dạng nó như chim trĩ đuôi dài mà màu đỏ, tên là Thắng Ngộ 胜遇, ăn cá, tiếng nó như hươu kêu, gặp thì nước đó đại hồng thủy.”"
    },
    {
        id: "SonHaiDiThuChi-[053]",
        name: "Thần Ủy Thị",
        pinyin: "神磈氏",
        description: "Thần Ủy Thị tức Tây Phương Thiên Đế Thiếu Hạo. Thiếu Hạo họ Kim Thiên, tên Chí, ông đã từng thành lập một quốc gia của loài chim, bách quan đều do bách điểu đảm nhận.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ ba》: “Núi Trường Lưu 长留, đó là nơi thần Bạch Đế Thiếu Hạo cư ngụ. Thú ở đó đều có vằn ở đuôi, chim ở đó đều có vằn ở đầu. Nhiều văn ngọc thạch. Thực ra đó là cung điện của Thần Ủy Thị 神磈氏. Đó là thần, chủ quản phản cảnh.”"
    },
    {
        id: "SonHaiDiThuChi-[054]",
        name: "Tranh",
        pinyin: "狰",
        description: "Tranh là một loài quái thú một sừng, dáng vẻ như con báo đỏ, có năm cái đuôi, có thể phát ra âm thanh tựa như đập vào tảng đá.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ ba》: “Núi Chương Nga, không  cỏ cây, nhiều dao bích. Ở đây rất quái, có loài thú, dạng nó như báo đỏ, năm đuôi một sừng, tiếng như gõ vào đá, tên là Tranh 狰.”"
    },
    {
        id: "SonHaiDiThuChi-[055]",
        name: "Tất Phương",
        pinyin: "毕方",
        description: "Tất Phương là một loài quái điểu một chân, là loài chim điềm báo hoả hoạn. Tất Phương có ngoại hình giống con hạc, mỏ màu trắng, trên lông vũ màu đen có vằn màu đỏ.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ ba》: “Núi Chương Nga 章莪, có loài chim, dạng nó như con hạc, một chân, vằn đỏ bản chất màu đen mà mỏ trắng, tên là Tất Phương 毕方, tiếng nó tự kêu tên mình, gặp thì ấp đó đột nhiên có cháy.”"
    },
    {
        id: "SonHaiDiThuChi-[056]",
        name: "Kỳ Đồng",
        pinyin: "耆童",
        description: "Kỳ Đồng chính là Lão Đồng, con của Chuyên Húc, truyền thuyết là người sáng lập âm nhạc. Dưới chân luôn được một bầy rắn bao quanh.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ ba》: “Quy Sơn 騩山, bên trên nhiều ngọc mà không có đá. Thần Kỳ Đồng 神耆童 cư ngụ ở đó, âm thanh luôn như chuông khánh. Dưới chân nhiều Tích Xà 积蛇.”"
    },
    {
        id: "SonHaiDiThuChi-[057]",
        name: "Đế Giang",
        pinyin: "帝江",
        description: "Đế Giang tức thần Hỗn Độn. Thần Hỗn Độn Đế Giang không đầu không mặt, dáng vẻ giống như cái túi vàng, màu sắc đỏ như đan hỏa, có sáu chân, bốn cánh, biết ca múa.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ ba》: “Thiên Sơn, có vị thần, dạng nó như cái túi vàng, màu đỏ như đan hỏa, sáu chân bốn cánh, Hồn Đôn không mặt mũi, biết ca múa, thực ra là Đế Giang 帝江.”"
    },
    {
        id: "SonHaiDiThuChi-[058]",
        name: "Hoan",
        pinyin: "讙",
        description: "Hoan là một loài kỳ thú ngăn điềm dữ trừ tà, dáng vẻ giống con báo, có một con mắt và ba cái đuôi. Nghe nói Hoan có thể phát ra âm thanh của hơn trăm loài động vật, còn có thể dùng để chữa bệnh vàng da.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ ba》: “Núi Dực Vọng 翼望, có loài thú, dạng nó như con báo, một mắt mà ba đuôi, tên là Hoan 讙, tiếng nó như át trăm tiếng, có thể ngăn điềm dữ, ăn vào khỏi bệnh vàng da.”"
    },
    {
        id: "SonHaiDiThuChi-[059]",
        name: "Kỳ Dư",
        pinyin: "鵸鵌",
        description: "Kỳ Dư là một loài chim điềm lành ngăn điềm dữ trừ tà, dáng vẻ giống quạ đen nhưng lại có ba cái đầu, sáu cái đuôi, có thể phát ra tiếng cười của con người. Nghe nói ăn thịt Kỳ Dư có thể ngăn chặn ác mộng.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ ba》: “Núi Dực Vọng, có loài chim, dạng nó như con quạ, ba đầu sáu đuôi mà hay cười, tên là Kỳ Dư 鵸鵌, ăn vào khiến người không bị bóng đè, vừa có thể ngăn điềm dữ.”"
    },
    {
        id: "SonHaiDiThuChi-[060]",
        name: "Nhiễm Di Ngư",
        pinyin: "冉遗鱼",
        description: "Nhiễm Di Ngư là một loài kỳ ngư ngăn điềm dữ trừ tà, có thân cá, đầu rắn, sáu chân, hai con mắt giống như tai ngựa. Sau khi ăn Nhiễm Di Ngư có thể ngăn điềm dữ và ác mộng.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ tư》: “Núi Anh Đê 英鞮, sông Uyển Thủy 涴水 đi ra, rồi chảy về hướng bắc trút vào đầm nước Lăng Dương 陵羊. Có nhiều Nhiễm Di Ngư 冉遗鱼, thân cá đầu rắn sáu chân, mắt nó như tai ngựa, ăn vào khiến người không gặp ác mộng, có thể ngăn điềm dữ.”"
    },
    {
        id: "SonHaiDiThuChi-[061]",
        name: "Bác",
        pinyin: "駮",
        description: "Bác là một loài kỳ thú có thể ngăn binh đao chiến lửa. Bác có ngoại hình như con ngựa, thân thể màu trắng và cái đuôi màu đen, hàm răng và móng vuốt của con cọp, trên đầu có một sừng. Bác là loài thú uy mãnh, có thể dùng hổ báo làm thức ăn.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ tư》: “Núi Trung Khúc 中曲, có loài thú, dạng nó như con ngựa mà thân trắng đuôi đen, một sừng, nanh vuốt của hổ, phát ra âm thanh như tiếng trống, tên nó là Bác 駮, ăn hổ báo, có thể ngăn binh chiến.”"
    },
    {
        id: "SonHaiDiThuChi-[062]",
        name: "Cùng Kỳ",
        pinyin: "穷奇",
        description: "Cùng Kỳ là một loài dị thú ăn thịt người, dạng nó như con trâu, toàn thân phủ đầy lông như gai nhím, tiếng kêu như tiếng chó tru.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ tư》: “Khuê Sơn 邽山, trên đó có loài thú, dạng nó như con trâu, lông nhím, tên là Cùng Kỳ 穷奇, âm thanh như tiếng chó tru, ăn thịt người.”"
    },
    {
        id: "SonHaiDiThuChi-[063]",
        name: "Thục Hồ",
        pinyin: "孰湖",
        description: "Thục Hồ là một loài dị thú, có khuôn mặt của con người và cơ thể của con ngựa, có cánh của con chim và đuôi của con rắn, ưa thích bế người lên.",
        source: "《Sơn Hải Kinh · Tây Kinh thứ tư》: “Núi Yêm Tư 崦嵫, có loài thú, dạng nó như thân ngựa mà cánh chim, mặt người đuôi rắn, thích nâng người lên, tên là Thục Hồ 孰湖.”"
    },
    {
        id: "SonHaiDiThuChi-[064]",
        name: "Thủy Mã",
        pinyin: "水马",
        description: "Thủy Mã là một loài linh thú, dạng nó như con ngựa, cánh tay có vằn, đuôi trâu, tiếng nó như tiếng người hô to.",
        source: "《Sơn Hải Kinh · Bắc Sơn Kinh》: “Núi Cầu Như 求如, trong đó có nhiều Thủy Mã 水马, dạng nó như con ngựa, cánh tay có vằn, đuôi trâu, tiếng nó như tiếng người hô to.”"
    },
    {
        id: "SonHaiDiThuChi-[065]",
        name: "Quán Sơ",
        pinyin: "矔疏",
        description: "Quán Sơ, ngựa một sừng, là một loài thú Thụy thú chống lửa. Trên sừng của Quán Sơ có hoa văn đan chéo vào nhau.",
        source: "《Sơn Hải Kinh · Bắc Sơn Kinh》: “Đới Sơn, có loài thú, dạng nó như con ngựa, một sừng có đan chéo, tên nó là  Quán Sơ 矔疏, có thể chống lửa.”"
    },
    {
        id: "SonHaiDiThuChi-[066]",
        name: "Điều Ngư",
        pinyin: "鯈鱼",
        description: "Điều Ngư là là một loài kỳ ngư, dạng nó như con gà mà lông đỏ, ba đuôi sáu chân bốn đầu, tiếng nó như chim hỉ thước. Ăn nó có thể hết ưu sầu và ngăn lửa.",
        source: "《Sơn Hải Kinh · Bắc Sơn Kinh》: “Đới Sơn, sông Bành Thủy đi ra, rồi chảy về hướng tây trút vào sông Ti Hồ 芘湖, trong nước nhiều Điều Ngư 鯈鱼, dạng nó như con gà mà lông đỏ, ba đuôi sáu chân bốn đầu, tiếng nó như chim hỉ thước, ăn nó có thể hết ưu sầu.”"
    },
    {
        id: "SonHaiDiThuChi-[067]",
        name: "Hà La Ngư",
        pinyin: "何罗鱼",
        description: "Hà La Ngư là một loài quái ngư có một đầu mà mười cơ thể, tiếng nó như tiếng chó sủa. Ăn nó khỏi bệnh mụn nhọt và có thể ngăn lửa.",
        source: "《Sơn Hải Kinh · Bắc Sơn Kinh》: “Núi Tiếu Minh 谯明, sông Tiếu Thủy đi ra 谯水, chảy về hướng tây trút vào sông Hoàng Hà 黄河. Trong nước nhiều cá Hà La 何罗, một đầu mười thân, tiếng nó như tiếng chó sủa, ăn nó khỏi bệnh mụn nhọt.”"
    },
    {
        id: "SonHaiDiThuChi-[068]",
        name: "Mạnh Hòe",
        pinyin: "孟槐",
        description: "Mạnh Hòe có ngoại hình giống con lửng mà lông đỏ, tiếng nó như “liu liu”. Mạnh Hòe là kỳ thú có thể ngăn điềm dữ trừ tà.",
        source: "《Sơn Hải Kinh · Bắc Sơn Kinh》: “Núi Tiếu Minh, có loài thú, dạng nó như con lửng mà lông đỏ, tiếng nó như “liu liu”, tên là Mạnh Hòe 孟槐, có thể ngăn điềm dữ.”"
    },
    {
        id: "SonHaiDiThuChi-[069]",
        name: "Tập Tập Ngư",
        pinyin: "鳛鳛鱼",
        description: "Tập Tập Ngư là một loài kỳ thú cá chim cùng chung một cơ thể, dạng nó như chim hỉ thước mà mười cánh, vảy đều ở mút của cánh. Có thể ngăn lửa, ăn nó không bị bệnh vàng da.",
        source: "《Sơn Hải Kinh · Bắc Sơn Kinh》: “Núi Trác Quang 涿光, sông Hiêu Thủy 嚣水 đi ra, rồi chảy về hướng tây trút vào sông Hoàng Hà. Trong nước nhiều cá Tập Tập 鳛鳛, dạng nó như chim hỉ thước mà mười cánh, vảy đều ở mút của cánh, tiếng nó như chim hỉ thước, có thể ngăn lửa, ăn nó không bị bệnh vàng da.”"
    },
    {
        id: "SonHaiDiThuChi-[070]",
        name: "Ngụ",
        pinyin: "寓",
        description: "Ngụ là loài quái thú thuộc về loài dơi, dạng nó như chuột mà cánh chim, tiếng nó như con dê. Có thể ngăn binh chiến.",
        source: "《Sơn Hải Kinh · Bắc Sơn Kinh》: “Quắc Sơn 虢山, chim ở đó nhiều con Ngụ 寓, dạng nó như chuột mà cánh chim,  tiếng nó như con dê, có thể ngăn binh chiến.”"
    },
    {
        id: "SonHaiDiThuChi-[071]",
        name: "Nhĩ Thử",
        pinyin: "耳鼠",
        description: "Nhĩ Thử là một loài kỳ thú, dạng nó như con chuột, mà đầu thỏ thân hoẵng, dùng đuôi bay. Ăn nó không bị sình bụng, còn có thể ngừa bách độc.",
        source: "《Sơn Hải Kinh · Bắc Sơn Kinh》: “Núi Đan Huân 丹熏, có loài thú, dạng nó như con chuột, mà đầu thỏ thân hoẵng, tiếng nó như tiếng chó tru, dùng đuôi bay, tên là Nhĩ Thử 耳鼠, ăn nó không bị sình bụng, còn có thể ngừa bách độc.”"
    },
    {
        id: "SonHaiDiThuChi-[072]",
        name: "Mạnh Cực",
        pinyin: "孟极",
        description: "Mạnh Cực có ngoại hình như con báo, mà trán vằn thân trắng, giỏi ẩn nấp.",
        source: "《Sơn Hải Kinh · Bắc Sơn Kinh》: “Núi Thạch Giả 石者, có loài thú, dạng nó như con báo, mà trán vằn thân trắng, tên là Mạnh Cực 孟极, giỏi ẩn nấp, tiếng nó tự kêu tên mình.”"
    },
    {
        id: "SonHaiDiThuChi-[073]",
        name: "U Át",
        pinyin: "幽頞",
        description: "U Át là một loài quái thú có ngoại hình như con khỉ mà thân vằn, hay cười, gặp người thì nằm giả chết.",
        source: "《Sơn Hải Kinh · Bắc Sơn Kinh》: “Núi Biên Xuân 边春, có loài thú, dạng nó như con khỉ mà thân vằn, hay cười, gặp người thì nằm, tên là U Át 幽頞, tiếng nó tự kêu tên mình.”"
    },
    {
        id: "SonHaiDiThuChi-[074]",
        name: "Túc Tí",
        pinyin: "足訾",
        description: "Túc Tí là một loài dị thú, dạng nó như con khỉ mà có bờm, đuôi trâu, tay có vằn, móng ngựa. Gặp người thì kêu.",
        source: "《Sơn Hải Kinh · Bắc Sơn Kinh》: “Núi Mạn Liên 蔓联, trên đó không cỏ cây, có loài thú, dạng nó như con khỉ mà có bờm, đuôi trâu, tay có vằn, móng ngựa, gặp người thì kêu, tên là Túc Tí 足訾, tiếng nó tự kêu tên mình.”"
    },
    {
        id: "SonHaiDiThuChi-[075]",
        name: "Chư Kiền",
        pinyin: "诸犍",
        description: "Chư Kiền là một loài quái thú, dạng nó như con báo mà đuôi dài, đầu người mà tai trâu, một mắt, hay la, đi thì ngậm đuôi, ngừng thì cuộn đuôi.",
        source: "《Sơn Hải Kinh · Bắc Sơn Kinh》: “Núi Đan Trương 单张, trên đó không cỏ cây. Có loài thú, dạng nó như con báo mà đuôi dài, đầu người mà tai trâu, một mắt, tên là Chư Kiền 诸犍, hay la, đi thì ngậm đuôi, ngừng thì cuộn đuôi.”"
    },
    {
        id: "SonHaiDiThuChi-[076]",
        name: "Trường Xà",
        pinyin: "长蛇",
        description: "Trường Xà có lông nó như lông lợn, tiếng kêu như trống mõ. Là loài cực ác, cực độc.",
        source: "《Sơn Hải Kinh · Bắc Sơn Kinh》: “Núi Đại Hàm 大咸, không cỏ cây, dưới đó nhiều ngọc. Đó là núi, bốn phương, không thể đi lên. Có loài rắn tên là Trường Xà 长蛇, lông nó như lông lợn, tiếng kêu như trống mõ.”"
    },
    {
        id: "SonHaiDiThuChi-[077]",
        name: "Nghễ Ngư",
        pinyin: "鮨鱼",
        description: "Nghễ Ngư là một loài quái thú, thân cá mà đầu chó, tiếng nó như em bé, ăn vào khỏi điên.",
        source: "《Sơn Hải Kinh · Bắc Sơn Kinh》: “Núi Bắc Nhạc 北岳, Dòng sông Chư Hoài đi ra, rồi chảy về hướng tây trút vào sông Hiêu Thủy, trong nước nhiều Nghễ Ngư 鮨鱼, thân cá mà đầu chó, tiếng nó như em bé, ăn vào khỏi điên.”"
    },
    {
        id: "SonHaiDiThuChi-[078]",
        name: "Bào Hào",
        pinyin: "狍鸮",
        description: "Bào Hào còn được gọi là Thao Thiết, là một loài dị thú ăn thịt người. Dạng nó như thân dê mặt người, mắt dưới nách, nanh hổ vuốt người, tiếng kêu như trẻ sơ sinh.",
        source: "《Sơn Hải Kinh · Bắc Kinh thứ hai》: “Núi Câu Ngô 钩吾, có loài thú, dạng nó như thân dê mặt người, mắt dưới nách, nanh hổ vuốt người, tiếng kêu như trẻ sơ sinh, tên là Bào Hào 狍鸮, ăn thịt người.”"
    },
    {
        id: "SonHaiDiThuChi-[079]",
        name: "Hiêu",
        pinyin: "嚣",
        description: "Hiêu là một loài dị điểu một mắt. Dạng nó như Khoa Phụ, bốn cánh, một mắt, đuôi chó, tiếng nó như chim hỉ thước. Ăn vào khỏi đau bụng, có thể ngừng tiêu chảy.",
        source: "《Sơn Hải Kinh · Bắc Kinh thứ ba》: “Núi Lương Cừ 梁渠, có loài chim dạng nó như Khoa Phụ, bốn cánh, một mắt, đuôi chó, tên là Hiêu 嚣, tiếng nó như chim hỉ thước, ăn vào khỏi đau bụng, có thể ngừng tiêu chảy.”"
    },
    {
        id: "SonHaiDiThuChi-[080]",
        name: "Thiên Mã",
        pinyin: "天马",
        description: "Thiên Mã là dị thú biết bay, dạng nó như con chó màu trắng mà đầu đen, gặp người thì bay. Là thần thú đại biểu cho sự may mắn.",
        source: "《Sơn Hải Kinh · Bắc Kinh thứ ba》: “Núi Mã Thành 马成, có loài thú, dạng nó như con chó màu trắng mà đầu đen, gặp người thì bay, tên là Thiên Mã 天马, tiếng nó tự kêu tên mình.”"
    },
    {
        id: "SonHaiDiThuChi-[081]",
        name: "Phi Thử",
        pinyin: "飞鼠",
        description: "Phi Thử là dị thú, dạng nó như con thỏ mà đầu chuột, dùng lưng để bay.",
        source: "《Sơn Hải Kinh · Bắc Kinh thứ ba》: “Phía trên Thiên Trì 天池. Trên đó không cỏ cây, nhiều văn thạch. Có loài thú, dạng nó như con thỏ mà đầu chuột, dùng lưng để bay, tên nó là Phi Thử 飞鼠.”"
    },
    {
        id: "SonHaiDiThuChi-[082]",
        name: "Lĩnh Hồ",
        pinyin: "领胡",
        description: "Lĩnh Hồ là một loài kỳ thú, dạng nó như con trâu mà đuôi đỏ, ăn vào khỏi điên.",
        source: "《Sơn Hải Kinh · Bắc Kinh thứ ba》: “Dương Sơn 阳山, có loài thú, dạng nó như con trâu mà đuôi đỏ, tên nó là Lĩnh Hồ 领胡, tên nó tự kêu, ăn vào khỏi điên.”"
    },
    {
        id: "SonHaiDiThuChi-[083]",
        name: "Tượng Xà",
        pinyin: "象蛇",
        description: "Tượng Xà là một loài kỳ điểu lưỡng tính, dạng nó như chim trĩ mái, mà vằn ngũ sắc, tự làm trống mái.",
        source: "《Sơn Hải Kinh · Bắc Kinh thứ ba》: “Dương Sơn, có loài chim, dạng nó như chim trĩ mái, mà vằn ngũ sắc, tự làm trống mái, tên là Tượng Xà 象蛇, tên nó tự kêu.”"
    },
    {
        id: "SonHaiDiThuChi-[084]",
        name: "Toan Dữ",
        pinyin: "酸与",
        description: "Toan Dữ là một loài quái thú, dạng nó như con rắn, mà bốn cánh, sáu mắt, ba chân. Là một loài hung điểu, gặp thì huyện đó bị sợ hãi, ăn thịt nó thì sẽ không bị say rượu.",
        source: "《Sơn Hải Kinh · Bắc Kinh thứ ba》: “Cảnh Sơn 景山, có loài chim, dạng nó như con rắn, mà bốn cánh, sáu mắt, ba chân, tên là Toan Dữ 酸与, tên nó tự kêu, gặp thì huyện đó bị sợ hãi.”"
    },
    {
        id: "SonHaiDiThuChi-[085]",
        name: "Hoàn",
        pinyin: "獂",
        description: "Hoàn là một loài thú ba chân, dạng nó như con trâu mà ba chân.",
        source: "《Sơn Hải Kinh · Bắc Kinh thứ ba》: “Càn Sơn 乾山, có loài thú, dạng nó như con trâu mà ba chân, tên nó là Hoàn 獂, tiếng nó tự kêu tên mình.”"
    },
    {
        id: "SonHaiDiThuChi-[086]",
        name: "Dong Dong Ngư",
        pinyin: "鳙鳙鱼",
        description: "Dong Dong Ngư là một loài dị thú, dạng nó như trâu cày, tiếng nó như lợn kêu.",
        source: "《Sơn Hải Kinh · Đông Sơn Kinh》: “Sông Thực Thủy 食水 đi ra, rồi chảy về hướng đông bắc trút vào biển. Trong nước nhiều cá Dong Dong 鳙鳙, dạng nó như trâu cày, tiếng nó như lợn kêu.”"
    },
    {
        id: "SonHaiDiThuChi-[087]",
        name: "Tòng Tòng",
        pinyin: "从从",
        description: "Tòng Tòng là một loài thú may mắn sáu chân, dạng nó như con chó.",
        source: "《Sơn Hải Kinh · Đông Sơn Kinh》: “Núi Tuân Trạng 栒状, có loài thú dạng nó như con chó, sáu chân, tên nó là Tòng Tòng 从从, tiếng nó tự kêu tên mình.”"
    },
    {
        id: "SonHaiDiThuChi-[088]",
        name: "Điều Dong",
        pinyin: "䖺䗤",
        description: "Điều Dong là một loài quái thú, dạng nó như rắn vàng, vây cá, ra vào có ánh sáng. Là Hung thú, gặp thì thiên hạ đại hạn.",
        source: "《Sơn Hải Kinh · Đông Sơn Kinh》: “Độc Sơn 独山, sông 末涂 Mạt Đồ đi ra, rồi chảy về hướng đông nam trút vào sông Miến Thuỷ 沔水, trong nước nhiều Điều Dong 䖺䗤, dạng nó như rắn vàng, vây cá, ra vào có ánh sáng, gặp thì thiên hạ đại hạn.”"
    },
    {
        id: "SonHaiDiThuChi-[089]",
        name: "Chu Nhụ",
        pinyin: "朱獳",
        description: "Chu Nhụ là một loài quái thú, dạng nó như con cáo mà vây cá. Là thú điềm xấu, gặp thì nước đó bị khủng hoảng lớn.",
        source: "《Sơn Hải Kinh · Đông Sơn Kinh》: “Cảnh Sơn 耿山, không cỏ cây, nhiều thủy bích, nhiều rắn lớn. Có loài thú, dạng nó như con cáo mà vây cá, tên là Chu Nhụ, tiếng nó tự kêu tên mình, gặp thì nước đó bị khủng hoảng lớn.”"
    },
    {
        id: "SonHaiDiThuChi-[090]",
        name: "Tệ Tệ",
        pinyin: "獙獙",
        description: "Tệ Tệ là một loài quái thú, dạng nó như con cáo mà có cánh, tiếng nó như chim hồng nhạn. Là Hung thú, gặp thì thiên hạ đại hạn.",
        source: "《Sơn Hải Kinh · Đông Kinh thứ hai》: “Núi Cô Phùng 姑逢, không cỏ cây, nhiều vàng ngọc. Có loài thú, dạng nó như con cáo mà có cánh, tiếng nó như chim hồng nhạn, tên là Tệ Tệ 獙獙, gặp thì thiên hạ đại hạn.”"
    },
    {
        id: "SonHaiDiThuChi-[091]",
        name: "Du Du",
        pinyin: "峳峳",
        description: "Du Du là loài kỳ thú, dạng nó như con ngựa, mà mắt dê, bốn sừng, đuôi trâu, tiếng nó như tiếng chó tru. Gặp thì nước đó nhiều người xảo quyệt.",
        source: "《Sơn Hải Kinh · Đông Kinh thứ hai》: “Chân Sơn 䃌山, có loài thú, dạng nó như con ngựa, mà mắt dê, bốn sừng, đuôi trâu, tiếng nó như tiếng chó tru, tên là Du Du 峳峳, gặp thì nước đó nhiều người xảo quyệt.”"
    },
    {
        id: "SonHaiDiThuChi-[092]",
        name: "Kiết Câu",
        pinyin: "絜钩",
        description: "Kiết Câu có ngoại hình như chim vịt trời, đuôi chuột, giỏi trèo cây. Là một loài chim tai họa, có thể mang đến ôn dịch.",
        source: "《Sơn Hải Kinh · Đông Kinh thứ hai》: “Chân Sơn, có loài chim, dạng nó như vịt trời mà đuôi chuột, giỏi trèo cây, tên là Kiết Câu 絜钩, gặp thì nước đó nhiều bệnh dịch.”"
    },
    {
        id: "SonHaiDiThuChi-[093]",
        name: "Uyển Hồ",
        pinyin: "妴胡",
        description: "Uyển Hồ là một loài quái thú, dạng nó như con nai mà mắt cá.",
        source: "《Sơn Hải Kinh · Đông Kinh thứ ba》: “Núi Thi Hồ 尸胡, có loài thú, dạng nó như con nai mà mắt cá, tên là Uyển Hồ 妴胡, tiếng nó tự kêu tên mình.”"
    },
    {
        id: "SonHaiDiThuChi-[094]",
        name: "Yết Thư",
        pinyin: "猲狙",
        description: "Yết Thư là một loài quái thú, dạng nó như con sói, đầu đỏ mắt chuột, tiếng kêu như tiếng heo sữa. Là một loài Hung thú, ăn thịt người.",
        source: "《Sơn Hải Kinh · Đông Kinh thứ tư》: “Núi Bắc Hiệu 北号, có loài thú, dạng nó như con sói, đầu đỏ mắt chuột, tiếng kêu như tiếng heo sữa, tên là Yết Thư 猲狙, ăn thịt người.”"
    },
    {
        id: "SonHaiDiThuChi-[095]",
        name: "Kỳ Tước",
        pinyin: "鬿雀",
        description: "Kỳ Tước là một loài kỳ thú, dạng nó như con gà mà đầu trắng, chân chuột mà vuốt hổ. Là Hung thú, cũng ăn thịt người.",
        source: "《Sơn Hải Kinh · Đông Kinh thứ tư》: “Núi Bắc Hiệu, có loài chim, dạng nó như con gà mà đầu trắng, chân chuột mà vuốt hổ, tên là Kỳ Tước 鬿雀, cũng ăn thịt người.”"
    },
    {
        id: "SonHaiDiThuChi-[096]",
        name: "Hợp Dũ",
        pinyin: "合窳",
        description: "Hợp Dũ là một loài nhân thú mặt người, dạng nó như con heo mà mặt người, thân vàng đuôi đỏ, tiếng nó như trẻ sơ sinh. Là Hung thú, ăn thịt người, cũng ăn sâu rắn, gặp thì thiên hạ đại hồng thủy.",
        source: "《Sơn Hải Kinh · Đông Kinh thứ tư》: “Diệm Sơn 剡山, có loài thú, dạng nó như con heo mà mặt người, thân vàng đuôi đỏ, tên là Hợp Dũ 合窳, tiếng nó như trẻ sơ sinh. Đó là thú, ăn thịt người, cũng ăn sâu rắn, gặp thì thiên hạ đại hồng thủy.”"
    },
    {
        id: "SonHaiDiThuChi-[097]",
        name: "Phỉ",
        pinyin: "蜚",
        description: "Phỉ là một loài kỳ thú, dạng nó như con trâu mà đầu trắng, một mắt mà đuôi rắn. Là một Tai thú, xuống nước thì nước cạn, đi qua cỏ thì cỏ chết, gặp thì thiên hạ đại dịch.",
        source: "《Sơn Hải Kinh · Đông Kinh thứ tư》: “Thái Sơn 泰山, có loài thú, dạng nó như con trâu mà đầu trắng, một mắt mà đuôi rắn, tên là Phỉ 蜚, xuống nước thì nước cạn, đi qua cỏ thì cỏ chết, gặp thì thiên hạ đại dịch.”"
    },
    {
        id: "SonHaiDiThuChi-[098]",
        name: "Tứ Thánh Thú",
        pinyin: "四圣兽",
        description: "Tứ Thánh Thú, hay Tứ Tượng, là thần linh bốn phương: Đông Phương Thanh Long, Tây Phương Bạch Hổ, Nam Phương Chu Tước, Bắc Phương Huyền Vũ. Chúng đại diện cho các yếu tố và chòm sao, được Đạo giáo thờ phụng.",
        source: ""
    },
    {
        id: "SonHaiDiThuChi-[099]",
        name: "Thanh Long",
        pinyin: "青龙",
        description: "Thanh Long là thánh thú chưởng quản phương Đông, ngũ hành thuộc Mộc màu xanh. Đại biểu cho bảy chòm sao phương Đông: Giác, Cang, Đê, Phòng, Tâm, Vĩ, Cơ.",
        source: "《Sơn Hải Kinh》"
    },
    {
        id: "SonHaiDiThuChi-[100]",
        name: "Bạch Hổ",
        pinyin: "白虎",
        description: "Bạch Hổ đại biểu cho phương Tây, là Chiến Thần và thần sát phạt, ngũ hành thuộc Kim màu trắng. Đại biểu cho bảy chòm sao phía tây: Khuê, Lâu, Vị, Mão, Tất, Chủy, Sâm.",
        source: ""
    }
];
