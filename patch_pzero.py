import sys

# 1. Update PlayerZeroService.ts
with open('services/PlayerZeroService.ts', 'r') as f:
    content = f.read()

# Add recentNarration to processPlayerZeroTurn signature
content = content.replace(
    "public static async processPlayerZeroTurn(kb: KnowledgeBase, isPresetActive: boolean): Promise<{ updatedKb: KnowledgeBase; systemMessages: GameMessage[] }> {",
    "public static async processPlayerZeroTurn(kb: KnowledgeBase, isPresetActive: boolean, recentNarration?: string): Promise<{ updatedKb: KnowledgeBase; systemMessages: GameMessage[] }> {"
)

# Insert the narrative into the prompt
old_prompt = """Đây là danh sách các P0 (nhân vật sống) hiện đang hoạt động:"""
new_prompt = """Bối cảnh/Diễn biến cốt truyện mới nhất vừa xảy ra:
${recentNarration ? recentNarration : 'Không có diễn biến gì đáng chú ý.'}

Đây là danh sách các P0 (nhân vật sống) hiện đang hoạt động:"""

content = content.replace(old_prompt, new_prompt)

# Also fix the P0 filter, we should probably exclude NPCs that are currently mentioned in the recentNarration!
# Wait, actually, P0s that are at currentLocationId are already excluded.
# "const activePZeros = pZeros.filter(p => !p.locationId || p.locationId !== updatedKb.currentLocationId);"
# But what if currentLocationId is null or they are mentioned?
# If recentNarration mentions them, maybe they shouldn't act independently.

with open('services/PlayerZeroService.ts', 'w') as f:
    f.write(content)

# 2. Update useMainGameLoop.ts
with open('hooks/useMainGameLoop.ts', 'r') as f:
    content_main = f.read()

content_main = content_main.replace(
    "const pZeroResult = await PlayerZeroService.processPlayerZeroTurn(finalKbForThisTurn, hasPreset);",
    "const pZeroResult = await PlayerZeroService.processPlayerZeroTurn(finalKbForThisTurn, hasPreset, narrativeResult?.response?.narration);"
)

with open('hooks/useMainGameLoop.ts', 'w') as f:
    f.write(content_main)

print("Patched P0 prompt context")
