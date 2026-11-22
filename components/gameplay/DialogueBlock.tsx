import React from "react";
import DynamicAvatar from "../DynamicAvatar";
import { getDeterministicAvatarSrc } from "../../utils/avatarUtils";
import { getFaceIndexFromEmoji } from "../../utils/emotionMapper";
import { useGame } from "../../hooks/useGame";

interface DialogueBlockProps {
  isPlayer: boolean;
  speakerName: string;
  charIdentifier: string;
  speech: string;
  emoji?: string;
  avatarUrl?: string;
  isFemale: boolean;
  hairIndex?: number;
  faceIndex?: number;
  playerGender: string;
  speakerNPCObj?: any;
  parseAndHighlightText?: (text: string) => React.ReactNode[];
}

const DialogueBlock: React.FC<DialogueBlockProps> = ({
  isPlayer,
  speakerName,
  charIdentifier,
  speech,
  emoji,
  avatarUrl,
  isFemale,
  hairIndex,
  faceIndex,
  playerGender,
  speakerNPCObj,
  parseAndHighlightText,
}) => {
  const [imgError, setImgError] = React.useState(false);
  const { styleSettings } = useGame();

  const renderAvatar = () => {
    // 0. If it is unclear who is speaking, return null to leave it empty
    const isFallbackOrUnknown = !charIdentifier || charIdentifier === "fallback-npc" || charIdentifier === "unknown";
    if (!isPlayer && !speakerNPCObj && isFallbackOrUnknown) {
      return null;
    }

    const isActuallyFemale = isFemale || !!speakerNPCObj?.gender?.toLowerCase().includes("nữ");
    const borderColor = isPlayer ? "border-indigo-500" : (isActuallyFemale ? "border-rose-400" : "border-emerald-500");

    const scale = styleSettings?.avatarScale ?? 1.0;
    const size = Math.round(84 * scale);

    // 1. If character has a custom uploaded avatar URL, render dual avatars (uploaded avatar + emotional face)
    if (avatarUrl && !imgError) {
      const dualSize = Math.max(54, Math.round(size * 0.82));
      const hair = (speakerNPCObj?.avatarHairId !== undefined) ? speakerNPCObj.avatarHairId : (isPlayer ? hairIndex : (isActuallyFemale ? 0 : 0));
      const faceFromEmoji = emoji ? getFaceIndexFromEmoji(emoji) : null;
      const face = faceFromEmoji ?? faceIndex ?? speakerNPCObj?.avatarFaceId ?? 0;

      return (
        <div className="flex items-center gap-2">
          {/* Avatar 1: Ảnh tải lên */}
          <div 
            style={{ width: `${dualSize}px`, height: `${dualSize}px` }}
            className={`overflow-hidden rounded-xl border-2 ${borderColor} bg-gray-950 flex items-center justify-center relative shadow-md shrink-0`}
            title={`${speakerName} (Ảnh đại diện)`}
          >
            <img
              src={avatarUrl}
              alt={speakerName}
              referrerPolicy="no-referrer"
              style={{ transform: `scale(${1.3 * (styleSettings?.avatarFaceScale ?? 1.0)})` }}
              className="w-full h-full object-cover object-center origin-center transition-all duration-300"
              onError={() => setImgError(true)}
            />
          </div>

          {/* Avatar 2: Khuôn mặt biểu cảm theo cảm xúc */}
          <div 
            style={{ width: `${dualSize}px`, height: `${dualSize}px` }}
            className={`overflow-hidden rounded-xl border-2 ${borderColor} bg-gray-950 flex items-center justify-center relative shadow-md shrink-0`}
            title={`Biểu cảm: ${emoji || 'Bình thường'}`}
          >
            {hair !== undefined ? (
              <DynamicAvatar 
                hairIndex={hair} 
                faceIndex={face} 
                size={dualSize} 
                zoomMode={true}
                faceScale={styleSettings?.avatarFaceScale ?? 1.0}
              />
            ) : (
              <div style={{ fontSize: `${Math.round(28 * scale)}px` }} className="flex items-center justify-center w-full h-full">
                {emoji || "😶"}
              </div>
            )}
          </div>
        </div>
      );
    }

    // 2. Resolve final indices with priority: speaker object > passed props
    // We only show the DynamicAvatar if the character has at least a defined hair ID from their profile.
    // Otherwise, we fallback to the requested blank emoji 😶 to avoid random/misleading appearances.
    const hair = (speakerNPCObj?.avatarHairId !== undefined) ? speakerNPCObj.avatarHairId : (isPlayer ? hairIndex : undefined);
    
    // If we have hair (meaning it's a known character with visual data), we can render the dynamic avatar.
    if (hair !== undefined) {
      const faceFromEmoji = emoji ? getFaceIndexFromEmoji(emoji) : null;
      const face = faceFromEmoji ?? faceIndex ?? speakerNPCObj?.avatarFaceId ?? 0;

      return (
        <div 
          style={{ width: `${size}px`, height: `${size}px` }}
          className={`overflow-hidden rounded-xl border-2 ${borderColor} bg-gray-950 flex items-center justify-center`}
        >
          <DynamicAvatar 
            hairIndex={hair} 
            faceIndex={face} 
            size={size} 
            zoomMode={true}
            faceScale={styleSettings?.avatarFaceScale ?? 1.0}
          />
        </div>
      );
    }

    // Final fallback: just show the emoji for characters without visual data
    return (
      <div 
        style={{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(36 * scale)}px` }}
        className={`rounded-xl border-2 ${borderColor} bg-gray-900 flex items-center justify-center shadow-inner shadow-black/40`}
      >
        😶
      </div>
    );
  };

  const avatar = renderAvatar();

  return (
    <div className="my-6 select-text flex flex-col gap-2">
      {/* 1. VN Style Top Bar: Avatar & Character Info */}
      <div className="flex items-center gap-3">
        {/* Avatar Container */}
        {avatar && (
          <div className="shrink-0 relative">
            {avatar}
          </div>
        )}

        {/* Name and Emotion Indicator */}
        <div className="flex flex-col justify-center">
          <span className={`text-base font-bold tracking-wide ${
            isPlayer ? "text-indigo-400" : (isFemale || speakerNPCObj?.gender?.toLowerCase().includes("nữ") ? "text-rose-300" : "text-emerald-400")
          }`}>
            {speakerName}
          </span>
          {emoji && (
            <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 bg-slate-800/80 px-2 py-0.5 rounded-full w-fit">
              Tâm trạng: <span className="text-sm">{emoji}</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Simplified Distinct Conversation Text without borders/bubbles */}
      <div className="py-1 leading-relaxed text-teal-100">
        <p className="italic text-[17.6px] md:text-[18.7px] tracking-wide font-medium font-serif">
          “{parseAndHighlightText ? parseAndHighlightText(speech) : speech}”
        </p>
      </div>
    </div>
  );
};

export default React.memo(DialogueBlock);
