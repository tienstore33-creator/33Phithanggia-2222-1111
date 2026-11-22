/**
 * XML Update Parser for Phi Thăng Giả.
 * Extracts nested XML tags from AI's response inside <update_data>...</update_data>,
 * standalone XML blocks, or JSON arrays, and standardizes them into the system format.
 */

export interface XmlUpdateAction {
  type: string;
  params: Record<string, string>;
}

/**
 * Clean the <update_data> block from text to prevent showing XML to the user.
 */
export const cleanTextFromXmlUpdates = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/<update_data>[\s\S]*?(?:<\/update_data>|$)/gi, "")
    .replace(/<xml_updates>[\s\S]*?(?:<\/xml_updates>|$)/gi, "")
    .trim();
};

/**
 * Standardizes a key to its Vietnamese counterpart used by the game loop.
 */
const standardizeKey = (key: string): string => {
  const normalized = key.trim().toLowerCase();
  switch (normalized) {
    case "hp":
    case "sinhluc":
    case "sinh_luc":
      return "sinhLuc";
    case "mp":
    case "linhluc":
    case "linh_luc":
      return "linhLuc";
    case "exp":
    case "kinhnghiem":
    case "kinh_nghiem":
      return "kinhNghiem";
    case "gold":
    case "money":
    case "currency":
      return "currency";
    default:
      return key.trim();
  }
};

/**
 * Standardizes value strings for numeric modifications (e.g., "-15" -> "-=15", "+20" -> "+=20", "5" -> "+=5")
 */
const standardizeValue = (key: string, value: string): string => {
  const trimmed = value.trim();
  const stdKey = standardizeKey(key);
  
  if (["sinhLuc", "linhLuc", "kinhNghiem", "currency"].includes(stdKey)) {
    if (trimmed === "MAX") return "MAX";
    if (trimmed.startsWith("+=")) return trimmed;
    if (trimmed.startsWith("-=")) return trimmed;
    
    if (trimmed.startsWith("+")) {
      return "+=" + trimmed.substring(1);
    }
    if (trimmed.startsWith("-")) {
      return "-=" + trimmed.substring(1);
    }
    
    // Check if it's numeric
    const num = Number(trimmed);
    if (!isNaN(num)) {
      if (num >= 0) {
        return "+=" + trimmed;
      } else {
        return "-=" + Math.abs(num);
      }
    }
  }
  
  return trimmed;
};

/**
 * Parses nested child XML elements of a parent XML node.
 */
const parseChildElements = (xmlStr: string): Record<string, string> => {
  const result: Record<string, string> = {};
  const childRegex = /<([a-zA-Z0-9_]+)>([\s\S]*?)<\/\s*\1\s*>/gi;
  let match;
  
  while ((match = childRegex.exec(xmlStr)) !== null) {
    const tagName = match[1];
    const content = match[2];
    if (tagName) {
      result[tagName.trim()] = content.trim();
    }
  }
  
  return result;
};

/**
 * Parses XML attributes from a tag string (e.g. key1="val1" key2="val2")
 */
const parseAttributes = (attrStr: string): Record<string, string> => {
  const result: Record<string, string> = {};
  const attrRegex = /([a-zA-Z0-9_]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^>\s\/]+))/gi;
  let match;
  
  while ((match = attrRegex.exec(attrStr)) !== null) {
    const key = match[1];
    const val = match[2] || match[3] || match[4] || "";
    result[key.trim()] = val;
  }
  
  return result;
};

// Known XML tag names to support
const KNOWN_XML_TAGS = new Set([
  "NPC_CREATE", "NPC_UPDATE", "NPC_RENAME", "NPC_MOVE",
  "STATS_UPDATE", "PLAYER_SPECIAL_STATUS_UPDATE", "MC_RENAME",
  "ITEM_ACQUIRED", "ITEM_BOUGHT", "ITEM_CONSUMED", "ITEM_UPDATE",
  "SKILL_LEARNED", "SKILL_USED", "SKILL_UPDATE",
  "RELATIONSHIP_UPDATE", "APPEARANCE_UPDATE",
  "MAINLOCATION", "SUBLOCATION", "LOCATION_UPDATE", "LOCATION_CHANGE", "WORLD_LORE_ADD",
  "CHANGE_TIME", "QUEST_ASSIGNED", "QUEST_CHECK", "QUEST_UPDATED", "QUEST_COMPLETED",
  "EVENT_CHECK", "EVENT_COMPLETE", "ARC_RESOLVED",
  "PRISONER_ADD", "PRISONER_REMOVE", "PRISONER_UPDATE",
  "COMPANION_ADD", "WIFE_ADD", "SLAVE_ADD", "BECOMEFREE", "INTERACTION",
  "CORE_MEMORY_ADD", "BEGIN_COMBAT"
]);

/**
 * Parses the <update_data> block or raw XML snippets and converts nested tags into legacy [TAG_NAME: params] format.
 */
export const parseXmlUpdatesToLegacyTags = (text: string): string[] => {
  if (!text) return [];
  
  // 1. Determine the target XML content to scan
  let insideContent = text.trim();
  const updateBlockMatch = text.match(/<(?:update_data|xml_updates)>([\s\S]*?)(?:<\/(?:update_data|xml_updates)>|$)/i);
  if (updateBlockMatch && updateBlockMatch[1]) {
    insideContent = updateBlockMatch[1].trim();
  }
  
  const legacyTags: string[] = [];
  
  // Find all tag openings: <TAG_NAME ...> or <TAG_NAME .../>
  const tagRegex = /<([a-zA-Z0-9_]+)([^>]*?)>/gi;
  let match;
  
  while ((match = tagRegex.exec(insideContent)) !== null) {
    const tagNameRaw = match[1];
    const attrAndClosing = match[2] || "";
    const tagName = tagNameRaw.toUpperCase();
    
    // Skip if it's a closing tag (starts with /)
    if (tagNameRaw.startsWith("/")) continue;
    
    // Check if tagName is a known tag or if insideContent is a specific XML snippet
    const isKnownTag = KNOWN_XML_TAGS.has(tagName) || tagName.includes("_");
    if (!isKnownTag && !insideContent.startsWith("<" + tagNameRaw)) {
      continue;
    }
    
    let params: Record<string, string> = {};
    
    // 1. Parse inline attributes
    const attributes = parseAttributes(attrAndClosing);
    Object.assign(params, attributes);
    
    // 2. If it is NOT self-closing, find the matching closing tag and parse inner tags or content
    const isSelfClosing = attrAndClosing.trim().endsWith("/");
    if (!isSelfClosing) {
      const closingTagRegex = new RegExp(`<\\/\\s*${tagNameRaw}\\s*>`, "i");
      const subString = insideContent.substring(tagRegex.lastIndex);
      const closeMatch = subString.match(closingTagRegex);
      
      if (closeMatch && closeMatch.index !== undefined) {
        const innerContent = subString.substring(0, closeMatch.index).trim();
        // Update tagRegex.lastIndex to resume scanning after the closing tag
        tagRegex.lastIndex += closeMatch.index + closeMatch[0].length;
        
        // Parse child elements
        const children = parseChildElements(innerContent);
        if (Object.keys(children).length > 0) {
          Object.assign(params, children);
        } else if (innerContent && !innerContent.includes("<")) {
          // If it's a simple tag like <change_time>+3</change_time>, assign it to 'value'
          params["value"] = innerContent;
          if (tagName === "CHANGE_TIME") {
            if (innerContent.includes("ngày") || innerContent.includes("ngay")) {
              params["ngay"] = innerContent.replace(/[^0-9+\-=]/g, "");
            } else {
              params["canh"] = innerContent.replace(/[^0-9+\-=]/g, "");
            }
          }
        }
      }
    }
    
    // Standardize keys and values
    const standardizedParams: Record<string, string> = {};
    for (const [key, val] of Object.entries(params)) {
      const stdKey = standardizeKey(key);
      const stdVal = standardizeValue(key, val);
      standardizedParams[stdKey] = stdVal;
    }
    
    // Build legacy format string
    // e.g. [NPC_CREATE: name="A Thiết" gender="Nam" description="Vệ binh" personality="Nghiêm túc" realm="Nhị Chuyển Cổ Sư Tầng 5"]
    const paramStrings = Object.entries(standardizedParams)
      .map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`)
      .join(" ");
      
    const legacyTag = paramStrings 
      ? `[${tagName}: ${paramStrings}]` 
      : `[${tagName}]`;
      
    legacyTags.push(legacyTag);
  }
  
  return legacyTags;
};

