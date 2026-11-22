import React, { useMemo, useState } from "react";
import { StatusEffect, NPC, KnowledgeBase } from "../../types";
import DynamicAvatar from "../DynamicAvatar";
import DialogueBlock from "./DialogueBlock";
import { getFaceIndexFromEmoji, cleanEmojiString } from "../../utils/emotionMapper";
import { getDeterministicAvatarSrc } from "../../utils/avatarUtils";
import { diceCoefficient } from "../../utils/questUtils";
import { extractMainStoryContent } from "../../utils/journalParser";

interface FormattedNarrationProps {
  content: string;
  statuses?: StatusEffect[];
  knownEntityNames?: Set<string>;
  onEntityClick?: (name: string) => void;
  activeNpc?: NPC;
  characterExpressionId?: number;
  knowledgeBase?: KnowledgeBase;
  parseAndHighlightText?: (text: string) => React.ReactNode[];
  isDevMode?: boolean;
}

const SystemAnalysisBlock: React.FC<{ blocks: { tag: string; content: string }[] }> = ({ blocks }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="mt-4 p-3 bg-gray-900/80 border border-gray-700/80 rounded-xl text-sm font-mono text-gray-300 shadow-xl shadow-black/40 relative overflow-hidden transition-all duration-300">
      <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
      <div 
        className="font-bold text-emerald-400 flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          PHÂN TÍCH & DỮ LIỆU BỔ SUNG ({blocks.length})
        </div>
        <div className="text-gray-400 hover:text-emerald-400 transition-colors">
          {isExpanded ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="mt-3 space-y-2 pt-3 border-t border-gray-700/50">
          {blocks.map((block, idx) => (
            <details key={idx} className="group border border-gray-700/50 rounded-lg bg-gray-900/50">
              <summary className="cursor-pointer px-3 py-2 text-emerald-400/90 font-bold uppercase tracking-wider hover:bg-gray-800/80 select-none flex items-center gap-2 transition-colors rounded-lg group-open:rounded-b-none">
                <span className="text-emerald-500/50 group-open:rotate-90 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </span>
                {block.tag}
              </summary>
              <div className="p-3 border-t border-gray-700/50 text-sm text-gray-300 font-mono whitespace-pre-wrap leading-relaxed">
                {block.content}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
};

const FormattedNarration: React.FC<FormattedNarrationProps> = React.memo(
  ({
    content,
    statuses = [],
    knownEntityNames = new Set(),
    onEntityClick,
    activeNpc,
    characterExpressionId = 0,
    knowledgeBase,
    parseAndHighlightText,
    isDevMode = false,
  }) => {
    const parsedData = useMemo(() => {
      if (!content) return { cleanedText: "", backstageBlocks: [] };

      // Normalize escaped lt/gt
      let normalized = content
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");

      const backstageBlocks: { tag: string; content: string }[] = [];
      const inlineTextTags = new Set([
        "exp", "thought", "status", "important", "entity", "npc_thought", 
        "secret_action", "system", "system_analysis", "content", "narration", "dialogue"
      ]);

      const group2SystemTags = new Set([
        "thinking", "think", "choice", "choices", "branches", "json_data", "tags"
      ]);

      // Nhóm 4: Loại thẻ hỗ trợ - Ẩn hoàn toàn, không đưa vào hộp PHÂN TÍCH & DỮ LIỆU BỔ SUNG
      const group4SupportTags = new Set([
        "update_data", "world_pulse", "faction_dynamics", "entity_tracking", "warudo_secret", "audit_log"
      ]);

      // Trích xuất tất cả thẻ bằng cách tìm thẻ mở và thẻ đóng tương ứng (không phân biệt hoa thường)
      const openTagRegex = /<([a-zA-ZÀ-ỹ_0-9\s-]+)(?:\s+[^>]*)?>/gi;
      let match: RegExpExecArray | null;

      while ((match = openTagRegex.exec(normalized)) !== null) {
        const fullOpenTag = match[0];
        const tagName = match[1].trim();
        const tagLower = tagName.toLowerCase();
        const openTagStart = match.index;
        const openTagEnd = openTagStart + fullOpenTag.length;

        // Bỏ qua nếu là thẻ đóng </...
        if (fullOpenTag.startsWith("</")) continue;

        // Tìm thẻ đóng tương ứng </tagName> sau vị trí mở (không phân biệt hoa thường)
        const escapeTagName = tagName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const closeTagRegex = new RegExp(`</\\s*${escapeTagName}\\s*>`, 'i');
        const searchSub = normalized.slice(openTagEnd);
        const closeMatch = closeTagRegex.exec(searchSub);

        let innerContent = "";
        if (closeMatch) {
          // Thẻ có cặp đóng mở đầy đủ
          innerContent = searchSub.slice(0, closeMatch.index);
        } else {
          // Thẻ mở không có đóng: cắt đến thẻ tiếp theo (< hoặc </) hoặc hết chuỗi
          const nextTagIndex = searchSub.search(/<\/?/);
          if (nextTagIndex !== -1) {
            innerContent = searchSub.slice(0, nextTagIndex);
          } else {
            innerContent = searchSub;
          }
        }

        // Dọn dẹp bất kỳ thẻ đóng dư thừa nào trong innerContent
        innerContent = innerContent.replace(/<\/[^>]+>/gi, "").trim();

        // Kiểm tra xem thẻ có thuộc Nhóm 3 (hộp PHÂN TÍCH & DỮ LIỆU BỔ SUNG) hay không
        const isGroup3 = !inlineTextTags.has(tagLower) && 
                         !group2SystemTags.has(tagLower) && 
                         !group4SupportTags.has(tagLower);

        if (isGroup3 && innerContent) {
          if (!backstageBlocks.some(b => b.tag.toLowerCase() === tagLower && b.content === innerContent)) {
            backstageBlocks.push({
              tag: tagName,
              content: innerContent
            });
          }
        }
      }

      // Extract clean story text regardless of wrapper or unclosed tags
      let processed = extractMainStoryContent(normalized);

      // Sửa lỗi cơ học: Thay thế tất cả các biến thể của DIALOGUE_MARKER thô (như $DIALOGUE_MARKER, {DIALOGUE_MARKER}, v.v.) thành ##
      processed = processed.replace(/\\?\$?\{?DIALOGUE_MARKER\}?/g, "##");

      // Sửa lỗi AI lặp lại ## ở giữa tên và nội dung (VD: ##Name|Emoji|##Speech##)
      processed = processed.replace(/##([^|#\n]+\|[^|#\n]+\|)##([^#\n]+)##/g, "##$1$2##");
      
      return {
        cleanedText: processed,
        backstageBlocks
      };
    }, [content]);

    const processedContent = parsedData.cleanedText;

    const parts = useMemo(() => {
      return processedContent
        .split(
          /(##.*?##|<transaction\s+[^>]*\/>|&lt;(?:exp|thought|status|important|entity|npc_thought|secret_action|system)(?:\s+[^&]*)?&gt;.*?&lt;\/\s*(?:exp|thought|status|important|entity|npc_thought|secret_action|system)\s*&gt;|<(?:exp|thought|status|important|entity|npc_thought|secret_action|system|system_analysis)(?:\s+[^>]*)?>.*?<\/\s*(?:exp|thought|status|important|entity|npc_thought|secret_action|system|system_analysis)\s*>)/gsu,
        )
        .filter(Boolean);
    }, [processedContent]);

    const sfxRegex = /(bạch bạch|phập|chùn chụt|lép nhép|xèo)/gi;

    return (
      <div className="space-y-4 w-full">
        <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed whitespace-pre-wrap">
        {parts.map((part, index) => {
          if (part.startsWith("##") && part.endsWith("##")) {
            const innerContent = part.substring(2, part.length - 2);

            const isNpcOrPlayerDialogue = innerContent.includes("|") || 
              innerContent.startsWith("player") ||
              innerContent.startsWith("nguoichoi") ||
              innerContent.startsWith("mc");

            if (isNpcOrPlayerDialogue) {
              let charIdentifier = "";
              let emoji = "";
              let speech = "";

              if (innerContent.includes("|")) {
                const firstPipeIndex = innerContent.indexOf("|");
                charIdentifier = innerContent.substring(0, firstPipeIndex).trim();
                const remaining = innerContent.substring(firstPipeIndex + 1).trim();

                if (remaining.includes("|")) {
                  const secondPipeIndex = remaining.indexOf("|");
                  emoji = remaining.substring(0, secondPipeIndex).trim();
                  speech = remaining.substring(secondPipeIndex + 1).trim();
                } else {
                  // Fallback for AI missing the second | symbol e.g. ##npc-start-...|😭"dialog"##
                  const quoteIndices = [remaining.indexOf('"'), remaining.indexOf('“'), remaining.indexOf("'")].filter(idx => idx !== -1);
                  if (quoteIndices.length > 0) {
                    const firstQuoteIndex = Math.min(...quoteIndices);
                    emoji = remaining.substring(0, firstQuoteIndex).trim();
                    speech = remaining.substring(firstQuoteIndex).trim();
                  } else {
                    emoji = "";
                    speech = remaining;
                  }
                }
              } else {
                charIdentifier = "player";
                emoji = "";
                speech = innerContent;
              }

              if (emoji) {
                emoji = cleanEmojiString(emoji);
              }

              // 1. Resolve speaker (Player vs NPC)
              let speakerNPCObj: any = null;
              let isPlayer = false;

              const playerIdNames = ["player", "nguoichoi", "nguoi_choi", "mc"];
              const normalizedCharIdentifier = charIdentifier.toLowerCase();

              const normalizeForMatch = (s: string) => 
                s.normalize("NFD")
                 .replace(/[\u0300-\u036f]/g, "")
                 .toLowerCase()
                 .replace(/npc-(start-)?/g, "")
                 .replace(/[_]/g, " ")
                 .replace(/[-]/g, " ")
                 .trim();

              const findBestNPCObj = (idOrName: string) => {
                if (!knowledgeBase) return null;
                const searchPool = [
                  ...(knowledgeBase.discoveredNPCs || []),
                  ...(knowledgeBase.wives || []),
                  ...(knowledgeBase.companions || []),
                  ...(knowledgeBase.slaves || []),
                  ...(knowledgeBase.prisoners || []),
                  knowledgeBase.master
                ].filter(Boolean);

                // Priority 1: Exact ID match
                let match = searchPool.find(n => n.id === idOrName);
                if (match) return match;

                // Priority 2: Cleaned ID/Name matching
                // Loại bỏ "npc-start-" hoặc "npc-"
                let cleanedInput = idOrName.replace(/^npc-(start-)?/gi, '');
                // Loại bỏ timestamp ở cuối (chuỗi số dài 10-15 ký tự)
                cleanedInput = cleanedInput.replace(/[-\s_]?\d{10,15}([-\s_][a-z0-9]{5})?$/gi, '');
                // Chỉ loại bỏ hash 5 ký tự nếu nó thực sự trông giống hash (ví dụ: có cả chữ và số như r569d) 
                // và không phải là một từ thuần chữ cái có nghĩa (tránh xóa nhầm "thanh", "tuyen", "trinh")
                cleanedInput = cleanedInput.replace(/[-\s_](?=[a-z]*[0-9])[a-z0-9]{5}$/gi, '');
                cleanedInput = cleanedInput.trim();

                const targetNormCleaned = normalizeForMatch(cleanedInput || idOrName);

                if (cleanedInput) {
                  match = searchPool.find(n => n.name && normalizeForMatch(n.name) === targetNormCleaned);
                  if (match) return match;
                }

                // Priority 3: Normalized Name match (Lý Tuyết Vy -> ly tuyet vy)
                const targetNormOriginal = normalizeForMatch(idOrName);
                match = searchPool.find(n => n.name && normalizeForMatch(n.name) === targetNormOriginal);
                if (match) return match;

                // Priority 4: Normalized ID match
                match = searchPool.find(n => n.id && normalizeForMatch(n.id) === targetNormOriginal);
                if (match) return match;

                // Priority 5: Substring matching (phòng khi AI ghi tên kèm đuôi hash rác như "Liễu Thanh Thanh r569d")
                match = searchPool.find(n => {
                  if (!n.name) return false;
                  const npcNameNorm = normalizeForMatch(n.name);
                  return targetNormOriginal.includes(npcNameNorm) || npcNameNorm.includes(targetNormOriginal);
                });
                if (match) return match;

                // Priority 6: Fuzzy matching as last resort (diceCoefficient > 0.7)
                let bestMatch = null;
                let highestScore = 0.7; // Threshold for similarity
                searchPool.forEach(n => {
                  if (!n.name) return;
                  const score = diceCoefficient(targetNormOriginal, normalizeForMatch(n.name));
                  if (score > highestScore) {
                    highestScore = score;
                    bestMatch = n;
                  }
                });
                return bestMatch || null;
              };

              if (knowledgeBase && (
                playerIdNames.includes(normalizedCharIdentifier) || 
                normalizedCharIdentifier === (knowledgeBase.worldConfig?.playerName || "").toLowerCase()
              )) {
                isPlayer = true;
              } else {
                speakerNPCObj = findBestNPCObj(charIdentifier);
                
                if (!speakerNPCObj && activeNpc) {
                  const targetNorm = normalizeForMatch(charIdentifier);
                  if (activeNpc.id === charIdentifier || 
                      normalizeForMatch(activeNpc.name || "") === targetNorm ||
                      normalizeForMatch(activeNpc.id || "") === targetNorm) {
                    speakerNPCObj = activeNpc;
                  }
                }
              }

              // 2. Resolve facial index from original emoji helper
              const faceFromEmoji = getFaceIndexFromEmoji(emoji);

              // 3. Resolve metadata and rendering values
              let speakerName = charIdentifier;
              let isFemale = false;
              let avatarUrl = "";
              let hairIndex: number | undefined = undefined;
              let resolvedFaceIndex: number | undefined = faceFromEmoji;

              const guessGenderFromName = (name: string) => {
                const femaleKeywords = ['thi', 'nương', 'tỷ', 'muội', 'cô', 'nữ', 'vy', 'nhi', 'nghi', 'tuyết', 'ngọc', 'linh', 'hương', 'lan', 'thanh', 'phượng', 'vân', 'kiều', 'liễu', 'diệp'];
                const norm = name.toLowerCase();
                return femaleKeywords.some(k => norm.includes(k));
              };

              if (isPlayer) {
                speakerName = knowledgeBase?.worldConfig?.playerName || "Người Chơi";
                isFemale = !!knowledgeBase?.worldConfig?.playerGender?.toLowerCase().includes("nữ");
                avatarUrl = knowledgeBase?.playerAvatarData || knowledgeBase?.worldConfig?.playerAvatarUrl || "";
                hairIndex = knowledgeBase?.worldConfig?.playerAvatarHairId;
                resolvedFaceIndex = faceFromEmoji ?? 0; // Player usually has a default face
              } else if (speakerNPCObj) {
                speakerName = speakerNPCObj.name;
                isFemale = !!speakerNPCObj.gender?.toLowerCase().includes("nữ");
                avatarUrl = speakerNPCObj.avatarUrl || "";
                hairIndex = speakerNPCObj.avatarHairId;
                // Priority: Narrator Emoji Face > NPC Instance Face
                resolvedFaceIndex = faceFromEmoji ?? speakerNPCObj.avatarFaceId;
              }

              if (!isPlayer && !speakerNPCObj) {
                // Làm sạch hoàn toàn cơ học ID rác khỏi tên hiển thị dứt điểm
                let cleanedName = charIdentifier.replace(/^npc-(start-)?/gi, '');
                // Loại bỏ timestamp + hash lẻ ở cuối: VD "1781396854315-r569d" hoặc "1781396854315"
                cleanedName = cleanedName.replace(/[-\s_]?\d{10,15}([-\s_][a-z0-9]{5})?$/gi, '');
                // Loại bỏ hash lẻ loi 5 ký tự ở cuối: VD "-r569d", "_r569d", " r569d"
                cleanedName = cleanedName.replace(/[-\s_][a-z0-9]{5}$/gi, '');
                cleanedName = cleanedName.trim();

                if (cleanedName) {
                  // Chỉ loại bỏ hash 5 ký tự nếu nó thực sự trông giống hash (có số)
                  cleanedName = cleanedName.replace(/[-\s_](?=[a-z]*[0-9])[a-z0-9]{5}$/gi, '');
                  const partsName = cleanedName.replace(/[_]/g, ' ').split(' ');
                  speakerName = partsName.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                  isFemale = guessGenderFromName(speakerName);
                } else {
                  speakerName = "Nhân vật";
                }
              }

              // Remove quotes from speech if wrapped
              let cleanSpeech = speech;
              if ((cleanSpeech.startsWith('"') && cleanSpeech.endsWith('"')) || 
                  (cleanSpeech.startsWith('“') && cleanSpeech.endsWith('”'))) {
                cleanSpeech = cleanSpeech.substring(1, cleanSpeech.length - 1);
              }

              if (cleanSpeech.trim() === "") {
                return null;
              }

              return (
                <DialogueBlock
                  key={index}
                  isPlayer={isPlayer}
                  speakerName={speakerName}
                  charIdentifier={charIdentifier}
                  speech={cleanSpeech}
                  emoji={emoji}
                  avatarUrl={avatarUrl}
                  isFemale={isFemale}
                  hairIndex={hairIndex}
                  faceIndex={resolvedFaceIndex}
                  playerGender={knowledgeBase?.worldConfig?.playerGender || "Nam"}
                  speakerNPCObj={speakerNPCObj}
                  parseAndHighlightText={parseAndHighlightText}
                />
              );
            }

            // Fallback for normal SFX
            return (
              <span
                key={index}
                className="inline-block mx-1 font-bold italic text-slate-400"
              >
                {innerContent}
              </span>
            );
          }

          const normalizedPart = part
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">");
          const tagMatch = normalizedPart.match(
            /^<(\w+)(?:\s+(.*?))?>(.*?)<\/\s*\1\s*>$/s,
          );

          if (tagMatch) {
            const tagName = tagMatch[1];
            const innerText = tagMatch[3];

            switch (tagName) {
              case "system_analysis":
                return <SystemAnalysisBlock key={index} innerText={innerText} />;
              case "system":
                return (
                  <div
                    key={index}
                    className="my-4 font-mono text-sm text-red-400"
                  >
                    <div className="font-semibold">{innerText}</div>
                  </div>
                );
              case "npc_thought":
              case "secret_action":
                return null;
              case "exp":
                return (
                  <span key={index} className="text-purple-400 italic">
                    "{innerText}"
                  </span>
                );
              case "thought":
                return (
                  <span key={index} className="text-cyan-300 italic">
                    "{innerText}"
                  </span>
                );
              case "status":
                return (
                  <span key={index} className="text-cyan-400 font-semibold">
                    {innerText}
                  </span>
                );
              case "important":
              case "entity":
                return (
                  <span key={index} className="text-cyan-400 font-semibold">
                    {innerText}
                  </span>
                );
              default:
                return part;
            }
          }

          const cleanText = part.replace(/<\/?\w+.*?>/g, "");
          const lines = cleanText.split("\n");

          return (
            <React.Fragment key={index}>
              {lines.map((line, lineIdx) => {
                if (!line.trim()) {
                  return <div key={lineIdx} className="h-1" />; // preserve some spacing
                }

                // Match dialogue only if it takes up the entire trimmed line (optional emoji + quotes) and has exactly one quote block in the line
                const dialogueMatch = line
                  .trim()
                  .match(
                    /^([\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{200D}\u{FE0F}]*)\s*([“"”][^“"”]*[”"“])$/u,
                  );

                if (dialogueMatch) {
                  let icon = dialogueMatch[1];
                  const speech = dialogueMatch[2];
                  
                  if (icon) {
                    icon = cleanEmojiString(icon);
                  }
                  
                  // Clean speech and check if it's purely a structural sound effect
                  const speechWithoutQuotes = speech.replace(/[“"”"‘'’]/g, "").trim();
                  const isSpeechSfx = /^((?:uỳnh|rầm|bùm|xoảng|bộp|chát|vút|ầm|phốc|cạch|két|phập|bạch|bịch|rắc|vù|vút|soạt|ào|oanh|oanh tạc|đoành|bùng|hộc|á|a|ư|ự|hự|xoẹt|vèo|vút)[\s!,.-]*)+$/i.test(speechWithoutQuotes);

                  if (isSpeechSfx) {
                    return (
                      <div key={lineIdx} className="my-2 select-text text-center">
                        <span className="font-bold italic text-slate-400 text-lg">
                          {speech}
                        </span>
                      </div>
                    );
                  }

                  const normalizeForMatch = (s: string) => 
                    s.normalize("NFD")
                     .replace(/[\u0300-\u036f]/g, "")
                     .toLowerCase()
                     .replace(/npc-(start-)?/g, "")
                     .replace(/[_]/g, " ")
                     .replace(/[-]/g, " ")
                     .trim();

                  const findBestNPCObj = (idOrName: string) => {
                    if (!knowledgeBase) return null;
                    const targetNorm = normalizeForMatch(idOrName);
                    const searchPool = [
                      ...(knowledgeBase.discoveredNPCs || []),
                      ...(knowledgeBase.wives || []),
                      ...(knowledgeBase.companions || []),
                      ...(knowledgeBase.slaves || []),
                      ...(knowledgeBase.prisoners || []),
                      knowledgeBase.master
                    ].filter(Boolean);

                    // Priority 1: Exact ID match
                    let match = searchPool.find(n => n.id === idOrName);
                    if (match) return match;

                    // Priority 2: Normalized Name match
                    match = searchPool.find(n => n.name && normalizeForMatch(n.name) === targetNorm);
                    if (match) return match;

                    // Priority 3: Normalized ID match
                    match = searchPool.find(n => n.id && normalizeForMatch(n.id) === targetNorm);
                    return match || null;
                  };

                  // Unidentified dialogue matched by quotes on normal text lines: We do not bind any existing NPC's avatar or data.
                  const speakerNPCObj = null;
                  const isFemale = false;
                  
                  // Lấy cảm xúc từ icon
                  let emotionFaceIndex: number | null = null;
                  if (icon && icon.length > 0) {
                      // Icon có thể chứa many emoji, ta quét để tìm cái đầu tiên match
                      for (const emoji of Array.from(icon)) {
                          const idx = getFaceIndexFromEmoji(emoji as string);
                          if (idx !== null) {
                              emotionFaceIndex = idx;
                              break;
                          }
                      }
                  }

                  const resolvedFaceIndex = emotionFaceIndex !== null 
                    ? emotionFaceIndex 
                    : (characterExpressionId || 0);

                  // Strip quotes from speech matched
                  let cleanSpeech = speech;
                  if ((cleanSpeech.startsWith('"') && cleanSpeech.endsWith('"')) || 
                      (cleanSpeech.startsWith('“') && cleanSpeech.endsWith('”'))) {
                    cleanSpeech = cleanSpeech.substring(1, cleanSpeech.length - 1);
                  }

                  if (cleanSpeech.trim() === "") {
                    return null;
                  }

                  return (
                    <DialogueBlock
                      key={lineIdx}
                      isPlayer={false}
                      speakerName="Nhân vật"
                      charIdentifier="fallback-npc"
                      speech={cleanSpeech}
                      emoji={icon || undefined}
                      avatarUrl={undefined}
                      isFemale={isFemale}
                      hairIndex={undefined}
                      faceIndex={resolvedFaceIndex}
                      playerGender={knowledgeBase?.worldConfig?.playerGender || "Nam"}
                      speakerNPCObj={null}
                      parseAndHighlightText={parseAndHighlightText}
                    />
                  );
                }

                const subParts = line.split(sfxRegex);

                return (
                  <div key={lineIdx} className="mb-2">
                    {subParts.map((subPart, subIndex) => {
                      if (subPart.match(sfxRegex)) {
                        return (
                          <span
                            key={subIndex}
                            className="inline-block mx-1 font-bold italic text-emerald-400/80"
                          >
                            {subPart}
                          </span>
                        );
                      }
                      return (
                        <span key={subIndex}>
                          {parseAndHighlightText ? parseAndHighlightText(subPart) : subPart}
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
        </div>
        
        {parsedData.backstageBlocks.length > 0 && (
          <div className="space-y-3 mt-4">
            <SystemAnalysisBlock 
              blocks={parsedData.backstageBlocks} 
            />
          </div>
        )}
      </div>
    );
  },
);

export default FormattedNarration;
