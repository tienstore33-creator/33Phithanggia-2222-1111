import React, { useState } from "react";
import {
  KnowledgeBase,
  NPC,
  GameLocation,
  WorldLoreEntry,
  Faction,
  Companion,
  YeuThu,
} from "../../types";
import { VIETNAMESE, ALL_REALMS_LIST } from "../../constants";
import WorldInfoList from "../ui/WorldInfoList";
import { getEffectiveRealmSystem } from '../../services/realmManager';
import { getDeterministicAvatarSrc } from "../../utils/avatarUtils";
import { isShopVendor } from "../../utils/npcHelper";
import DynamicAvatar from "../DynamicAvatar";
import { MoveRight } from "lucide-react";
import { useGame } from "../../hooks/useGame";
import Button from "../ui/Button";
import Modal from "../ui/Modal";

interface WorldSidePanelProps {
  knowledgeBase: KnowledgeBase;
  onNpcClick: (npc: NPC) => void;
  onYeuThuClick: (yeuThu: YeuThu) => void;
  onLocationClick: (location: GameLocation) => void;
  onLoreClick: (lore: WorldLoreEntry) => void;
  onFactionClick: (faction: Faction) => void;
  onCompanionClick: (companion: Companion) => void;
}

type WorldSection =
  | "npc"
  | "yeuthu"
  | "companion"
  | "location"
  | "faction"
  | "lore";

const AccordionItem: React.FC<{
  title: string;
  isOpen: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}> = ({ title, isOpen, onClick, count, children }) => {
  return (
    <div className="border-b border-gray-700 last:border-0">
      <button
        onClick={onClick}
        className={`w-full flex justify-between items-center p-3 text-left transition-colors duration-200 ${
          isOpen
            ? "bg-indigo-900/40 text-indigo-300"
            : "bg-gray-800 hover:bg-gray-750 text-gray-300"
        }`}
      >
        <span className="font-semibold text-sm">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-gray-900/50 px-2 py-0.5 rounded-full text-gray-400">
            {count}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>
      {isOpen && (
        <div className="p-2 bg-gray-900/30 animate-fade-in">{children}</div>
      )}
    </div>
  );
};

const WorldSidePanel: React.FC<WorldSidePanelProps> = ({
  knowledgeBase,
  onNpcClick,
  onYeuThuClick,
  onLocationClick,
  onLoreClick,
  onFactionClick,
  onCompanionClick,
}) => {
  const [activeSection, setActiveSection] = useState<WorldSection | null>(
    "npc",
  );
  const { onResetAllAvatars } = useGame();

    const game = useGame();
  const toggleSection = (section: WorldSection) => {
    setActiveSection((prev) => (prev === section ? null : section));
  };

  const allVisibleNpcs = React.useMemo(() => {
    const npcMap = new Map<string, NPC>();
    knowledgeBase.discoveredNPCs.forEach((npc) => npcMap.set(npc.id, npc));
    knowledgeBase.wives.forEach((wife) => {
      if (!npcMap.has(wife.id)) {
        npcMap.set(wife.id, wife as unknown as NPC);
      }
    });
    return Array.from(npcMap.values());
  }, [knowledgeBase.discoveredNPCs, knowledgeBase.wives]);

  
    const handleNormalizeRealms = (e: React.MouseEvent) => {
        e.stopPropagation();
        const realmSystem = getEffectiveRealmSystem(knowledgeBase);
        const validRealms = new Set<string>();
        realmSystem.majorRealms.forEach(major => {
            validRealms.add(major);
            realmSystem.minorRealms.forEach(minor => {
                validRealms.add(major + ' ' + minor);
            });
        });
        
        const wrongNpcs = allVisibleNpcs.filter(c => !validRealms.has(c.realm));
        
        if (wrongNpcs.length > 0) {
            game.showNotification(`Đang tiến hành chuẩn hóa cảnh giới cho ${wrongNpcs.length} nhân vật...`, "info");
        } else {
            game.showNotification("Đang kiểm tra và chuẩn hóa chỉ số nhân vật...", "info");
        }
        
        game.normalizeNpcRealms(wrongNpcs as any[]);
    };

  const currentRealm = knowledgeBase.worldRealmBase || "Phàm Nhân";

  const getNextRealm = (current: string) => {
    const allRealms = ALL_REALMS_LIST;
    const currentIndex = allRealms.indexOf(current);
    if (currentIndex !== -1 && currentIndex < allRealms.length - 1) {
      return allRealms[currentIndex + 1];
    }
    return null;
  };

  const nextRealm = getNextRealm(currentRealm);

  // Tính toán tiến trình dựa trên mốc lượt tiến hóa cuối cùng
  const lastEvo = knowledgeBase.lastWorldEvolutionTurn || 0;
  const turnsSinceLastEvo = Math.max(
    0,
    knowledgeBase.playerStats.turn - lastEvo,
  );
  const INTERVAL = 10;
  const evolutionProgress = Math.min(
    100,
    Math.floor((turnsSinceLastEvo / INTERVAL) * 100),
  );

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-y-auto custom-scrollbar">
      <div className="p-3 border-b border-gray-700 bg-gray-900/50">
        <h3 className="font-semibold text-sm text-gray-300 mb-2">
          &gt;&gt; TRẠNG THÁI THẾ GIỚI
        </h3>
        <div className="text-xs text-gray-400 space-y-2">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-gray-400 text-xs">Nền cảnh giới:</span>
              <div className="flex items-center gap-1.5 bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700">
                <span className="text-sky-400 font-medium">{currentRealm}</span>
                {nextRealm && (
                  <>
                    <MoveRight size={12} className="text-gray-500" />
                    <span className="text-amber-400/80 font-medium">
                      {nextRealm}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-[10px]">Tiến hóa:</span>
              <div className="flex-grow bg-gray-700 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-500 h-full transition-all duration-500"
                  style={{ width: `${evolutionProgress}%` }}
                ></div>
              </div>
              <span className="text-[10px] text-gray-500">
                {evolutionProgress}%
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-700">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onResetAllAvatars();
                }}
                className="w-full text-[10px] sm:text-xs"
              >
                Khởi tạo lại Avatar bằng AI (Nữ)
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <AccordionItem
        title={VIETNAMESE.discoveredNPCsSection}
        count={allVisibleNpcs.length}
        isOpen={activeSection === "npc"}
        onClick={() => toggleSection("npc")}
      >
        {activeSection === "npc" && (
            <div className="px-3 pb-2 pt-1 border-b border-gray-800">
                <button 
                    onClick={handleNormalizeRealms}
                    className="w-full text-xs py-1.5 bg-blue-900/50 hover:bg-blue-800 text-blue-200 rounded border border-blue-700/50 transition-colors"
                >
                    Chuẩn Hoá Thực Lực 
                </button>
            </div>
        )}
        <WorldInfoList

          items={allVisibleNpcs}
          onItemClick={onNpcClick}
          emptyMessage={VIETNAMESE.noNPCsDiscovered}
          getItemDisplay={(npc: NPC) => {
            const isWife = npc.relationshipToPlayer === "Vợ chồng" || knowledgeBase.wives.some((w) => w.id === npc.id);
            const isFemale = npc.gender?.toLowerCase().includes("nữ");
            return (
              <div className="flex items-center w-full">
                <div className="w-8 h-8 rounded-full mr-2 flex-shrink-0 overflow-hidden border border-gray-600 bg-gray-900 border-indigo-500">
                  {isFemale && !npc.avatarUrl ? (
                    <DynamicAvatar hairIndex={npc.avatarHairId ?? 0} faceIndex={npc.avatarFaceId ?? 0} size={32} />
                  ) : (
                    <img
                      src={getDeterministicAvatarSrc(npc)}
                      alt={npc.name}
                      className={`w-full h-full object-cover ${isWife ? "border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" : ""}`}
                    />
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`truncate font-medium ${isWife ? "text-amber-400" : "text-indigo-200"}`}
                    >
                      {isWife ? `🌟 ${npc.name} 🌟` : npc.name}
                    </span>
                    {isShopVendor(npc) && (
                      <span className="flex-shrink-0 text-[9px] font-bold px-1 py-0.2 rounded bg-amber-950 text-amber-400 border border-amber-800">
                        🏪 Chủ Tiệm
                      </span>
                    )}
                  </div>
                  <span className="block truncate text-xs text-gray-500">
                    {npc.race && npc.race !== "Nhân Tộc"
                      ? `${npc.race} - `
                      : ""}
                    {npc.realm || "Phàm Nhân"}{npc.status ? ` [${npc.status}]` : ""}
                  </span>
                </div>
              </div>
            );
          }}
          getItemTitleString={(npc: NPC) => {
            const isWife = npc.relationshipToPlayer === "Vợ chồng" || knowledgeBase.wives.some((w) => w.id === npc.id);
            return `${isWife ? `🌟 ${npc.name} 🌟` : npc.name} - ${npc.realm}`;
          }}
        />
      </AccordionItem>

      <AccordionItem
        title="Yêu Thú Đã Gặp"
        count={knowledgeBase.discoveredYeuThu.length}
        isOpen={activeSection === "yeuthu"}
        onClick={() => toggleSection("yeuthu")}
      >
        <WorldInfoList
          items={knowledgeBase.discoveredYeuThu}
          onItemClick={onYeuThuClick}
          emptyMessage={"Chưa gặp yêu thú nào."}
          getItemDisplay={(yt: YeuThu) => {
            const isFemale = (yt as any).gender?.toLowerCase().includes("nữ");
            return (
              <div className="flex items-center w-full">
                <div className="w-8 h-8 rounded-full mr-2 flex-shrink-0 overflow-hidden border border-gray-600 bg-gray-900 border-red-500">
                  {isFemale && !yt.avatarUrl ? (
                    <DynamicAvatar hairIndex={yt.avatarHairId ?? 0} faceIndex={yt.avatarFaceId ?? 0} size={32} />
                  ) : (
                    <img
                      src={getDeterministicAvatarSrc(yt)}
                      alt={yt.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <span className="block truncate font-medium text-red-300">
                    {yt.name}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {yt.species} - {yt.realm}
                  </span>
                </div>
              </div>
            );
          }}
          getItemTitleString={(yt: YeuThu) =>
            `${yt.name} (${yt.species}) ${yt.realm ? `[${yt.realm}]` : ""}`
          }
        />
      </AccordionItem>

      <AccordionItem
        title={VIETNAMESE.companionsSection}
        count={knowledgeBase.companions.length}
        isOpen={activeSection === "companion"}
        onClick={() => toggleSection("companion")}
      >
        <WorldInfoList
          items={knowledgeBase.companions}
          onItemClick={onCompanionClick}
          emptyMessage={VIETNAMESE.noCompanions}
          getItemDisplay={(comp: Companion) => (
            <div className="flex justify-between w-full">
              <span className="text-indigo-300">{comp.name}</span>
              <span className="text-xs text-gray-500">
                HP: {comp.hp}/{comp.maxHp}
              </span>
            </div>
          )}
          getItemTitleString={(comp: Companion) => `${comp.name}`}
        />
      </AccordionItem>

      <AccordionItem
        title={VIETNAMESE.discoveredLocationsSection}
        count={knowledgeBase.discoveredLocations.length}
        isOpen={activeSection === "location"}
        onClick={() => toggleSection("location")}
      >
        <WorldInfoList
          items={knowledgeBase.discoveredLocations}
          onItemClick={onLocationClick}
          emptyMessage={VIETNAMESE.noLocationsDiscovered}
          getItemDisplay={(loc: GameLocation) => (
            <div>
              <span className={`block ${loc.isSafeZone ? 'text-green-300' : 'text-red-300'}`}>{loc.name}</span>
              <span className="block text-xs text-gray-500">
                {loc.locationType || "Địa điểm"}{" "}
                {loc.regionId ? `- ${loc.regionId}` : ""}
              </span>
            </div>
          )}
          getItemTitleString={(loc: GameLocation) =>
            `${loc.name}${loc.regionId ? ` (${loc.regionId})` : ""}`
          }
        />
      </AccordionItem>

      <AccordionItem
        title="Phe Phái Đã Biết"
        count={knowledgeBase.discoveredFactions.length}
        isOpen={activeSection === "faction"}
        onClick={() => toggleSection("faction")}
      >
        <WorldInfoList
          items={knowledgeBase.discoveredFactions}
          onItemClick={onFactionClick}
          emptyMessage={"Chưa khám phá phe phái nào."}
          getItemDisplay={(faction: Faction) => (
            <div>
              <span className="block text-yellow-200">{faction.name}</span>
              <span className="block text-xs text-gray-500">
                {faction.alignment} (Uy tín: {faction.playerReputation})
              </span>
            </div>
          )}
          getItemTitleString={(faction: Faction) =>
            `${faction.name} (${faction.alignment}, Uy tín: ${faction.playerReputation})`
          }
        />
      </AccordionItem>

      <AccordionItem
        title={VIETNAMESE.worldLoreSection}
        count={knowledgeBase.worldLore.length}
        isOpen={activeSection === "lore"}
        onClick={() => toggleSection("lore")}
      >
        <WorldInfoList
          items={knowledgeBase.worldLore}
          onItemClick={onLoreClick}
          emptyMessage={VIETNAMESE.noWorldLore}
          getItemDisplay={(lore: WorldLoreEntry) => (
            <span className="text-cyan-200">{lore.title}</span>
          )}
          getItemTitleString={(lore: WorldLoreEntry) => lore.title}
        />
      </AccordionItem>
    </div>
  );
};

export default WorldSidePanel;
