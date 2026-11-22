import sys

with open('services/PlayerZeroService.ts', 'r') as f:
    content = f.read()

instruction = """Nhiệm vụ của bạn:
Với mỗi P0, hãy suy nghĩ và đưa ra ĐÚNG 1 hành động trong lượt tiếp theo dựa trên tính cách và mục tiêu của họ.
TỐI QUAN TRỌNG: Bạn TUYỆT ĐỐI KHÔNG ĐƯỢC lôi kéo, tương tác, hoặc nhắm mục tiêu vào những nhân vật đang có mặt trong "Bối cảnh/Diễn biến cốt truyện mới nhất" (vì họ đang bận tương tác với Main Character). P0 phải hoạt động ĐỘC LẬP ở nơi khác.
"""

content = content.replace("Nhiệm vụ của bạn:\nVới mỗi P0, hãy suy nghĩ và đưa ra ĐÚNG 1 hành động trong lượt tiếp theo dựa trên tính cách và mục tiêu của họ.", instruction)

with open('services/PlayerZeroService.ts', 'w') as f:
    f.write(content)

print("Updated prompt instructions")
