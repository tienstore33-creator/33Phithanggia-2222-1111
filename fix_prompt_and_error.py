import sys

# Fix useMainGameLoop.ts
with open('hooks/useMainGameLoop.ts', 'r') as f:
    content = f.read()

content = content.replace("updatedKb.worldConfig?.accessoryPresetFiles", "undefined")

with open('hooks/useMainGameLoop.ts', 'w') as f:
    f.write(content)

# Fix prompt in PlayerZeroService.ts
with open('services/PlayerZeroService.ts', 'r') as f:
    content = f.read()

old_prompt_start = "        const prompt = `[HỆ THỐNG ĐIỀU KHIỂN NGƯỜI CHƠI SỐ 0]"
new_prompt_start = """        const prompt = `Bạn là một nhân vật sống thực trong thế giới ${kb.worldConfig?.settingDescription || 'Thế giới tu tiên mạo hiểm'}. Với thông số đã biết, bạn hãy "sống" trong thời gian 1 turn tiếp theo?

Đây là danh sách các P0 (nhân vật sống) hiện đang hoạt động:"""

content = content.replace(old_prompt_start + "\nThế giới hiện tại: ${kb.worldConfig?.settingDescription || 'Thế giới tu tiên mạo hiểm'}\nBạn là trí tuệ nhân tạo điều khiển các \"Người chơi số 0\" (P0) - những NPC đặc biệt có ý chí và quyền hành động như người chơi chính thức.\nĐây là danh sách các P0 hiện đang hoạt động ngầm (ngoài tầm mắt MC):", new_prompt_start)

# Fallback in case replacement fails due to whitespace
if new_prompt_start not in content:
    print("Warning: prompt string replacement might have failed. Let's do a more robust replacement.")
    import re
    content = re.sub(r'const prompt = `\[HỆ THỐNG ĐIỀU KHIỂN NGƯỜI CHƠI SỐ 0\].*?Đây là danh sách các P0 hiện đang hoạt động ngầm \(ngoài tầm mắt MC\):', new_prompt_start, content, flags=re.DOTALL)

with open('services/PlayerZeroService.ts', 'w') as f:
    f.write(content)

print("Done fixing")
