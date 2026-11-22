export interface FactionChangeRecord {
  target: string;
  newFaction: 'enemy' | 'ally' | 'neutral';
}

export interface SummonAllyRecord {
  id: string;
  name: string;
  sinhLuc: number;
  maxSinhLuc: number;
  linhLuc: number;
  maxLinhLuc: number;
  sucTanCong: number;
  faction: 'ally' | 'enemy' | 'neutral';
  realm?: string;
  species?: string;
}

export function parseFactionChanges(text: string): { 
  cleanText: string; 
  changes: FactionChangeRecord[];
  summons: SummonAllyRecord[];
} {
  const changes: FactionChangeRecord[] = [];
  const summons: SummonAllyRecord[] = [];
  let cleanText = text;

  // Regex to match [CHUYEN_PHE: target="..." to="..."] or [FACTION_CHANGE: target="..." faction="..."]
  const regex = /\[(?:CHUYEN_PHE|FACTION_CHANGE)\s*:\s*target=["']?([^"',\]]+)["']?(?:[,\s]+\b(?:faction|to)=["']?([^"'\]]+)["']?)?\s*\]/gi;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    const target = match[1].trim();
    const toRaw = (match[2] || 'ally').trim().toLowerCase();
    
    let newFaction: 'enemy' | 'ally' | 'neutral' = 'ally';
    if (toRaw.includes('enemy') || toRaw.includes('địch') || toRaw.includes('đối địch')) {
      newFaction = 'enemy';
    } else if (toRaw.includes('ally') || toRaw.includes('đồng minh') || toRaw.includes('ta') || toRaw.includes('phía ta') || toRaw.includes('phe ta')) {
      newFaction = 'ally';
    } else if (toRaw.includes('neutral') || toRaw.includes('trung lập')) {
      newFaction = 'neutral';
    }

    changes.push({ target, newFaction });
  }

  // Regex to match [SUMMON_ALLY: name="..." hp="..." mp="..." atk="..." faction="..."]
  const summonRegex = /\[SUMMON_ALLY\s*:\s*name=["']?([^"',\]]+)["']?(?:[,\s]+hp=["']?([^"',\]]+)["']?)?(?:[,\s]+mp=["']?([^"',\]]+)["']?)?(?:[,\s]+atk=["']?([^"',\]]+)["']?)?(?:[,\s]+faction=["']?([^"',\]]+)["']?)?\s*\]/gi;

  let summonMatch;
  while ((summonMatch = summonRegex.exec(text)) !== null) {
    const name = summonMatch[1].trim();
    const hpStr = (summonMatch[2] || '50000').replace(/[,.]/g, '');
    const mpStr = (summonMatch[3] || '20000').replace(/[,.]/g, '');
    const atkStr = (summonMatch[4] || '10000').replace(/[,.]/g, '');
    const factionRaw = (summonMatch[5] || 'ally').trim().toLowerCase();

    let faction: 'ally' | 'enemy' | 'neutral' = 'ally';
    if (factionRaw.includes('enemy') || factionRaw.includes('địch')) {
      faction = 'enemy';
    } else if (factionRaw.includes('neutral') || factionRaw.includes('trung lập')) {
      faction = 'neutral';
    }

    const hp = parseInt(hpStr, 10) || 50000;
    const mp = parseInt(mpStr, 10) || 20000;
    const atk = parseInt(atkStr, 10) || 10000;

    summons.push({
      id: `summon-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name,
      sinhLuc: hp,
      maxSinhLuc: hp,
      linhLuc: mp,
      maxLinhLuc: mp,
      sucTanCong: atk,
      faction,
      realm: 'Triệu Hồi Thể',
      species: 'Đồng Minh Triệu Hồi'
    });
  }

  // Remove the tags from cleanText
  cleanText = cleanText
    .replace(/\[(?:CHUYEN_PHE|FACTION_CHANGE)\s*:[^\]]+\]/gi, '')
    .replace(/\[SUMMON_ALLY\s*:[^\]]+\]/gi, '');

  return { cleanText, changes, summons };
}
