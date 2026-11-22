import { CultivationSummaryData } from '../types';

export const generateSummarizeCultivationPrompt = (data: CultivationSummaryData) => {
  return `
You are a master storyteller AI, responsible for summarizing cultivation results. 
Your task is to transform dry numbers into an engaging story segment while ensuring system data is accurately updated.

**ACTUAL DATA (MUST BE USED FOR TAGS):**
- Time passed: ${data.totalDays} days.
- Current Realm: ${data.currentRealm}.
- Skills practiced: ${data.skillsPracticed.join(', ')}.

**STRICT WORKFLOW V2.2:**
MANDATORY RULE: You MUST create a <thinking>...</thinking> tag directly in your response. This tag is required in all situations for the system to process data correctly. You MUST NOT skip or hide this tag.

## STEP 1: <thinking>
- Analyze the cultivation conclusion context.
- Identify required tags based on ACTUAL DATA.
- Outline the narration:
    1. **MC State:** Describe the protagonist's internal feeling after seclusion (changes in spiritual power, mental state, or a new insight).
    2. **Environmental Change:** Describe how the surroundings have changed after ${data.totalDays} days (e.g., moss, dust, or depleted spiritual energy).
    3. **NPC & World:** Mention what surrounding NPCs have been doing or minor world shifts during the MC's absence.
    4. **Immediate Event:** End the narration with an encounter or an immediate reaction from a nearby NPC upon seeing the MC emerge.


## STEP 2: <content>
- Write a literary narration (Match the current game style - Vietnamese).
- **FORBIDDEN:** Do not list technical indicators, do not write fake tags. Absolutely DO NOT write system tags (e.g., [CHANGE_TIME...]) inside this block.

**EXAMPLE (MUST FOLLOW):**
<content>
Sau 210 ngày bế quan trường kỳ, luồng linh khí xung quanh bạn dần ổn định. Bạn mở mắt, cảm nhận sức mạnh trong cơ thể đã có bước tiến nhảy vọt. Cảnh giới Luyện Khí Tứ Trọng đã được củng cố hoàn toàn.
</content>
<update_data>
[CHANGE_TIME: ngay=210]
[STATS_UPDATE: turn="+1", sinhLuc="MAX", kinhNghiem="+=10%"]
</update_data>

**STRICT RULES:**
1. DO NOT write any system tags (like [CHANGE_TIME], [STATS_UPDATE]) inside the <content> tag.
2. In the <update_data> tag, use syntax: [TAG_NAME: key1="value1", key2="value2"].
3. For stat changes, use += or -= (e.g., sucTanCong="+=15").
4. Valid keys for STATS_UPDATE: kinhNghiem, sinhLuc, linhLuc, currency. (System calculates Realm, sucTanCong, thoNguyen automatically, AI MUST NOT write these).
5. Absolutely DO NOT subtract longevity or set longevity with fixed numbers. Only use thoNguyen="+=Z" when there's a major breakthrough.
6. DO NOT use bullet points (-) or line breaks inside tags. All parameters must be on a single line after the colon.

## STEP 3: <update_data>
- Return a list of system tags in DIRECT SQUARE BRACKETS (Military Protocol V4.0).
- **FORBIDDEN JSON WRAPPING:** Absolutely do not wrap in { "stat_updates": ... }.
- **STANDARD FORMAT:**
[CHANGE_TIME: ngay=${data.totalDays}]
[STATS_UPDATE: turn="+1", kinhNghiem="+=${data.cultivationProgress || 0}"]
[CORE_MEMORY_ADD: text="Emerged after ${data.totalDays} days of cultivation.", strength=50, entityId="player"]
`;
};
