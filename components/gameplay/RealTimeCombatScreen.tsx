import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { KnowledgeBase, CombatEndPayload, Combatant, DefeatedEntity, PlayerStats, ProficiencyTier, OfflineCombatSkill, Skill, StatusEffect, CombatDispositionMap, Item, OfflineCombatEffect } from '../../types';
import { calculateFinalDamage, parseCombatPassives, calculateExpBonus } from '../../utils/combatPassiveUtils';
import { getHpFormulaExplanation } from '../../utils/statsCalculationUtils';
import { handleStatusLogic, hasStatus } from '../../utils/combatStatusManager';
import { formatNumberDot } from '../../utils/combatDataSanitizer';
import { generateEquipment } from '../../utils/equipmentGenerator';
import { motion, AnimatePresence } from 'motion/react';
import { handleAuraFarmingBurst, updateAuraFarmingTimer, handleAuraFarmingBossAttack, handleAuraFarmingProjectileUpdate, handleAuraFarmingExplosion } from '../../utils/auraFarming';
import { VIETNAMESE, PROFICIENCY_DMG_HEAL_MULTIPLIERS, MAX_COMBAT_COMPANIONS } from '../../constants';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { useGame } from '../../hooks/useGame';
import { determineDefeatOutcome } from '../../src/logic/combatDefeatHandler';
import { audioService } from '../../src/services/AudioService';
import { getApiSettings } from '../../services/apiService';
import { SkillType, COMBAT_MODE_SKILLS } from '../../templates';
import { DynamicCanvasEffect } from '../DynamicCanvasEffect';
import { calculateNpcAiMovement, calculateAllyDefenseMovement, findEnemyInAttackRange } from '../../utils/combatAiMovement';
import { extractLootFromDefeatedEntities } from '../../utils/postCombatLootService';
import { performAllySwap, updateRetreatingAndEnteringPhysics } from '../../src/utils/realTimeSwapHelper';
import {
    isLoiLongGiangThe,
    isBangHoangPha,
    isLietHoaPhanThien,
    isPhaGiapKich,
    getSkillCooldownMs,
    getSkillCooldownSeconds,
    castLoiLongGiangThe,
    castBangHoangPha,
    castLietHoaPhanThien,
    updateCustomSkillProjectiles,
    updateEntityBurnDoT
} from '../../src/utils/combatSkillAnimations';

// Utils
const getMutableStats = (c: Combatant | undefined): Partial<PlayerStats> & { activeStatusEffects?: StatusEffect[] } | undefined => {
    if (!c) return undefined;
    if (c.entityType === 'player') return c as Partial<PlayerStats>;
    if (!(c as any).stats) (c as any).stats = {};
    if (!(c as any).stats.activeStatusEffects) (c as any).stats.activeStatusEffects = [];
    return (c as any).stats;
};

const getSkillDescriptionWithCore = (skill: Skill | undefined): string => {
    if (!skill) return '';
    let desc = skill.description || '';
    if (skill.coreSkillName) {
        const descLower = desc.toLowerCase();
        const coreLower = skill.coreSkillName.toLowerCase();
        if (!descLower.includes('lõi là') && !descLower.includes('cốt lõi')) {
            desc = `${desc} (lõi là ${coreLower})`;
        }
    }
    return desc;
};

// Physics and Game Types
export interface RTEntity {
    id: string;
    combatant: Combatant;
    isPlayer: boolean;
    isAlly: boolean;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    globalCooldown: number;
    speed: number;
    attackRange: number;
    attackCooldown: number;
    maxAttackCooldown: number;
    hp: number;
    maxHp: number;
    isDead: boolean;
    attackType?: 'melee' | 'ranged';
    attackTypeSwapTimer?: number;
    rangedAttackCount?: number;
    rangedProjectiles?: number;
    // AI decision state
    aiDecisionTimer: number;
    circleDir: number; // 1 or -1
    dodgeTimer: number;
    // Shield
    shieldTimer: number;
    shieldCd: number;
    // Power ups
    isBoss?: boolean;
    isEnraged?: boolean;
    bossSkillTimer?: number;
    bossSkillPhase?: 'idle' | 'telegraph' | 'action';
    bossSkillType?: 'bullet_hell' | 'aoe_slam' | 'dash' | 'laser' | 'summon' | 'lightning' | 'shield';
    bossTelegraphPos?: {x: number, y: number};
    bossTelegraphRadius?: number;
    currentLaserAngle?: number; // Track current angle for rotating laser
    hasSizeScaled?: boolean;
    bossRewardProcessed?: boolean;
    hasTriggeredSuperBeastBomb?: boolean;
    // Environment
    isObstacle?: boolean;
    emoji?: string;
    isQueued?: boolean;
    isRetreatingToReserve?: boolean;
    isEnteringBattle?: boolean;
    targetX?: number;
    targetY?: number;
    powerScore?: number;
    // AI Mode
    aiMode?: 'combat' | 'cover';
    aiModeTimer?: number;
    // Separate Skill CD
    skillCooldown?: number;
    // Status Effects
    stunTimer?: number;
    slowTimer?: number;
    slowRate?: number;
    burnDoTTimer?: number;
    burnDoTTickTimer?: number;
    burnDoTDamage?: number;
    burnDoTSourceId?: string;
    poisonTimer?: number;
    poisonSourceId?: string;
    poisonTickTimer?: number;
    thuTimer?: number;
    tocTimer?: number;
    hoanTimer?: number;
    docTimer?: number;
    docTickTimer?: number;
    camTimer?: number;
    phaTimer?: number;
    lastLaserHitTime?: number;
    // Aura Farming
    burstPoints?: number;
    auraFarmingTimer?: number;
    auraFarmingModel?: 'garou';
    isSummoned?: boolean;
    lastHitBy?: { id: string, name: string };
    totalDamageDealt?: number;
    killCount?: number;
    channelTimer?: number;
    maxChannelTimer?: number;
    channelSkillName?: string;
    channelSkillCoreName?: string;
    channelSkillPower?: number;
    beastBombAirborneTimer?: number;
    beastBombLandTimer?: number;
    beastBombStartX?: number;
    beastBombStartY?: number;
    beastBombTargetX?: number;
    beastBombTargetY?: number;
}

export interface RTProjectile {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    targetId: string;
    sourceId: string;
    damage: number;
    isHeal?: boolean;
    healAmount?: number;
    isCrit: boolean;
    color: string;
    life: number;
    maxLife?: number;
    emoji?: string;
    skillName?: string;
    coreSkillName?: string;
    isExplosive?: boolean;
    isShard?: boolean;
    isUltimateStrike?: boolean;
    baseSize?: number;
    isLaser?: boolean;
    isManhKich?: boolean;
    isPiercing?: boolean;
    isArcWave?: boolean;
    isDebuffWave?: boolean;
    isExpandingCircle?: boolean;
    isLifesteal?: boolean;
    lifestealRatio?: number; // Tỉ lệ hút máu thực tế (từ passive)
    isAttached?: boolean;
    drainTimer?: number;
    hitIds?: string[];
    effect?: OfflineCombatEffect;
    // Aura Farming projectiles
    isAuraFarmingAttack?: boolean;
    distanceTraveled?: number;
    startX?: number;
    startY?: number;
    isOrbiting?: boolean;
    orbitingCenterId?: string;
    isBeastBomb?: boolean;
    targetX?: number;
    targetY?: number;
    arcProgress?: number;
    scaleMultiplier?: number;
    isPierceAll?: boolean;
    isLoiLongWave?: boolean;
    isBangHoangWave?: boolean;
    isLietHoaFall?: boolean;
    casterId?: string;
    baseAngle?: number;
    wobblePhase?: number;
    wobbleAmp?: number;
    wobbleFreq?: number;
    spinSpeed?: number;
    spiralDuration?: number;
    orbitDuration?: number;
    initialRadius?: number;
    targetOrbitRadius?: number;
    lastHitTimes?: Record<string, number>;
    aoeRadius?: number;
    dotDamage?: number;
    dotDuration?: number;
    slowRate?: number;
    slowDuration?: number;
}

interface RTAura {
    id: string;
    casterId: string;
    type: 'HEAL' | 'SHIELD';
    radius: number; // 150px (300px diameter)
    duration: number; // 5000ms
    maxDuration: number;
    tickTimer: number; // 1000ms for healing tick
    healPerTick: number;
    hp: number; // Shield HP (300% Caster MaxHP)
    maxHp: number;
    color: string;
    skillName?: string;
}

interface RTVfx {
    id: string;
    text: string;
    x: number;
    y: number;
    color: string;
    life: number;
    maxLife: number;
    isImage?: boolean;
    rotation?: number;
    scale?: number;
    isEnemySlash?: boolean;
    // Afterimage fields
    isAfterimage?: boolean;
    entityType?: 'player' | 'ally' | 'enemy' | 'boss';
    radius?: number;
    wobble?: number;
    facingLeft?: boolean;
    isBoss?: boolean;
}

interface CombatScreenProps {
  knowledgeBase: KnowledgeBase;
  onCombatEnd: (result: CombatEndPayload) => Promise<void>;
  currentPageMessagesLog: string;
  previousPageSummaries: string[];
  lastNarrationFromPreviousPage?: string;
}

const RT_FPS = 60;
const RT_DT = 1000 / RT_FPS;

export default function RealTimeCombatScreen({ knowledgeBase, onCombatEnd, currentPageMessagesLog, previousPageSummaries, lastNarrationFromPreviousPage }: CombatScreenProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { setCurrentScreen, setKnowledgeBase, handleCombatEndSpecificOutcome } = useGame();
    const slashImageRef = useRef<HTMLImageElement | null>(null);
    const bulletImageRef = useRef<HTMLImageElement | null>(null);
    const originalEnemySkillsRef = useRef<Record<string, { skills?: any[], playerSkills?: any[] }>>({});
    const originalAllySkillsRef = useRef<Record<string, { skills?: any[], playerSkills?: any[] }>>({});

    const restoreOriginalEnemySkills = useCallback(() => {
        if (!originalEnemySkillsRef.current || Object.keys(originalEnemySkillsRef.current).length === 0) return;
        console.log('[COMBAT_BALANCE] Restoring original skills for enemy NPCs...');
        
        const backupMap = { ...originalEnemySkillsRef.current };
        originalEnemySkillsRef.current = {};

        // Restore in state.current.entities
        state.current.entities.forEach(e => {
            if (!e.isAlly && e.combatant && !e.isObstacle) {
                const c = e.combatant as any;
                const orig = backupMap[c.id] || backupMap[c.id.replace(/^enemy_\d+_/, '')];
                if (orig) {
                    if (orig.skills !== undefined) c.skills = [...orig.skills];
                    if (orig.playerSkills !== undefined) c.playerSkills = [...orig.playerSkills];
                }
            }
        });

        // Restore in knowledgeBase
        setKnowledgeBase(prev => {
            const updatedNPCs = prev.discoveredNPCs.map(npc => {
                const orig = backupMap[`real_${npc.id}`] || backupMap[npc.id];
                if (orig) {
                    return {
                        ...npc,
                        skills: orig.skills ? [...orig.skills] : (npc as any).skills,
                        playerSkills: orig.playerSkills ? [...orig.playerSkills] : (npc as any).playerSkills
                    };
                }
                return npc;
            });

            const updatedYeuThu = prev.discoveredYeuThu.map(yt => {
                const orig = backupMap[`real_${yt.id}`] || backupMap[yt.id];
                if (orig) {
                    return {
                        ...yt,
                        skills: orig.skills ? [...orig.skills] : (yt as any).skills,
                        playerSkills: orig.playerSkills ? [...orig.playerSkills] : (yt as any).playerSkills
                    };
                }
                return yt;
            });

            return {
                ...prev,
                discoveredNPCs: updatedNPCs,
                discoveredYeuThu: updatedYeuThu
            };
        });
    }, [setKnowledgeBase]);

    const restoreOriginalAllySkills = useCallback(() => {
        if (!originalAllySkillsRef.current || Object.keys(originalAllySkillsRef.current).length === 0) return;
        console.log('[COMBAT_BALANCE] Restoring original skills for ally NPCs...');
        
        const backupMap = { ...originalAllySkillsRef.current };
        originalAllySkillsRef.current = {};

        // Restore in state.current.entities
        state.current.entities.forEach(e => {
            if (e.isAlly && e.combatant && !e.isObstacle && !e.isPlayer) {
                const c = e.combatant as any;
                const orig = backupMap[c.id] || backupMap[c.id.replace(/^ally_\d+_/, '')];
                if (orig) {
                    if (orig.skills !== undefined) c.skills = [...orig.skills];
                    if (orig.playerSkills !== undefined) c.playerSkills = [...orig.playerSkills];
                }
            }
        });

        // Restore in knowledgeBase
        setKnowledgeBase(prev => {
            const updatedNPCs = prev.discoveredNPCs.map(npc => {
                const orig = backupMap[`real_${npc.id}`] || backupMap[npc.id];
                if (orig) {
                    return {
                        ...npc,
                        skills: orig.skills ? [...orig.skills] : (npc as any).skills,
                        playerSkills: orig.playerSkills ? [...orig.playerSkills] : (npc as any).playerSkills
                    };
                }
                return npc;
            });

            const updatedYeuThu = prev.discoveredYeuThu.map(yt => {
                const orig = backupMap[`real_${yt.id}`] || backupMap[yt.id];
                if (orig) {
                    return {
                        ...yt,
                        skills: orig.skills ? [...orig.skills] : (yt as any).skills,
                        playerSkills: orig.playerSkills ? [...orig.playerSkills] : (yt as any).playerSkills
                    };
                }
                return yt;
            });

            return {
                ...prev,
                discoveredNPCs: updatedNPCs,
                discoveredYeuThu: updatedYeuThu
            };
        });
    }, [setKnowledgeBase]);

    useEffect(() => {
        const img = new Image();
        img.src = '/images/sword_slash_effect.jpg';
        slashImageRef.current = img;

        const bulletImg = new Image();
        bulletImg.src = '/images/bullet_effect.jpg';
        bulletImageRef.current = bulletImg;
    }, []);
    
    const [combatEnded, setCombatEnded] = useState<'victory' | 'defeat' | null>(null);
    const [isDispositionModalOpen, setIsDispositionModalOpen] = useState(false);
    const [, setForceRender] = useState(0);
    const [isDefeatModalOpen, setIsDefeatModalOpen] = useState(false);
    const [defeatedList, setDefeatedList] = useState<DefeatedEntity[]>([]);
    const [dispositions, setDispositions] = useState<CombatDispositionMap>({});
    
    // Add windowSize state for canvas resizing
    const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    useEffect(() => {
        const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Tự động tắt bỏ pendingCombat và trạng thái chiến đấu một cách cơ học khi thoát ra khỏi RealTimeCombatScreen
    useEffect(() => {
        return () => {
            setKnowledgeBase(prev => {
                if (prev?.pendingCombat || prev?.postCombatState || prev?.playerStats?.isInCombat) {
                    return {
                        ...prev,
                        pendingCombat: null,
                        postCombatState: null,
                        playerStats: {
                            ...prev.playerStats,
                            isInCombat: false
                        }
                    };
                }
                return prev;
            });
        };
    }, [setKnowledgeBase]);

    const [graphicsConfig, setGraphicsConfig] = useState(
        getApiSettings().combatGraphicsConfig || { resolutionScale: 1.0, enableVfx: true, enableDamageNumbers: true, maxUnitsPerSide: 4 }
    );

    const handleGraphicsConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setGraphicsConfig(prev => {
            const next = { ...prev, [name]: type === 'checkbox' ? checked : parseFloat(value) };
            const settings = getApiSettings();
            settings.combatGraphicsConfig = next;
            import('../../services/apiService').then(({ saveApiSettings }) => saveApiSettings(settings));
            return next;
        });
    };

    // RealTimeCombatScreen Background Music Setup
    useEffect(() => {
        const isMusicEnabled = localStorage.getItem('music_enabled') !== 'false';

        if (isMusicEnabled) {
            let trackUrl = '';
            // 50% chance to play public/background_music8.mp3
            if (Math.random() < 0.5) {
                trackUrl = './background_music8.mp3';
            } else {
                // Other 50%: random from 3, 4, 5, 6
                const otherTracks = [
                    './background_music3.m4a',
                    './background_music4.m4a',
                    './background_music5.m4a',
                    './background_music6.m4a'
                ];
                trackUrl = otherTracks[Math.floor(Math.random() * otherTracks.length)];
            }

            audioService.play(trackUrl, false);
        } else {
            audioService.stop();
        }

        return () => {
            audioService.stop();
        };
    }, []);
    
    // Joystick state
    const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
    const joystickBaseRef = useRef<HTMLDivElement>(null);
    
    // Ally AI Stance: 'attack' (Tổng lực tấn công) | 'defense' (Hộ vệ phòng thủ quanh người chơi)
    const [allyStance, setAllyStance] = useState<'attack' | 'defense'>('attack');
    
    const state = useRef({
        entities: [] as RTEntity[],
        projectiles: [] as RTProjectile[],
        auras: [] as RTAura[],
        vfx: [] as RTVfx[],
        screenShakeTimer: 0,
        screenFlashTimer: 0,
        joystick: { dx: 0, dy: 0 },
        lastTime: 0,
        running: false,
        paused: false,
        lockedTargetId: null as string | null,
        totalTime: 0,
        bossTriggered: false,
        sizeTriggered: false,
        autoAuraTriggered: false,
        pendingLasers: [] as {sourceId: string, targetId: string, x: number, y: number, tx: number, ty: number, timer: number, damage: number, isManhKich?: boolean, isSieuManhKich?: boolean}[],
        width: 800,
        height: 600,
        combatLogs: [] as string[],
        allyStance: 'attack' as 'attack' | 'defense',
        cameraOffset: { x: 0, y: 0 }
    });

    const isAlly = (id: string | undefined) => {
        if (!id) return true;
        return !id.startsWith('enemy_');
    };

    // Initialize
    useEffect(() => {
        const combinedAllyIds = Array.from(new Set([
            ...(knowledgeBase.pendingCombat?.allyIds || []),
            ...(knowledgeBase.combatCompanionIds || [])
        ]));

        const getNpcHp = (c: Combatant) => {
            if (c.id === 'player') return 999999999;
            const stats = getMutableStats(c);
            return Math.max(
                stats?.maxSinhLuc ?? 0,
                stats?.sinhLuc ?? 0,
                (c as any).maxSinhLuc ?? 0,
                (c as any).sinhLuc ?? 0,
                (c as any).hp ?? 0,
                100
            );
        };

        const getPowerScore = (c: Combatant) => {
            if (c.id === 'player') return 999999999;
            return getNpcHp(c);
        };

        const allyCount = Math.max(1, combinedAllyIds.length + 1);
        const maxAllowedOpponents = allyCount * 3;
        const rawOpponents = knowledgeBase.pendingCombat?.opponentIds || [];

        const rawOpponentEntities = rawOpponents.map((id, index) => {
            const opp = [
                ...knowledgeBase.discoveredNPCs, 
                ...knowledgeBase.discoveredYeuThu,
                ...(knowledgeBase.pendingCombat?.temporaryEntities || [])
            ].find(c => c.id === id);
            if (opp) return { ...opp, id: `enemy_${index}_${opp.id}`, entityType: (opp as any).entityType || 'npc' };
            return null;
        }).filter(Boolean) as Combatant[];

        // Tự động sắp xếp các NPC đối thủ có máu lớn nhất lên trước
        rawOpponentEntities.sort((a, b) => getNpcHp(b) - getNpcHp(a));
        const oC = rawOpponentEntities.slice(0, maxAllowedOpponents);

        const activeAllies = combinedAllyIds.map(id => {
            // Check slaves, prisoners, discovered NPCs, general NPCs, and companions
            return [
                ...(knowledgeBase.slaves || []), 
                ...(knowledgeBase.prisoners || []), 
                ...(knowledgeBase.discoveredNPCs || []), 
                ...(knowledgeBase.discoveredYeuThu || []), 
                ...(knowledgeBase.companions || []),
                ...(knowledgeBase.pendingCombat?.temporaryEntities || [])
            ].find(a => a.id === id);
        }).filter(Boolean) as Combatant[];
        
        const playerObj = { ...knowledgeBase.playerStats, entityType: 'player', id: 'player', name: knowledgeBase.worldConfig?.playerName || "Người chơi" } as Combatant;

        const sortedAllies = [playerObj, ...activeAllies].sort((a, b) => getPowerScore(b) - getPowerScore(a));
        const sortedEnemies = [...oC].sort((a, b) => getPowerScore(b) - getPowerScore(a));

        const allCombatants = [...sortedAllies, ...sortedEnemies];
        
        const WORLD_WIDTH = 2500;
        const WORLD_HEIGHT = 2000;
        state.current.width = WORLD_WIDTH;
        state.current.height = WORLD_HEIGHT;
        
        const obstacleEmojis = ["🌲", "🏔️", "⛰️", "🌳", "🪨", "🪵"];
        const numObstacles = Math.max(1, Math.floor(((4 + Math.floor(Math.random() * 5)) * 6) / 4));
        const obstacles: RTEntity[] = Array.from({ length: numObstacles }).map((_, i) => ({
            id: `obstacle_${i}`,
            combatant: { id: `obs_${i}`, name: "Vật cản", realm: "", entityType: "environment" } as any,
            isPlayer: false,
            isAlly: false,
            isObstacle: true,
            emoji: obstacleEmojis[Math.floor(Math.random() * obstacleEmojis.length)],
            x: Math.random() * (WORLD_WIDTH - 400) + 200,
            y: Math.random() * (WORLD_HEIGHT - 400) + 200,
            vx: 0,
            vy: 0,
            radius: 40 + Math.random() * 40,
            speed: 0,
            attackRange: 750,
            maxAttackCooldown: 0,
            attackCooldown: 0,
            hp: (knowledgeBase.playerStats.maxSinhLuc || 100) * 0.5,
            maxHp: (knowledgeBase.playerStats.maxSinhLuc || 100) * 0.5,
            isDead: false,
            aiDecisionTimer: 0,
            circleDir: 0,
            dodgeTimer: 0,
            shieldTimer: 0,
            shieldCd: 0,
            globalCooldown: 0
        }));

        let activeAlliesCount = 0;
        let activeEnemiesCount = 0;
        const maxLimit = graphicsConfig.maxUnitsPerSide || 4;

        state.current.entities = [...obstacles, ...allCombatants.map((c, idx) => {
            const stats = getMutableStats(c);
            const ally = isAlly(c.id);
            const initialHp = stats?.sinhLuc !== undefined ? stats.sinhLuc : 100;
            const powerScore = getPowerScore(c);
            
            let isQueued = false;
            if (ally) {
                if (activeAlliesCount >= maxLimit) isQueued = true;
                else activeAlliesCount++;
            } else {
                if (activeEnemiesCount >= maxLimit) isQueued = true;
                else activeEnemiesCount++;
            }
            
            // Apply permanent bonuses if player
            let speedBonus = 1;
            let atkSpdBonus = 1;
            let hpBonus = 1;

            if (c.id === 'player' && knowledgeBase.playerStats.permanentBonuses) {
                const b = knowledgeBase.playerStats.permanentBonuses;
                speedBonus = 1 + (b.speedMult || 0);
                atkSpdBonus = 1 + (b.attackSpeedMult || 0);
                hpBonus = 1 + (b.maxHpMult || 0);
            }

            const maxHp = Math.max(1, (stats?.maxSinhLuc || 100) * hpBonus);

            return {
                id: c.id,
                combatant: c,
                isPlayer: c.id === 'player',
                isAlly: ally,
                x: isQueued 
                    ? (ally ? -1000 : WORLD_WIDTH + 1000) 
                    : (ally ? WORLD_WIDTH / 2 - 200 - Math.random() * 100 : WORLD_WIDTH / 2 + 200 + Math.random() * 100),
                y: isQueued 
                    ? WORLD_HEIGHT / 2 
                    : WORLD_HEIGHT / 2 + (idx * 60 - 100),
                vx: 0,
                vy: 0,
                radius: 20,
                globalCooldown: 0,
                speed: (130 + Math.random() * 50) * speedBonus, // pixels per second
                attackRange: 1500,
                attackType: c.id === 'player' ? 'melee' : (Math.random() > 0.5 ? 'melee' : 'ranged'),
                maxAttackCooldown: 1000 / atkSpdBonus,
                attackCooldown: 1000 / atkSpdBonus,
                hp: Math.min(initialHp, maxHp),
                maxHp: maxHp,
                isDead: initialHp <= 0,
                aiDecisionTimer: Math.random() * 2000,
                circleDir: Math.random() > 0.5 ? 1 : -1,
                dodgeTimer: 0,
                shieldTimer: 0,
                shieldCd: 0,
                aiMode: 'combat',
                aiModeTimer: 5000 + Math.random() * 2000,
                skillCooldown: 0,
                isBoss: (c as any).isBoss || (c as any).triggerBoss || (c as any).isBossNpc,
                isQueued,
                powerScore
            };
        })];
        
        // Cơ chế cơ học "Ngang Bằng": Bù đắp khi tổng HP phe ta lớn hơn 2 lần phe địch
        const allyEntities = state.current.entities.filter(e => e.isAlly && !e.isObstacle);
        const enemyEntities = state.current.entities.filter(e => !e.isAlly && !e.isObstacle);
        const totalAllyHp = allyEntities.reduce((sum, e) => sum + (e.maxHp || 0), 0);
        const totalEnemyHp = enemyEntities.reduce((sum, e) => sum + (e.maxHp || 0), 0);

        if (totalAllyHp > 2 * totalEnemyHp && enemyEntities.length > 0) {
            console.log(`[COMBAT_BALANCE] Kích hoạt "ngang bằng": Ally HP (${totalAllyHp}) > 2 * Enemy HP (${totalEnemyHp})`);
            state.current.combatLogs.push(`⚖️ Kích hoạt cơ chế "Ngang Bằng": Tổng HP phe ta vượt trội gấp đôi phe địch, toàn bộ kỹ năng phe địch được thay thế bằng "combat Triệu Hồi Thuật" (Hồi chiêu 10s)!`);
            
            enemyEntities.forEach(e => {
                const c = e.combatant as any;
                const originalId = c.id.replace(/^enemy_\d+_/, '');
                
                originalEnemySkillsRef.current[c.id] = {
                    skills: c.skills ? [...c.skills] : undefined,
                    playerSkills: c.playerSkills ? [...c.playerSkills] : undefined
                };
                if (originalId !== c.id) {
                    originalEnemySkillsRef.current[originalId] = {
                        skills: c.skills ? [...c.skills] : undefined,
                        playerSkills: c.playerSkills ? [...c.playerSkills] : undefined
                    };
                }

                const realNpc = [...knowledgeBase.discoveredNPCs, ...knowledgeBase.discoveredYeuThu].find(n => n.id === originalId);
                if (realNpc) {
                    originalEnemySkillsRef.current[`real_${originalId}`] = {
                        skills: (realNpc as any).skills ? [...(realNpc as any).skills] : undefined,
                        playerSkills: (realNpc as any).playerSkills ? [...(realNpc as any).playerSkills] : undefined
                    };
                }

                const existingCount = (c.playerSkills?.length || c.skills?.length || 2);
                const slotCount = Math.max(2, existingCount);

                const summonSkills = Array.from({ length: slotCount }, (_, i) => ({
                    id: `summon_skill_balanced_${e.id}_${i}`,
                    name: "combat Triệu Hồi Thuật",
                    description: "Triệu hồi 2 đệ tử cận chiến có sát thương và Máu bằng 1/4 người thi triển.",
                    skillType: SkillType.LINH_KI,
                    level: 1,
                    currentExp: 0,
                    maxExp: 100,
                    mpCost: 15,
                    effect: { type: 'DAMAGE_HP', basePower: 0, target: 'single_enemy' }
                }));

                c.skills = [...summonSkills];
                c.playerSkills = [...summonSkills];
                (e as any).isBalancedSummoner = true;

                if (realNpc) {
                    (realNpc as any).skills = [...summonSkills];
                    (realNpc as any).playerSkills = [...summonSkills];
                }
            });
        } else if (totalAllyHp < 0.5 * totalEnemyHp && allyEntities.filter(e => !e.isPlayer && !e.isObstacle).length > 0) {
            console.log(`[COMBAT_BALANCE] Kích hoạt "ngang bằng" cho phe ta: Ally HP (${totalAllyHp}) < 1/2 Enemy HP (${totalEnemyHp})`);
            state.current.combatLogs.push(`⚖️ Kích hoạt cơ chế "Ngang Bằng": Tổng HP phe địch vượt trội gấp đôi phe ta, một kỹ năng ngẫu nhiên của các đồng đội phe ta được thay thế bằng "combat Triệu Hồi Thuật" (Hồi chiêu 10s)!`);
            
            allyEntities.forEach(e => {
                if (e.isPlayer) return; // Không thay đổi kỹ năng của người chơi
                const c = e.combatant as any;
                const originalId = c.id.replace(/^ally_\d+_/, '').replace(/^enemy_\d+_/, '');
                
                originalAllySkillsRef.current[c.id] = {
                    skills: c.skills ? [...c.skills] : undefined,
                    playerSkills: c.playerSkills ? [...c.playerSkills] : undefined
                };
                if (originalId !== c.id) {
                    originalAllySkillsRef.current[originalId] = {
                        skills: c.skills ? [...c.skills] : undefined,
                        playerSkills: c.playerSkills ? [...c.playerSkills] : undefined
                    };
                }

                const realNpc = [...knowledgeBase.discoveredNPCs, ...knowledgeBase.discoveredYeuThu].find(n => n.id === originalId);
                if (realNpc) {
                    originalAllySkillsRef.current[`real_${originalId}`] = {
                        skills: (realNpc as any).skills ? [...(realNpc as any).skills] : undefined,
                        playerSkills: (realNpc as any).playerSkills ? [...(realNpc as any).playerSkills] : undefined
                    };
                }

                const summonSkill = {
                    id: `summon_skill_ally_balanced_${e.id}_rand`,
                    name: "combat Triệu Hồi Thuật",
                    description: "Triệu hồi 2 đệ tử cận chiến có sát thương và Máu bằng 1/4 người thi triển.",
                    skillType: SkillType.LINH_KI,
                    level: 1,
                    currentExp: 0,
                    maxExp: 100,
                    mpCost: 15,
                    effect: { type: 'DAMAGE_HP', basePower: 0, target: 'single_enemy' }
                };

                // Thay thế duy nhất 1 kỹ năng ngẫu nhiên
                if (c.skills && c.skills.length > 0) {
                    const randIndex = Math.floor(Math.random() * c.skills.length);
                    const newSkills = [...c.skills];
                    newSkills[randIndex] = summonSkill;
                    c.skills = newSkills;
                } else {
                    c.skills = [summonSkill];
                }

                if (c.playerSkills && c.playerSkills.length > 0) {
                    const randIndex = Math.floor(Math.random() * c.playerSkills.length);
                    const newPlayerSkills = [...c.playerSkills];
                    newPlayerSkills[randIndex] = summonSkill;
                    c.playerSkills = newPlayerSkills;
                } else {
                    c.playerSkills = [summonSkill];
                }

                (e as any).isBalancedSummoner = true;

                if (realNpc) {
                    // Cập nhật real NPC trong knowledgeBase
                    if ((realNpc as any).skills && (realNpc as any).skills.length > 0) {
                        const randIndex = Math.floor(Math.random() * (realNpc as any).skills.length);
                        const newSkills = [...(realNpc as any).skills];
                        newSkills[randIndex] = summonSkill;
                        (realNpc as any).skills = newSkills;
                    } else {
                        (realNpc as any).skills = [summonSkill];
                    }

                    if ((realNpc as any).playerSkills && (realNpc as any).playerSkills.length > 0) {
                        const randIndex = Math.floor(Math.random() * (realNpc as any).playerSkills.length);
                        const newPlayerSkills = [...(realNpc as any).playerSkills];
                        newPlayerSkills[randIndex] = summonSkill;
                        (realNpc as any).playerSkills = newPlayerSkills;
                    } else {
                        (realNpc as any).playerSkills = [summonSkill];
                    }
                }
            });
        }

        state.current.running = true;
        state.current.lastTime = performance.now();
        requestAnimationFrame(gameLoop);
        
        return () => { 
            state.current.running = false; 
            restoreOriginalEnemySkills();
            restoreOriginalAllySkills();
        };
    }, []);

    const spawnVfx = (text: string, x: number, y: number, color: string) => {
        const isHit = text === '💥';
        const isNumber = /^[+\-]?\d+/.test(text.replace(/!/g, ''));
        if (!graphicsConfig.enableDamageNumbers && isNumber) return;
        if (!graphicsConfig.enableVfx && !isNumber) return;

        const formattedText = formatNumberDot(text);

        state.current.vfx.push({
            id: Math.random().toString(), text: formattedText, x, y, color, life: isHit ? 200 : 1000, maxLife: isHit ? 200 : 1000
        });
    };

    const spawnAfterimage = (e: RTEntity) => {
        if (!graphicsConfig.enableVfx) return;
        const isMoving = e.isPlayer ? (state.current.joystick.dx !== 0 || state.current.joystick.dy !== 0) : true;
        const sc = e.radius / 20;
        const wobble = isMoving ? Math.sin(performance.now() / 100) * 3 * sc : 0;
        const facingLeft = e.isPlayer ? state.current.joystick.dx < 0 : (!e.isAlly);

        state.current.vfx.push({
            id: 'afterimage_' + Math.random().toString(),
            text: '',
            x: e.x,
            y: e.y,
            color: '',
            life: 400,
            maxLife: 400,
            isAfterimage: true,
            entityType: e.isPlayer ? 'player' : (e.isAlly ? 'ally' : 'enemy'),
            radius: e.radius,
            wobble: wobble,
            facingLeft: facingLeft,
            isBoss: !!e.isBoss
        });
    };

    const triggerSlashVfx = (x: number, y: number, angle?: number, isAlly: boolean = true, bodyScale: number = 1.0) => {
        if (!graphicsConfig.enableVfx) return;
        state.current.vfx.push({
            id: Math.random().toString(),
            text: '',
            x: x + (Math.random() * 30 - 15), 
            y: y + (Math.random() * 30 - 15),
            color: '',
            life: 300,
            maxLife: 300,
            isImage: true,
            rotation: angle !== undefined ? angle : Math.random() * Math.PI * 2,
            scale: (1.1 + Math.random() * 0.6) * bodyScale,
            isEnemySlash: !isAlly
        });
    };

    const resolveHit = (e: RTEntity, p: RTProjectile) => {
        const s = state.current;
        const eStats = getMutableStats(e.combatant);
        const pSource = s.entities.find(ent => ent.id === p.sourceId);

        // Friendly fire check
        const pSourceIsAlly = p.sourceId === 'player' || (pSource ? pSource.isAlly : isAlly(p.sourceId));

        if (e.isObstacle) {
            const dmg = Math.max(1, Math.floor(p.damage));
            e.hp -= dmg;
            if (e.hp < 0) e.hp = 0;
            spawnVfx(`CHẶN`, p.x, p.y, '#9ca3af');
            spawnVfx(`-${dmg}`, e.x, e.y - 20, '#9ca3af');
            return;
        }

        if (p.isHeal) {
            if (e.isAlly === pSourceIsAlly || e.id === p.sourceId) {
                 if (p.skillName && p.skillName.toLowerCase().includes('kim cang hộ thể')) {
                     e.thuTimer = 5000;
                     spawnVfx('THỦ', e.x, e.y - 40, '#60a5fa');
                 } else if (p.skillName && p.skillName.toLowerCase().includes('thần hành phù')) {
                     e.tocTimer = 7000;
                     spawnVfx('TỐC', e.x, e.y - 40, '#60a5fa');
                 } else if (p.skillName && p.skillName.toLowerCase().includes('linh thuẫn thuật')) {
                     let heal = Math.max(1, Math.floor(e.maxHp * 0.1));
                     e.hp = Math.min(e.maxHp, e.hp + heal);
                     if (eStats) eStats.sinhLuc = e.hp;
                     spawnVfx(`+${heal}`, e.x, e.y - 20, '#22c55e');
                 } else {
                     let heal = p.healAmount || 0;
                     if (p.effect?.percentage) {
                          heal = Math.floor(e.maxHp * (p.effect.percentage / 100));
                     }
                     e.hp = Math.min(e.maxHp, e.hp + heal);
                     if (eStats) eStats.sinhLuc = e.hp;
                     spawnVfx(`+${heal}`, e.x, e.y - 20, '#22c55e');
                 }
            }
            return;
        }

        // NO FRIENDLY FIRE: Sources don't damage their own team
        if (e.isAlly === pSourceIsAlly) return;

        // Check Shield Dome Aura protection
        if (!p.isHeal && e.isAlly !== pSourceIsAlly) {
            const activeShieldAura = s.auras.find(a => {
                if (a.type !== 'SHIELD' || a.hp <= 0) return false;
                const casterEnt = s.entities.find(c => c.id === a.casterId);
                if (!casterEnt || casterEnt.isDead || casterEnt.isAlly !== e.isAlly) return false;
                return Math.hypot(e.x - casterEnt.x, e.y - casterEnt.y) <= a.radius;
            });
            if (activeShieldAura) {
                const incomingDmg = p.damage || 10;
                activeShieldAura.hp -= incomingDmg;
                spawnVfx(`CHẶN! (-${Math.floor(incomingDmg)})`, e.x, e.y - 20, '#3b82f6');
                if (activeShieldAura.hp <= 0) {
                    const casterEnt = s.entities.find(c => c.id === activeShieldAura.casterId);
                    if (casterEnt) spawnVfx("LINH THUẪN VỠ!", casterEnt.x, casterEnt.y - 40, '#ef4444');
                }
                return;
            }
        }

        // Damage / Effect logic
        if (e.shieldTimer > 0 && !p.isHeal) {
            spawnVfx(`MIỄN NHIỄM`, e.x, e.y - 20, '#38bdf8');
            return;
        }

        if (e.attackType === 'melee' && !p.skillName && !p.isHeal && Math.random() < 0.15) {
            spawnVfx(`NÉ TRÁNH (BUFF 15%)`, e.x, e.y - 20, '#10b981');
            return;
        }

        let finalDmg = p.damage;
        if (e.attackType === 'melee') {
            finalDmg *= 0.5; // Cận chiến giảm 50% sát thương nhận vào
        }
        if (e.isEnraged) finalDmg *= 0.5;
        if (e.thuTimer && e.thuTimer > 0) finalDmg *= 0.5;
        if (e.phaTimer && e.phaTimer > 0) finalDmg *= 1.5;
        
        // Track damage for MVP
        if (pSource && pSourceIsAlly) {
            pSource.totalDamageDealt = (pSource.totalDamageDealt || 0) + finalDmg;
        }
        
        e.hp -= finalDmg;
        if (e.hp < 0) e.hp = 0;
        if (eStats) eStats.sinhLuc = e.hp;

        if (e.hp <= 0 && !e.lastHitBy) {
            e.lastHitBy = { id: p.sourceId, name: pSource?.combatant.name || "Kẻ địch" };
            if (pSource && pSourceIsAlly) {
                pSource.killCount = (pSource.killCount || 0) + 1;
            }
        }

        spawnVfx(`💥`, e.x, e.y, '#fff');

        spawnVfx(`-${Math.floor(finalDmg)}`, e.x, e.y - 20, p.isCrit ? '#ef4444' : p.color);
        
        if (p.isManhKich) {
            const mag = Math.hypot(p.vx, p.vy) || 1;
            const kx = (p.vx / mag) * 100;
            const ky = (p.vy / mag) * 100;
            e.x += kx;
            e.y += ky;
            // Map bounds
            const WORLD_WIDTH = 2500;
            const WORLD_HEIGHT = 2000;
            e.x = Math.max(50, Math.min(WORLD_WIDTH - 50, e.x));
            e.y = Math.max(50, Math.min(WORLD_HEIGHT - 50, e.y));
            spawnVfx("ĐẨY LÙI!", e.x, e.y - 40, '#facc15');
        }

        if (p.isLifesteal || p.effect?.type === 'DRAIN_HP') {
             if (pSource) {
                 const sStats = getMutableStats(pSource.combatant);
                 const attackerPassives = parseCombatPassives(sStats?.equipmentPassives);
                 if (attackerPassives.lifesteal > 0) {
                     const heal = Math.max(1, Math.floor(finalDmg * attackerPassives.lifesteal));
                     pSource.hp = Math.min(pSource.maxHp, pSource.hp + heal);
                     if (sStats) sStats.sinhLuc = pSource.hp;
                     spawnVfx(`HÚT +${heal}`, pSource.x, pSource.y - 30, '#22c55e');
                 }
             }
        }

        // PHẢN ĐÒN (Reflect)
        const defenderPassives = parseCombatPassives(eStats?.equipmentPassives);
        if (defenderPassives.reflect > 0 && pSource && !p.isHeal) {
            const reflectDmg = Math.max(1, Math.floor(finalDmg * defenderPassives.reflect));
            pSource.hp -= reflectDmg;
            if (pSource.hp < 0) pSource.hp = 0;
            const sStats = getMutableStats(pSource.combatant);
            if (sStats) sStats.sinhLuc = pSource.hp;
            spawnVfx(`PHẢN -${reflectDmg}`, pSource.x, pSource.y - 20, '#ef4444');
            if (pSource.hp <= 0) {
                 pSource.isDead = true;
                 s.combatLogs.push(`${pSource.combatant.name} tử vong do bị phản đòn!`);
            }
        }

        // Aura Farming: Burst points accumulation for bosses
        handleAuraFarmingBurst(e, spawnVfx);

        // Apply specific requested debuff skills
        if (p.skillName || p.coreSkillName) {
            const skillLower = (p.skillName || '').toLowerCase();
            const coreLower = (p.coreSkillName || '').toLowerCase();
            if (skillLower.includes('trì hoãn chú') || coreLower.includes('trì hoãn chú')) {
                e.hoanTimer = 4000;
                spawnVfx('Hoãn', e.x, e.y - 40, '#ef4444');
            } else if (skillLower.includes('thi độc chú') || coreLower.includes('thi độc chú')) {
                e.docTimer = 4000;
                e.docTickTimer = 0;
                spawnVfx('Độc', e.x, e.y - 40, '#ef4444');
            } else if (skillLower.includes('điểm huyệt thuật') || coreLower.includes('điểm huyệt thuật')) {
                e.camTimer = 4000;
                spawnVfx('Cấm', e.x, e.y - 40, '#ef4444');
            } else if (skillLower.includes('phá giáp kích') || coreLower.includes('phá giáp kích')) {
                e.phaTimer = 4000;
                spawnVfx('Phá', e.x, e.y - 40, '#ef4444');
            }
        }

        // Băng Hoàng Phá & projectile mang hiệu ứng slowRate: làm chậm tốc độ 30% trong 3s
        if ((p as any).slowRate) {
            e.slowTimer = (p as any).slowDuration || 3000;
            e.slowRate = (p as any).slowRate || 0.3;
            spawnVfx('CHẬM -30% (3s)', e.x, e.y - 40, '#60a5fa');
        }

        // Handle Status Effects
        if (p.effect?.type === 'APPLY_STATUS') {
             const status = p.effect.status;
             const dur = (p.effect.duration || 3) * 1000;
             if (status === 'STUN') {
                  e.stunTimer = dur;
                  spawnVfx('CHOÁNG', e.x, e.y - 40, '#facc15');
             } else if (status === 'SLOW') {
                  e.slowTimer = dur;
                  spawnVfx('CHẬM', e.x, e.y - 40, '#60a5fa');
             } else if (status === 'POISON') {
                  e.poisonTimer = dur;
                  e.poisonSourceId = p.sourceId;
                  spawnVfx('ĐỘC', e.x, e.y - 40, '#a855f7');
             } else if (status === 'PROTECT') {
                  // Protect: increase flat defense or just show vfx for now
                  spawnVfx('HỘ THỂ', e.x, e.y - 40, '#38bdf8');
                  e.shieldTimer = dur / 2; // Short duration shield
             } else {
                  spawnVfx(status || 'EFFECT', e.x, e.y - 40, '#a855f7');
             }
        }

        if (p.effect?.type === 'STAT_DEBUFF') {
             spawnVfx(`GIẢM CHỈ SỐ`, e.x, e.y - 40, '#f97316');
             // Could scale down e.sucTanCong in eStats if needed
        }

        if (e.hp <= 0) {
            e.hp = 0; e.isDead = true;
            if (!e.isAlly) s.combatLogs.push(`${e.combatant.name} bị hạ gục!`);
        }
    };

    const handleSkillLogic = (source: RTEntity, skill: Skill) => {
        if (source.isQueued) return;
        if (source.globalCooldown > 0) return; // Wait for GCD
        source.globalCooldown = 1000; // Trigger 1000ms (1s) GCD

        const s = state.current;
        const skillName = skill.name.toUpperCase();
        
        const nameLower = (skill.name || '').toLowerCase();
        const descLower = (skill.description || '').toLowerCase();
        const coreLower = (skill.coreSkillName || '').toLowerCase();

        const isSummonSkill = skillName.includes('TRIỆU HỒI') || skillName.includes('SUMMON') || coreLower.includes('triệu hồi') || coreLower.includes('summon');
        if (isSummonSkill) {
            // Limit per caster: each entity can have max 6 active summons
            const summonedCount = s.entities.filter(ent => ent.isSummoned && !ent.isDead && ent.casterId === source.id).length;
            if (summonedCount >= 6) {
                s.vfx.push({ id: Math.random().toString(), text: "Giới hạn!", x: source.x, y: source.y - 40, color: '#f87171', life: 1500, maxLife: 1500 });
                s.combatLogs.push(`⚠️ ${source.combatant.name} không thể triệu hồi thêm đệ tử do số đệ tử đang hoạt động đã đạt giới hạn tối đa (6)!`);
                return;
            }
            const sStats = getMutableStats(source.combatant);
            const casterAtk = sStats?.sucTanCong || 10;
            const minionAtk = Math.max(1, Math.floor(casterAtk * 0.25));
            const minionHp = Math.max(1, Math.floor((source.maxHp || 100) * 0.25));

            for (let i = 0; i < 2; i++) {
                const minionId = `${source.id}_summoned_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`;
                const minion: RTEntity = {
                    id: minionId,
                    combatant: {
                        ...source.combatant,
                        id: `summoned_entity_${source.id}_${Date.now()}_${i}`,
                        name: `Đệ tử của ${source.combatant.name}`,
                        playerSkills: [],
                        skills: [],
                        stats: {
                            ...sStats,
                            sucTanCong: minionAtk,
                            sinhLuc: minionHp,
                            maxSinhLuc: minionHp,
                            phongThu: Math.floor(((sStats as any)?.phongThu || 0) * 0.25)
                        }
                    } as any,
                    isPlayer: false,
                    isAlly: source.isAlly,
                    x: source.x + (Math.random() * 80 - 40),
                    y: source.y + (Math.random() * 80 - 40),
                    vx: 0,
                    vy: 0,
                    radius: Math.max(10, Math.floor(source.radius * 0.8)),
                    globalCooldown: 0,
                    speed: (source.speed || 150) + 10,
                    attackRange: 80, // Cận chiến
                    attackCooldown: 1000,
                    maxAttackCooldown: 1000,
                    hp: minionHp,
                    maxHp: minionHp,
                    isDead: false,
                    aiDecisionTimer: 1000,
                    circleDir: i === 0 ? 1 : -1,
                    dodgeTimer: 0,
                    shieldTimer: 0,
                    shieldCd: 0,
                    emoji: '💂',
                    aiMode: 'combat',
                    aiModeTimer: 5000,
                    isSummoned: true,
                    attackType: 'melee'
                };
                s.entities.push(minion);
            }
            s.vfx.push({ id: Math.random().toString(), text: "TRIỆU HỒI!", x: source.x, y: source.y - 40, color: '#a855f7', life: 1500, maxLife: 1500 });
            s.combatLogs.push(`${source.combatant.name} đã triệu hồi 2 đệ tử trợ chiến!`);
            return;
        }

        const hasMeleeConvertibleKeywords = 
            nameLower.includes('hỏa cầu') || nameLower.includes('hoa cau') ||
            nameLower.includes('băng phong') || nameLower.includes('bang phong') ||
            nameLower.includes('lạc lôi') || nameLower.includes('lac loi') ||
            nameLower.includes('cuồng lôi') || nameLower.includes('cuong loi') ||
            nameLower.includes('viêm bạo') || nameLower.includes('viem bao') ||
            nameLower.includes('hàn băng') || nameLower.includes('han bang') ||
            
            descLower.includes('hỏa cầu') || descLower.includes('hoa cau') ||
            descLower.includes('băng phong') || descLower.includes('bang phong') ||
            descLower.includes('lạc lôi') || descLower.includes('lac loi') ||
            descLower.includes('cuồng lôi') || descLower.includes('cuong loi') ||
            descLower.includes('viêm bạo') || descLower.includes('viem bao') ||
            descLower.includes('hàn băng') || descLower.includes('han bang') ||
            
            coreLower.includes('hỏa cầu') || coreLower.includes('hoa cau') ||
            coreLower.includes('băng phong') || coreLower.includes('bang phong') ||
            coreLower.includes('lạc lôi') || coreLower.includes('lac loi') ||
            coreLower.includes('cuồng lôi') || coreLower.includes('cuong loi') ||
            coreLower.includes('viêm bạo') || coreLower.includes('viem bao') ||
            coreLower.includes('hàn băng') || coreLower.includes('han bang');

        const hasMeleeConvertibleEffect = 
            skill.effect?.type === 'DAMAGE_HP' && 
            skill.effect?.target === 'single_enemy' && 
            (skill.effect?.element === 'fire' || skill.effect?.element === 'ice' || skill.effect?.element === 'thunder');

        const isElementalMeleeSkill = hasMeleeConvertibleKeywords || hasMeleeConvertibleEffect;
        const isConvertibleMeleeSkill = source.attackType === 'melee' && isElementalMeleeSkill;

        // Determine color based on element if available
        let skillColor = '#3b82f6';
        if (skill.effect?.element === 'fire') skillColor = '#ef4444';
        else if (skill.effect?.element === 'ice') skillColor = '#60a5fa';
        else if (skill.effect?.element === 'thunder') skillColor = '#facc15';
        else if (skillName.includes('CHÉM CHÉM') || skillName.includes('CHEM CHEM') || coreLower.includes('chém chém')) skillColor = '#e2e8f0'; // Thép sáng bạc cho Chém Chém tầm xa

        s.vfx.push({ id: Math.random().toString(), text: skillName, x: source.x, y: source.y - 40, color: skillColor, life: 1500, maxLife: 1500 });
        
        // Extract stats from effect
        const effect = skill.effect;
        const effectType = effect?.type;
        
        const sStats = getMutableStats(source.combatant);
        const casterAtk = sStats?.sucTanCong || 0;
        
        const totalDmg = (effectType === 'DAMAGE_HP' || effectType === 'DRAIN_HP') ? ((effect.basePower || 0) + casterAtk) * (skill.damageMultiplier || 1) : 0;
        const totalHeal = (effectType === 'HEAL_HP') ? ((effect.basePower || 0) + casterAtk) * (skill.healingMultiplier || 1) : 0;

        const isLifestealSkill = effectType === 'DRAIN_HP' || skillName.includes('HÚT MÁU') || skillName.includes('HẤP HUYẾT') || coreLower.includes('hút máu') || coreLower.includes('hấp huyết');
        const isAoE = effect?.target === 'all_enemies' || effect?.target === 'all_allies';

        const spawnSkillProjectile = (targetPos: {x: number, y: number}, isHeal: boolean, amount: number, useArcWave?: boolean, overrideAngle?: number, useExpandingCircle?: boolean, isLifesteal?: boolean, targetId?: string, emoji?: string, extraProps?: Partial<RTProjectile>) => {
            const dx = targetPos.x - source.x;
            const dy = targetPos.y - source.y;
            const dist = Math.sqrt(dx*dx + dy*dy) || 1;
            
            const skillLower = (skill.name || '').toLowerCase();
            const coreLower = (skill.coreSkillName || '').toLowerCase();
            const isDebuffSkill = skillLower.includes('trì hoãn chú') || coreLower.includes('trì hoãn chú') ||
                                  skillLower.includes('thi độc chú') || coreLower.includes('thi độc chú') ||
                                  skillLower.includes('điểm huyệt thuật') || coreLower.includes('điểm huyệt thuật') ||
                                  skillLower.includes('phá giáp kích') || coreLower.includes('phá giáp kích') ||
                                  (effect?.type === 'APPLY_STATUS' && ['SLOW', 'POISON', 'STUN'].includes(effect.status || '')) ||
                                  (effect?.type === 'STAT_DEBUFF');

            const BASIC_ATTACK_SPEED = 400;
            let speed = isDebuffSkill ? 150 : (BASIC_ATTACK_SPEED / 2);
            
            const finalVx = overrideAngle !== undefined ? Math.cos(overrideAngle) * speed : (dx / dist) * speed;
            const finalVy = overrideAngle !== undefined ? Math.sin(overrideAngle) * speed : (dy / dist) * speed;

            let finalColor = (isHeal || isLifesteal) ? '#22c55e' : skillColor;
            if (isDebuffSkill) {
                if (skillLower.includes('trì hoãn chú') || coreLower.includes('trì hoãn chú')) finalColor = '#60a5fa';
                else if (skillLower.includes('thi độc chú') || coreLower.includes('thi độc chú')) finalColor = '#a855f7';
                else if (skillLower.includes('điểm huyệt thuật') || coreLower.includes('điểm huyệt thuật')) finalColor = '#facc15';
                else if (skillLower.includes('phá giáp kích') || coreLower.includes('phá giáp kích')) finalColor = '#ef4444';
            }

            s.projectiles.push({
                id: Math.random().toString(),
                x: source.x, y: source.y,
                vx: finalVx, vy: finalVy,
                targetId: targetId || '', 
                sourceId: source.id,
                damage: isHeal ? 0 : amount,
                isHeal: isHeal,
                isLifesteal: isLifesteal,
                healAmount: isHeal ? amount : 0,
                isCrit: false,
                color: finalColor,
                skillName: skill.name,
                coreSkillName: skill.coreSkillName,
                life: 7000, 
                maxLife: 7000,
                emoji: emoji || (useArcWave ? '🌊' : (effect?.element === 'fire' ? '🔥' : (effect?.element === 'ice' ? '❄️' : (effect?.element === 'thunder' ? '⚡' : (isHeal ? '✨' : ((skillName.includes('CHÉM CHÉM') || skillName.includes('CHEM CHEM') || coreLower.includes('chém chém')) ? '🗡️' : undefined)))))),
                isPiercing: useExpandingCircle || isAoE || isDebuffSkill, 
                isArcWave: false, // Offensive AOE waves should move as projectiles
                isDebuffWave: isDebuffSkill,
                hitIds: [],
                baseSize: isDebuffSkill ? 20 : ((useExpandingCircle || isAoE) ? 15 : (isLifesteal ? 10 : 30)),
                effect: effect,
                ...(extraProps || {})
            });
        };

        const isChainingMeleeSlash = (skillName.includes('CHÉM CHÉM') || skillName.includes('CHEM CHEM') || coreLower.includes('chém chém')) && source.attackType === 'melee';

        // Logic for execution
        if (isChainingMeleeSlash || isConvertibleMeleeSkill) {
            const potentialTargets = source.isAlly ? s.entities.filter(e => !e.isAlly && !e.isDead && !e.isObstacle) : s.entities.filter(e => e.isAlly && !e.isDead && !e.isObstacle);
            let target = null;
            if (source.isPlayer && s.lockedTargetId) {
                target = s.entities.find(e => e.id === s.lockedTargetId && !e.isDead && !e.isAlly && !e.isObstacle);
            }
            if (!target) {
                target = potentialTargets.sort((a,b) => Math.hypot(a.x - source.x, a.y - source.y) - Math.hypot(b.x - source.x, b.y - source.y))[0];
            }

            let angle = 0;
            if (source.isPlayer) {
                // Ưu tiên hướng di chuyển từ Joystick của người chơi
                if (s.joystick && (s.joystick.dx !== 0 || s.joystick.dy !== 0)) {
                    angle = Math.atan2(s.joystick.dy, s.joystick.dx);
                } else if (target) {
                    // Nếu đứng yên thì mới nhắm vào kẻ địch
                    angle = Math.atan2(target.y - source.y, target.x - source.x);
                } else {
                    angle = source.isAlly ? 0 : Math.PI;
                }
            } else {
                // Ưu tiên hướng di chuyển hiện tại của NPC
                if (Math.abs(source.vx) > 0.1 || Math.abs(source.vy) > 0.1) {
                    angle = Math.atan2(source.vy, source.vx);
                } else if (target) {
                    angle = Math.atan2(target.y - source.y, target.x - source.x);
                } else {
                    angle = source.isAlly ? 0 : Math.PI;
                }
            }

            // Lướt 300 khoảng cách trong 150ms
            const dashDist = 300;
            const startX = source.x;
            const startY = source.y;
            const targetX = Math.max(50, Math.min(s.width - 50, startX + Math.cos(angle) * dashDist));
            const targetY = Math.max(50, Math.min(s.height - 50, startY + Math.sin(angle) * dashDist));

            // Di chuyển nhanh tới đích trong 150ms
            const dashSteps = 6; 
            for (let i = 1; i <= dashSteps; i++) {
                setTimeout(() => {
                    const ent = s.entities.find(e => e.id === source.id);
                    if (ent && !ent.isDead) {
                        ent.x = startX + (targetX - startX) * (i / dashSteps);
                        ent.y = startY + (targetY - startY) * (i / dashSteps);
                        spawnAfterimage(ent);
                        if (i === dashSteps) {
                            spawnVfx(isConvertibleMeleeSkill ? "💨 ÁP SÁT CHÉM!" : "💨 LƯỚT CHÉM!", ent.x, ent.y - 40, '#22c55e');
                        }
                    }
                }, i * (150 / dashSteps));
            }

            const executeSlashAttack = (dmgAmount: number) => {
                // Hiển thị hiệu ứng vết chém tại vị trí hiện tại
                const ent = s.entities.find(e => e.id === source.id);
                if (!ent) return;
                triggerSlashVfx(ent.x, ent.y, angle, source.isAlly, source.radius / 20.0);

                // Tìm các đối thủ trong tầm 200 trước mặt để gây sát thương
                const targetsToHit: RTEntity[] = [];
                s.entities.forEach(e => {
                    if (!e.isDead && !e.isObstacle && e.isAlly !== source.isAlly) {
                        const edx = e.x - ent.x;
                        const edy = e.y - ent.y;
                        const eDist = Math.hypot(edx, edy);
                        
                        if (eDist <= 200) {
                            const eAngle = Math.atan2(edy, edx);
                            let angleDiff = Math.abs(eAngle - angle);
                            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                            angleDiff = Math.abs(angleDiff);
                            
                            if (angleDiff <= Math.PI / 2) {
                                targetsToHit.push(e);
                            }
                        }
                    }
                });

                targetsToHit.forEach(t => {
                    const dummyProjectile: RTProjectile = {
                        id: Math.random().toString(),
                        x: t.x, y: t.y,
                        vx: 0, vy: 0,
                        targetId: t.id, sourceId: source.id,
                        damage: dmgAmount, isCrit: false,
                        color: isConvertibleMeleeSkill ? skillColor : (source.isAlly ? '#facc15' : '#ef4444'),
                        life: 0,
                        maxLife: 0,
                        isPiercing: true,
                        hitIds: [],
                        skillName: skill.name,
                        effect: effect
                    };
                    resolveHit(t, dummyProjectile);
                });
            };

            const halfDmg = Math.floor(totalDmg / 2) || 1;

            // Tấn công lần 1 sau khi lướt xong (150ms)
            setTimeout(() => {
                const currentSource = s.entities.find(e => e.id === source.id);
                if (currentSource && !currentSource.isDead) {
                    executeSlashAttack(halfDmg);
                }
            }, 150);

            // Tấn công lần 2 sau 150ms + 200ms = 350ms
            setTimeout(() => {
                const currentSource = s.entities.find(e => e.id === source.id);
                if (currentSource && !currentSource.isDead) {
                    executeSlashAttack(halfDmg);
                }
            }, 350);

            return;
        }

        if (skill.name.includes('Bom Vĩ Thú') || coreLower.includes('bom vĩ thú')) {
            const ceStat = getMutableStats(source.combatant);
            const maxHp = source.maxHp || ceStat?.maxSinhLuc || 1000;
            const hpCost = Math.floor(maxHp * 0.10);
            
            source.hp -= hpCost;
            if (source.hp < 0) source.hp = 0;
            if (ceStat) ceStat.sinhLuc = source.hp;
            spawnVfx(`-${hpCost} HP`, source.x, source.y - 30, '#ef4444');

            if (source.hp <= 0) {
                source.isDead = true;
                spawnVfx("TỰ HỦY DO TỤ LỰC BOM VĨ THÚ!", source.x, source.y - 50, '#ef4444');
                s.combatLogs.push(`☠️ ${source.combatant.name} đã tự hủy khi cố gắng tụ lực Bom Vĩ Thú!`);
                return;
            }

            source.channelTimer = 5000;
            source.maxChannelTimer = 5000;
            source.channelSkillName = skill.name;
            source.channelSkillCoreName = skill.coreSkillName;
            source.channelSkillPower = effect?.basePower || 100;
            spawnVfx("TỤ LỰC BOM VĨ THÚ (5s)...", source.x, source.y - 40, '#a855f7');
            return;
        }

        const isOffensive = effectType === 'DAMAGE_HP' || effectType === 'DRAIN_HP' || (effectType === 'STAT_DEBUFF' && effect?.target.includes('enemy')) || (effectType === 'APPLY_STATUS' && effect?.target.includes('enemy')) || totalDmg > 0;

        if (isOffensive) {
            const potentialTargets = source.isAlly ? s.entities.filter(e => !e.isAlly && !e.isDead && !e.isObstacle) : s.entities.filter(e => e.isAlly && !e.isDead && !e.isObstacle);
            
            if (isLoiLongGiangThe(skill.name, skill.coreSkillName)) {
                castLoiLongGiangThe(source, totalDmg, s, spawnVfx);
            } else if (isBangHoangPha(skill.name, skill.coreSkillName)) {
                castBangHoangPha(source, totalDmg, s, spawnSkillProjectile);
            } else if (isLietHoaPhanThien(skill.name, skill.coreSkillName)) {
                castLietHoaPhanThien(source, potentialTargets, totalDmg, s, spawnVfx);
            } else if (isPhaGiapKich(skill.name, skill.coreSkillName)) {
                s.vfx.push({ id: Math.random().toString(), text: "🔨 THIÊN QUÂN PHÁ GIÁP!", x: source.x, y: source.y - 40, color: '#f59e0b', life: 1500, maxLife: 1500 });
                s.combatLogs.push(`💥 ${source.combatant.name} thi triển Phá Giáp Kích, hư ảnh Thần Búa hiện thế!`);

                let angle = source.isAlly ? 0 : Math.PI;
                let target = null;
                if (source.isPlayer && s.lockedTargetId) {
                    target = s.entities.find(e => e.id === s.lockedTargetId && !e.isDead);
                }
                if (!target) {
                    target = potentialTargets.sort((a,b) => Math.hypot(a.x - source.x, a.y - source.y) - Math.hypot(b.x - source.x, b.y - source.y))[0];
                }
                if (source.isPlayer && s.joystick && (Math.abs(s.joystick.dx) > 0.1 || Math.abs(s.joystick.dy) > 0.1)) {
                    angle = Math.atan2(s.joystick.dy, s.joystick.dx);
                } else if (target) {
                    angle = Math.atan2(target.y - source.y, target.x - source.x);
                }

                const executeHammerStrike = (strikeIndex: number) => {
                    const caster = s.entities.find(e => e.id === source.id);
                    if (!caster || caster.isDead) return;

                    let currentAngle = angle;
                    let freshTargets = caster.isAlly ? s.entities.filter(e => !e.isAlly && !e.isDead && !e.isObstacle) : s.entities.filter(e => e.isAlly && !e.isDead && !e.isObstacle);
                    let currentTarget = null;
                    if (caster.isPlayer && s.lockedTargetId) {
                        currentTarget = s.entities.find(e => e.id === s.lockedTargetId && !e.isDead);
                    }
                    if (!currentTarget) {
                        currentTarget = freshTargets.sort((a,b) => Math.hypot(a.x - caster.x, a.y - caster.y) - Math.hypot(b.x - caster.x, b.y - caster.y))[0];
                    }
                    if (currentTarget) {
                        currentAngle = Math.atan2(currentTarget.y - caster.y, currentTarget.x - caster.x);
                    }

                    s.vfx.push({ id: Math.random().toString(), text: `🔨 GÕ LẦN ${strikeIndex}!`, x: caster.x, y: caster.y - 45, color: '#f59e0b', life: 1000, maxLife: 1000 });

                    s.projectiles.push({
                        id: `hammer-${source.id}-${strikeIndex}-${Date.now()}`,
                        x: caster.x,
                        y: caster.y,
                        vx: 0,
                        vy: 0,
                        targetId: '',
                        sourceId: caster.id,
                        damage: Math.floor(totalDmg * 1.2),
                        isHeal: false,
                        isCrit: false,
                        color: '#f59e0b',
                        skillName: 'combat Phá Giáp Kích',
                        life: 600,
                        maxLife: 600,
                        emoji: '🔨',
                        baseSize: 120,
                        isPiercing: true,
                        isPierceAll: true,
                        isHammerAttack: true,
                        hammerAngle: currentAngle,
                        hitIds: []
                    } as any);

                    setTimeout(() => {
                        const freshCaster = s.entities.find(e => e.id === source.id);
                        if (!freshCaster || freshCaster.isDead) return;

                        s.vfx.push({ id: Math.random().toString(), text: "💥 CHẤN ĐỘNG!", x: freshCaster.x + Math.cos(currentAngle) * 120, y: freshCaster.y + Math.sin(currentAngle) * 120, color: '#f59e0b', life: 1000, maxLife: 1000 });

                        const strikeRadius = 250;
                        const fanHalfAngle = Math.PI * 2 / 6; 

                        s.entities.forEach(e => {
                            if (e.isDead || e.isObstacle || e.isAlly === freshCaster.isAlly) return;

                            const dx = e.x - freshCaster.x;
                            const dy = e.y - freshCaster.y;
                            const dist = Math.hypot(dx, dy);

                            if (dist <= strikeRadius) {
                                const angleToTarget = Math.atan2(dy, dx);
                                let angleDiff = angleToTarget - currentAngle;
                                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                                if (Math.abs(angleDiff) <= fanHalfAngle) {
                                    const dummyProjectile = {
                                        id: `hammer-dmg-${freshCaster.id}-${Date.now()}`,
                                        x: e.x,
                                        y: e.y,
                                        vx: 0,
                                        vy: 0,
                                        targetId: e.id,
                                        sourceId: freshCaster.id,
                                        damage: Math.floor(totalDmg * 1.2),
                                        isCrit: false,
                                        color: '#f59e0b',
                                        skillName: 'combat Phá Giáp Kích',
                                        life: 0,
                                        maxLife: 0,
                                        isPiercing: true,
                                        hitIds: [],
                                        effect: skill.effect
                                    };
                                    resolveHit(e, dummyProjectile as any);

                                    e.stunTimer = 2000;
                                    s.vfx.push({ id: Math.random().toString(), text: '🎯 CHOÁNG (2s)', x: e.x, y: e.y - 40, color: '#facc15', life: 1000, maxLife: 1000 });
                                    s.combatLogs.push(`💫 ${e.combatant.name} bị choáng 2s bởi cú gõ búa của ${freshCaster.combatant.name}!`);
                                }
                            }
                        });
                    }, 150);
                };

                executeHammerStrike(1);
                setTimeout(() => executeHammerStrike(2), 1000);
                setTimeout(() => executeHammerStrike(3), 2000);
            } else if (isAoE) {
                // Optimized AOE: Spaced out waves to avoid overlap
                const numArcs = 12; // Reduced from 32 for clarity/performance
                for (let i = 0; i < numArcs; i++) {
                    const angle = (i / numArcs) * Math.PI * 2;
                    spawnSkillProjectile({x: 0, y: 0}, false, totalDmg, true, angle, false, isLifestealSkill);
                }
            } else {
                let nearest = null;
                if (source.isPlayer && s.lockedTargetId) {
                    nearest = s.entities.find(e => e.id === s.lockedTargetId && !e.isDead && !e.isAlly && !e.isObstacle);
                }
                if (!nearest) {
                    nearest = potentialTargets.sort((a,b) => Math.hypot(a.x - source.x, a.y - source.y) - Math.hypot(b.x - source.x, b.y - source.y))[0];
                }
                if (nearest) spawnSkillProjectile(nearest, false, totalDmg, false, undefined, false, isLifestealSkill, nearest.id);
            }
        } else {
            // Support logic (Healing Aura & Shield Dome Aura)
            const isShieldSkill = nameLower.includes('linh thuẫn') || coreLower.includes('linh thuẫn') ||
                                  nameLower.includes('thuẫn') || coreLower.includes('thuẫn') ||
                                  effect?.status === 'SHELL' || 
                                  effect?.status === 'PROTECT' ||
                                  effect?.status === 'COUNTER_SHIELD';

            if (isShieldSkill) {
                const shieldHp = Math.floor((source.maxHp || 100) * 3); // 300% MaxHP of Caster
                s.auras.push({
                    id: Math.random().toString(),
                    casterId: source.id,
                    type: 'SHIELD',
                    radius: 250, // 250px radius (500px diameter)
                    duration: 5000,
                    maxDuration: 5000,
                    tickTimer: 0,
                    healPerTick: 0,
                    hp: shieldHp,
                    maxHp: shieldHp,
                    color: '#3b82f6',
                    skillName: skill.name
                });
                spawnVfx("LINH THUẪN (300% HP)", source.x, source.y - 30, '#3b82f6');
            } else {
                // Healing Aura
                const baseHealVal = totalHeal || (effect?.basePower || 60);
                const healPerTick = Math.max(1, Math.floor(baseHealVal / 5));
                s.auras.push({
                    id: Math.random().toString(),
                    casterId: source.id,
                    type: 'HEAL',
                    radius: 250, // 250px radius (500px diameter)
                    duration: 5000,
                    maxDuration: 5000,
                    tickTimer: 1000,
                    healPerTick: healPerTick,
                    hp: 0,
                    maxHp: 0,
                    color: '#22c55e',
                    skillName: skill.name
                });
                spawnVfx("VÙNG TRỊ LIỆU (5s)", source.x, source.y - 30, '#22c55e');
            }
        }
    };

    const handleAttack = (source: RTEntity, target: RTEntity) => {
        if (source.isQueued) return;
        if (source.camTimer && source.camTimer > 0) return;
        const sStats = getMutableStats(source.combatant);
        const tStats = getMutableStats(target.combatant);
        if (!sStats || !tStats) return;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const angle = Math.atan2(dy, dx);
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;

        const attackerPassives = parseCombatPassives(sStats.equipmentPassives);
        const defenderPassives = parseCombatPassives(tStats.equipmentPassives);
        
        let baseDmg = (sStats.sucTanCong || 10);
        const attackType = source.attackType || 'melee';
        if (attackType === 'ranged') {
            baseDmg *= 0.5;
        }

        let dmg = calculateFinalDamage(baseDmg, attackerPassives, defenderPassives);
        
        // Crit
        const critChance = attackerPassives.critChance || 0.05;
        const isCritHit = Math.random() < critChance;
        if (isCritHit) {
            const critMult = 1.5 + (attackerPassives.critDamage || 0);
            dmg = Math.floor(dmg * critMult);
        }

        const manhKichChance = attackType === 'ranged' ? 0.15 : 0.05;
        const isManhKichTrigger = Math.random() < manhKichChance;

        if (isManhKichTrigger) {
            const isSieu = !!source.isBoss;
            state.current.pendingLasers.push({
                sourceId: source.id, targetId: target.id, 
                x: source.x, y: source.y, 
                tx: target.x, ty: target.y, 
                timer: 0, 
                damage: isSieu ? dmg * 4 : dmg * 2,
                isManhKich: true,
                isSieuManhKich: isSieu
            });
            spawnVfx(isSieu ? "SIÊU MÃNH KÍCH!" : "MÃNH KÍCH!", source.x, source.y - 40, isSieu ? '#ef4444' : '#facc15');
            return;
        }

        if (attackType === 'melee') {
            // Trigger Slash VFX immediately on attacker, facing target
            triggerSlashVfx(source.x, source.y, angle, source.isAlly, source.radius / 20.0);

            // Melee does immediate AOE damage to enemies within 200 distance and in front (180 degree arc)
            const targetsToHit: RTEntity[] = [];
            state.current.entities.forEach(e => {
                if (!e.isDead && !e.isObstacle && e.isAlly !== source.isAlly) {
                    const edx = e.x - source.x;
                    const edy = e.y - source.y;
                    const eDist = Math.hypot(edx, edy);
                    
                    if (eDist <= 200) {
                        const eAngle = Math.atan2(edy, edx);
                        let angleDiff = Math.abs(eAngle - angle);
                        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                        angleDiff = Math.abs(angleDiff);
                        
                        // If within +/- 90 degrees of attack angle (front half-circle)
                        if (angleDiff <= Math.PI / 2) {
                            targetsToHit.push(e);
                        }
                    }
                }
            });

            targetsToHit.forEach(t => {
                const dummyProjectile: RTProjectile = {
                    id: Math.random().toString(),
                    x: t.x, y: t.y,
                    vx: 0, vy: 0,
                    targetId: t.id, sourceId: source.id,
                    damage: dmg, isCrit: isCritHit,
                    color: source.isAlly ? '#facc15' : '#ef4444',
                    life: 0,
                    isLifesteal: attackerPassives.lifesteal > 0,
                    lifestealRatio: attackerPassives.lifesteal
                };
                resolveHit(t, dummyProjectile);
            });
        } else {
            // Ranged: fire projectile, NO slash VFX
            const isNpc = !source.isPlayer;
            if (isNpc) {
                if (source.rangedAttackCount === undefined) source.rangedAttackCount = 0;
                if (source.rangedProjectiles === undefined) source.rangedProjectiles = 1;

                source.rangedAttackCount += 1;
                const requiredAttacks = source.rangedProjectiles * 50;
                if (source.rangedAttackCount >= requiredAttacks) {
                    source.rangedProjectiles += 1;
                    source.rangedAttackCount = 0;
                    spawnVfx(`NÂNG CẤP ĐẠN: x${source.rangedProjectiles} Viên!`, source.x, source.y - 45, '#3b82f6');
                }
            }

            const projectileCount = isNpc ? (source.rangedProjectiles || 1) : 1;
            const spreadAngle = 0.20; // Khoảng 11 độ lệch giữa mỗi viên đạn để tạo hình quạt

            for (let j = 0; j < projectileCount; j++) {
                const offset = (j - (projectileCount - 1) / 2) * spreadAngle;
                const finalAngle = angle + offset;
                const vx = Math.cos(finalAngle) * 400;
                const vy = Math.sin(finalAngle) * 400;

                state.current.projectiles.push({
                    id: Math.random().toString(),
                    x: source.x, y: source.y,
                    vx: vx, vy: vy,
                    targetId: target.id, sourceId: source.id,
                    damage: dmg, isCrit: isCritHit,
                    color: source.isAlly ? '#facc15' : '#ef4444',
                    life: 7000, 
                    isUltimateStrike: false,
                    baseSize: 10,
                    isLifesteal: attackerPassives.lifesteal > 0,
                    lifestealRatio: attackerPassives.lifesteal
                });
            }
        }
    };

    const updatePhysics = (dt: number) => {
        const s = state.current;

        // If player is dead, allow camera panning using joystick / keys
        const player = s.entities.find(e => e.isPlayer);
        if (player && player.isDead) {
            const camSpeed = 1000; // Tốc độ di chuyển camera khi dùng phím/joystick (px/s)
            const dts = dt / 1000;
            s.cameraOffset.x += s.joystick.dx * camSpeed * dts;
            s.cameraOffset.y += s.joystick.dy * camSpeed * dts;
        } else if (!player) {
            const camSpeed = 1000;
            const dts = dt / 1000;
            s.cameraOffset.x += s.joystick.dx * camSpeed * dts;
            s.cameraOffset.y += s.joystick.dy * camSpeed * dts;
        } else {
            // Reset offset when alive
            s.cameraOffset = { x: 0, y: 0 };
        }

        // Handle Queue Spawning
        const maxLimit = graphicsConfig.maxUnitsPerSide || 4;
        const activeAlliesCount = s.entities.filter(e => e.isAlly && !e.isDead && !e.isObstacle && !e.isQueued && !e.isRetreatingToReserve).length;
        const activeEnemiesCount = s.entities.filter(e => !e.isAlly && !e.isDead && !e.isObstacle && !e.isQueued).length;

        if (activeAlliesCount < maxLimit) {
            const queuedAllies = s.entities.filter(e => e.isAlly && e.isQueued && !e.isDead);
            if (queuedAllies.length > 0) {
                // sort in place: highest power score first
                queuedAllies.sort((a, b) => (b.powerScore || 0) - (a.powerScore || 0));
                const spawnCount = Math.min(maxLimit - activeAlliesCount, queuedAllies.length);
                for (let i = 0; i < spawnCount; i++) {
                    queuedAllies[i].isQueued = false;
                    // Position at the left edge of the map
                    queuedAllies[i].x = 50;
                    queuedAllies[i].y = s.height / 2 + (Math.random() * 400 - 200);
                    spawnVfx("THAM CHIẾN!", queuedAllies[i].x, queuedAllies[i].y - 20, '#3b82f6');
                }
            }
        }
        
        if (activeEnemiesCount < maxLimit) {
            const queuedEnemies = s.entities.filter(e => !e.isAlly && e.isQueued && !e.isDead && !e.isObstacle);
            if (queuedEnemies.length > 0) {
                queuedEnemies.sort((a, b) => (b.powerScore || 0) - (a.powerScore || 0));
                const spawnCount = Math.min(maxLimit - activeEnemiesCount, queuedEnemies.length);
                for (let i = 0; i < spawnCount; i++) {
                    queuedEnemies[i].isQueued = false;
                    // Position at the right edge of the map
                    queuedEnemies[i].x = s.width - 50;
                    queuedEnemies[i].y = s.height / 2 + (Math.random() * 400 - 200);
                    spawnVfx("THAM CHIẾN!", queuedEnemies[i].x, queuedEnemies[i].y - 20, '#ef4444');
                }
            }
        }

        // Check if any enemy boss has died but hasn't had their reward processed
        const deadBoss = s.entities.find(e => e.isBoss && !e.isAlly && (e.hp <= 0 || e.isDead) && !e.bossRewardProcessed);
        if (deadBoss) {
            deadBoss.bossRewardProcessed = true;
            deadBoss.hp = 0;
            deadBoss.isDead = true;
            const ceStat = getMutableStats(deadBoss.combatant);
            if (ceStat) ceStat.sinhLuc = 0;

            const pool = [
                { id: 'speed', label: 'Tốc độ', desc: 'Tăng vĩnh viễn 1% tốc độ chạy' },
                { id: 'crit', label: 'Mãnh kích', desc: 'Tăng vĩnh viễn 2% tỉ lệ ra mãnh kích' },
                { id: 'shield_dur', label: 'Bảo vệ khiên', desc: 'Tăng vĩnh viễn 2% thời gian bảo vệ của khiên' },
                { id: 'shield_cd', label: 'Hồi chiêu khiên', desc: 'Tăng vĩnh viễn 1% tốc độ hồi chiêu khiên' },
                { id: 'dmg_red', label: 'Giảm sát thương', desc: 'Tăng vĩnh viễn 1% giảm sát thương' },
                { id: 'atk', label: 'Tấn công', desc: 'Tăng vĩnh viễn 1% tấn công khi chiến đấu' },
                { id: 'hp', label: 'Sinh lực', desc: 'Tăng vĩnh viễn 1% HP bổ sung' },
                { id: 'atk_spd', label: 'Tốc độ đánh', desc: 'Tăng vĩnh viễn 1% tốc độ tấn công thường' },
            ];
            // Shuffle and take 3
            const shuffled = [...pool].sort(() => 0.5 - Math.random());
            const options = shuffled.slice(0, 3);
            
            s.paused = true;
            setRewardModalData({ options });
            return; // Pause execution immediately
        }

        const dts = dt / 1000;
        s.totalTime += dt;

        // Screen effects timers
        if (s.screenShakeTimer > 0) s.screenShakeTimer -= dt;
        if (s.screenFlashTimer > 0) s.screenFlashTimer -= dt;

        // Count living
        const livingAllies = s.entities.filter(e => e.isAlly && !e.isDead && !e.isObstacle && !e.isQueued);
        const livingEnemies = s.entities.filter(e => !e.isAlly && !e.isDead && !e.isObstacle && !e.isQueued);

        // Boss Reveal Logic (1s mark)
        if (s.totalTime >= 1000 && !s.bossTriggered) {
            s.bossTriggered = true;
            if (Math.random() < 0.2 && livingEnemies.length > 0) {
                const boss = livingEnemies[Math.floor(Math.random() * livingEnemies.length)];
                boss.isBoss = true;
                boss.maxHp *= 3;
                boss.hp = boss.maxHp;
                spawnVfx("BOSS XUẤT HIỆN!", boss.x, boss.y - 60, '#ef4444');
                state.current.combatLogs.unshift(`[CẢNH BÁO] ${boss.combatant.name} đã thức tỉnh Boss Buff!`);
            }
        }

        // Size Scaling Logic (1.5s mark)
        if (s.totalTime >= 1500 && !s.sizeTriggered) {
            s.sizeTriggered = true;
            const player = s.entities.find(e => e.isPlayer);
            if (player) {
                const playerMaxHp = player.maxHp;
                s.entities.forEach(e => {
                    // Nếu NPC có HP > Player HP: Cứ 5% HP nhiều hơn tương ứng tăng 10% kích thước
                    // scale = 1.0 + ((NPC_HP - Player_HP) / Player_HP) * (10% / 5%) 
                    // => scale = 1.0 + (ratio - 1) * 2
                    if (!e.isDead && !e.isObstacle && !e.isPlayer && e.maxHp > playerMaxHp) {
                        const ratio = e.maxHp / playerMaxHp;
                        const factor = 1 + (ratio - 1) * 2; 
                        
                        // Giới hạn kích thước tối đa là gấp 5 lần để tránh tràn màn hình
                        const finalFactor = Math.min(5, factor); 
                        
                        e.radius *= finalFactor;
                        e.hasSizeScaled = true;
                        
                        if (finalFactor >= 1.2) {
                            spawnVfx("KHỔNG LỒ!", e.x, e.y - 60, '#a855f7');
                            state.current.combatLogs.unshift(`[THÔNG BÁO] ${e.combatant.name} có sinh lực dồi dào, cơ thể to lớn vượt trội (${(finalFactor * 100).toFixed(0)}%)!`);
                        }
                    }
                });
            }
        }

        if (livingEnemies.length === 0 && !combatEnded && s.running && !s.paused) {
            s.running = false;
            setCombatEnded('victory');
            setLootBoxStatus('closed');
            return;
        }
        if (livingAllies.length === 0 && !combatEnded && s.running) {
            s.running = false;
            setCombatEnded('defeat');
            return;
        }

        // --- NPC AI TARGET PRE-CALCULATION ---
        const playerEntity = s.entities.find(e => e.isPlayer);

        s.entities.forEach(entity => {
            updateRetreatingAndEnteringPhysics(entity, dt, s, spawnVfx, spawnAfterimage);
            if (entity.isDead || entity.isQueued || entity.isRetreatingToReserve) return;

            // ... (Status effects logic follows)

            // Update Status Effects
            if (entity.stunTimer && entity.stunTimer > 0) entity.stunTimer -= dt;
            
            // Channeling logic
            if (entity.channelTimer && entity.channelTimer > 0) {
                entity.channelTimer -= dt;
                
                if (entity.channelTimer <= 0) {
                    entity.channelTimer = 0;
                    
                    // Find a suitable target for the bomb
                    const enemies = entity.isAlly ? s.entities.filter(e => !e.isAlly && !e.isDead && !e.isObstacle) : s.entities.filter(e => e.isAlly && !e.isDead && !e.isObstacle);
                    let bombTarget = enemies.sort((a,b) => Math.hypot(a.x - entity.x, a.y - entity.y) - Math.hypot(b.x - entity.x, b.y - entity.y))[0];
                    
                    const tx = bombTarget ? bombTarget.x : entity.x + (entity.isAlly ? 500 : -500);
                    const ty = bombTarget ? bombTarget.y : entity.y;

                    // Finalize Beast Bomb firing
                    const entityStats = getMutableStats(entity.combatant);
                    const attackerAttack = entityStats?.sucTanCong || (entity.combatant as any)?.sucTanCong || 50;
                    const maxHp = entity.maxHp || entityStats?.maxSinhLuc || 1000;
                    const hpCost5Percent = Math.floor(maxHp * 0.05);
                    // Công thức sát thương mới: 3 * (chỉ số tấn công) + (5% maxHP caster)
                    const finalDamage = Math.floor(3 * attackerAttack + hpCost5Percent);

                    state.current.projectiles.push({
                        id: Math.random().toString(),
                        startX: entity.x,
                        startY: entity.y,
                        x: entity.x,
                        y: entity.y,
                        targetX: tx,
                        targetY: ty,
                        targetId: bombTarget ? bombTarget.id : '',
                        vx: 0, vy: 0, // Movement handled by arcProgress
                        sourceId: entity.id,
                        damage: finalDamage,
                        isBeastBomb: true,
                        arcProgress: 0,
                        life: 3000, // Longer life for parabolic flight
                        maxLife: 3000,
                        color: '#000000',
                        baseSize: 18,
                        isCrit: false,
                        hitIds: []
                    });
                    spawnVfx("BOM VĨ THÚ XUẤT PHÁT!", entity.x, entity.y - 40, '#ef4444');
                }
            }

            if (entity.slowTimer && entity.slowTimer > 0) {
                entity.slowTimer -= dt;
                if (entity.slowTimer <= 0) entity.slowRate = undefined;
            }
            if (entity.poisonTimer && entity.poisonTimer > 0) {
                entity.poisonTimer -= dt;
                entity.poisonTickTimer = (entity.poisonTickTimer || 0) + dt;
                if (entity.poisonTickTimer >= 1000) {
                    entity.poisonTickTimer = 0;
                    const dmg = Math.max(1, Math.floor(entity.maxHp * 0.02)); // 2% HP per sec
                    entity.hp -= dmg;
                    if (entity.hp < 0) entity.hp = 0;
                    spawnVfx(`ĐỘC -${dmg}`, entity.x, entity.y - 25, '#a855f7');
                    const stats = getMutableStats(entity.combatant);
                    if (stats) stats.sinhLuc = entity.hp;
                    if (entity.hp <= 0) { 
                        entity.isDead = true; 
                        s.combatLogs.push(`${entity.combatant.name} tử vong vì kịch độc.`); 
                    }
                }
            }

            if (entity.thuTimer && entity.thuTimer > 0) entity.thuTimer -= dt;
            if (entity.tocTimer && entity.tocTimer > 0) entity.tocTimer -= dt;
            if (entity.hoanTimer && entity.hoanTimer > 0) entity.hoanTimer -= dt;
            if (entity.camTimer && entity.camTimer > 0) entity.camTimer -= dt;
            if (entity.phaTimer && entity.phaTimer > 0) entity.phaTimer -= dt;
            if (entity.docTimer && entity.docTimer > 0) {
                entity.docTimer -= dt;
                entity.docTickTimer = (entity.docTickTimer || 0) + dt;
                if (entity.docTickTimer >= 500) {
                    entity.docTickTimer = 0;
                    const dmg = Math.max(1, Math.floor(entity.maxHp * 0.01));
                    entity.hp -= dmg;
                    if (entity.hp < 0) entity.hp = 0;
                    spawnVfx("-" + dmg, entity.x, entity.y - 15, '#ef4444');
                    const stats = getMutableStats(entity.combatant);
                    if (stats) stats.sinhLuc = entity.hp;
                    if (entity.hp <= 0) {
                        entity.isDead = true; 
                        if (!entity.isObstacle) s.combatLogs.push(`${entity.combatant.name} tử vong vì Thi Độc Chú.`);
                    }
                }
            }

            // Cập nhật DoT của Liệt Hỏa Phần Thiên (5s, mỗi giây 1/10 dmg, icon 🔥 nhỏ dưới chân)
            updateEntityBurnDoT(entity, dt, s, spawnVfx, getMutableStats);

            if (!entity.isDead && entity.hp <= 0) {
                entity.hp = 0;
                entity.isDead = true;
                const ceStat = getMutableStats(entity.combatant);
                if (ceStat) ceStat.sinhLuc = 0;

                if (entity.isObstacle) {
                    // Respawn logic: reset this entity as a new obstacle elsewhere after it dies
                    const obstacleEmojis = ["🌲", "🏔️", "⛰️", "🌳", "🪨", "🪵"];
                    let newX = 0, newY = 0;
                    let validPos = false;
                    for (let attempts = 0; attempts < 10; attempts++) {
                        newX = Math.random() * (s.width - 400) + 200;
                        newY = Math.random() * (s.height - 400) + 200;
                        const isOverlap = s.entities.some(e => !e.isDead && e.id !== entity.id && Math.hypot(e.x - newX, e.y - newY) < (e.radius + 60));
                        if (!isOverlap) {
                            validPos = true;
                            break;
                        }
                    }
                    if (!validPos) {
                        newX = Math.random() * (s.width - 400) + 200;
                        newY = Math.random() * (s.height - 400) + 200;
                    }
                    entity.x = newX;
                    entity.y = newY;
                    entity.hp = (knowledgeBase.playerStats.maxSinhLuc || 100) * 0.1;
                    entity.maxHp = entity.hp;
                    entity.isDead = false;
                    entity.emoji = obstacleEmojis[Math.floor(Math.random() * obstacleEmojis.length)];
                    entity.radius = 40 + Math.random() * 40;
                    spawnVfx(`MỚI!`, entity.x, entity.y - 20, '#22c55e');
                } else if (!entity.isAlly) {
                    s.combatLogs.push(`${entity.combatant.name} bị hạ gục!`);
                }
            }
            if (entity.isDead || entity.isObstacle) return;

            // Update Beast Bomb timers if any
            if (entity.beastBombAirborneTimer && entity.beastBombAirborneTimer > 0) {
                entity.beastBombAirborneTimer -= dt;
                if (entity.beastBombAirborneTimer <= 0) {
                    entity.beastBombAirborneTimer = 0;
                    entity.beastBombLandTimer = 1000; // 1s landing time
                    if (entity.beastBombTargetX !== undefined) entity.x = entity.beastBombTargetX;
                    if (entity.beastBombTargetY !== undefined) entity.y = entity.beastBombTargetY;
                } else {
                    const totalDur = 1500; // 1.5s
                    const elapsed = totalDur - entity.beastBombAirborneTimer;
                    const progress = Math.min(1.0, elapsed / totalDur);
                    if (entity.beastBombStartX !== undefined && entity.beastBombTargetX !== undefined) {
                        entity.x = entity.beastBombStartX + (entity.beastBombTargetX - entity.beastBombStartX) * progress;
                    }
                    if (entity.beastBombStartY !== undefined && entity.beastBombTargetY !== undefined) {
                        entity.y = entity.beastBombStartY + (entity.beastBombTargetY - entity.beastBombStartY) * progress;
                    }
                }
            } else if (entity.beastBombLandTimer && entity.beastBombLandTimer > 0) {
                entity.beastBombLandTimer -= dt;
                if (entity.beastBombLandTimer <= 0) {
                    entity.beastBombLandTimer = 0;
                }
            }

            // Status Restriction: Stun
            const isStunned = (entity.stunTimer && entity.stunTimer > 0) || 
                              (entity.beastBombAirborneTimer && entity.beastBombAirborneTimer > 0) || 
                              (entity.beastBombLandTimer && entity.beastBombLandTimer > 0);
            const isSlowed = entity.slowTimer && entity.slowTimer > 0;

            // Attack & Skill & Shield cooldowns
            if (entity.attackCooldown > 0) entity.attackCooldown -= dt;
            if (entity.globalCooldown > 0) entity.globalCooldown -= dt;
            if (entity.skillCooldown && entity.skillCooldown > 0) entity.skillCooldown -= dt;
            if (entity.shieldCd > 0) entity.shieldCd -= dt;
            if (entity.shieldTimer > 0) entity.shieldTimer -= dt;

            updateAuraFarmingTimer(entity, dt, s, spawnVfx);

            // Boss Logic: Phase Transition & Enraged Skills
            const bossStats = getMutableStats(entity.combatant);
            const bossAtk = bossStats?.sucTanCong || 0;

            if (entity.isBoss && !isStunned) {
                // Super Beast Bomb Trigger when HP < 10% MaxHP
                const isTriggerBoss = (entity.combatant as any).triggerBoss || entity.combatant.name.toLowerCase().includes('triggerboss');
                if (isTriggerBoss && !entity.hasTriggeredSuperBeastBomb && entity.hp > 0 && entity.hp < entity.maxHp * 0.10) {
                    entity.hasTriggeredSuperBeastBomb = true;
                    spawnVfx("SIÊU CẤP BOM VĨ THÚ! 💥💥💥💥", entity.x, entity.y - 70, '#ef4444');
                    s.combatLogs.unshift(`[TUYỆT KỸ] ${entity.combatant.name} tụ lực giải phóng SIÊU CẤP BOM VĨ THÚ về 4 hướng!`);
                    
                    const entityStats = getMutableStats(entity.combatant);
                    const attackerAttack = entityStats?.sucTanCong || (entity.combatant as any)?.sucTanCong || 50;
                    const maxHp = entity.maxHp || entityStats?.maxSinhLuc || 1000;
                    const hpCost5Percent = Math.floor(maxHp * 0.05);
                    const finalDamage = Math.floor(3 * attackerAttack + hpCost5Percent);

                    const directions = [
                        { dx: 500, dy: 0 },   // Đông
                        { dx: -500, dy: 0 },  // Tây
                        { dx: 0, dy: 500 },   // Nam
                        { dx: 0, dy: -500 },  // Bắc
                    ];

                    directions.forEach(dir => {
                        const tx = entity.x + dir.dx;
                        const ty = entity.y + dir.dy;
                        s.projectiles.push({
                            id: Math.random().toString(),
                            startX: entity.x,
                            startY: entity.y,
                            x: entity.x,
                            y: entity.y,
                            targetX: tx,
                            targetY: ty,
                            targetId: '',
                            vx: 0, vy: 0,
                            sourceId: entity.id,
                            damage: finalDamage,
                            isBeastBomb: true,
                            scaleMultiplier: 3,
                            arcProgress: 0,
                            life: 3000,
                            maxLife: 3000,
                            color: '#000000',
                            baseSize: 54,
                            isCrit: false,
                            hitIds: []
                        });
                    });
                }

                // Phase Transition Trigger
                if (!entity.isEnraged && entity.hp < entity.maxHp * 0.5) {
                    entity.isEnraged = true;
                    entity.speed *= 1.5;
                    entity.bossSkillTimer = 2000; // Delay before first skill
                    entity.bossSkillPhase = 'idle';
                    spawnVfx("PHASE 2: NỔI ĐIÊN 💢", entity.x, entity.y - 60, '#ef4444');
                    state.current.combatLogs.unshift(`[CẢNH BÁO] ${entity.combatant.name} đang điên cuồng bộc phát sức mạnh!`);
                }

                if (entity.isEnraged) {
                    const isTriggerBoss = (entity.combatant as any).triggerBoss || entity.combatant.name.toLowerCase().includes('triggerboss');
                    const skillInterval = isTriggerBoss ? 10000 : 3000;
                    if (!entity.bossSkillTimer) entity.bossSkillTimer = skillInterval;
                    entity.bossSkillTimer -= dt;

                    if (entity.bossSkillTimer <= 0) {
                        if (entity.bossSkillPhase === 'idle') {
                            // Choose a new skill
                            const skills: ('bullet_hell' | 'aoe_slam' | 'dash' | 'laser' | 'summon' | 'lightning' | 'shield')[] = ['bullet_hell', 'aoe_slam', 'dash', 'laser', 'summon', 'lightning', 'shield'];
                            entity.bossSkillType = skills[Math.floor(Math.random() * skills.length)];
                            entity.bossSkillPhase = 'telegraph';
                            entity.bossSkillTimer = (isTriggerBoss && entity.bossSkillType === 'laser') ? 1000 : 1000; 
                            
                            if (entity.bossSkillType === 'aoe_slam') {
                                // Telegraph position near player or target
                                const target = entity.isAlly ? livingEnemies[0] : livingAllies[0];
                                entity.bossTelegraphPos = target ? {x: target.x, y: target.y} : {x: entity.x, y: entity.y};
                                entity.bossTelegraphRadius = 50;
                            } else if (entity.bossSkillType === 'dash') {
                                const target = entity.isAlly ? livingEnemies[0] : livingAllies[0];
                                entity.bossTelegraphPos = target ? {x: target.x, y: target.y} : {x: entity.x, y: entity.y};
                            } else if (entity.bossSkillType === 'summon') {
                                entity.bossSkillTimer = 500;
                            } else {
                                entity.bossSkillTimer = (isTriggerBoss && entity.bossSkillType === 'laser') ? 1000 : 1000;
                            }
                        } else if (entity.bossSkillPhase === 'telegraph') {
                            entity.bossSkillPhase = 'action';
                            
                            // Execute Initial Action Setup based on type
                            if (entity.bossSkillType === 'aoe_slam') {
                                entity.bossSkillTimer = 1000; // 3 expanding rings over 1s
                                // Spawn center explosion 💥
                                const targets = entity.isAlly ? livingEnemies : livingAllies;
                                targets.forEach(t => {
                                    if (entity.bossTelegraphPos && Math.hypot(t.x - entity.bossTelegraphPos.x, t.y - entity.bossTelegraphPos.y) < 200) {
                                        const dmg = 30 + bossAtk;
                                        t.hp -= dmg; // Center Damage
                                        spawnVfx(`-${dmg}!!`, t.x, t.y - 20, '#ef4444');
                                    }
                                });
                                spawnVfx("💥", entity.bossTelegraphPos!.x, entity.bossTelegraphPos!.y, '#ef4444');
                            } else if (entity.bossSkillType === 'lightning') {
                                entity.bossSkillTimer = 1500; // Duration of lightning strikes
                                spawnVfx("THIÊN LÔI BIẾN! ⚡", entity.x, entity.y - 60, '#facc15');
                            } else if (entity.bossSkillType === 'shield') {
                                entity.bossSkillTimer = 2000; // Duration of shield
                                entity.shieldTimer = 2000;
                                spawnVfx("LÁ CHẮN BOSS! 🛡️", entity.x, entity.y - 60, '#38bdf8');
                                state.current.combatLogs.unshift(`[CẢNH BÁO] ${entity.combatant.name} đã triển khai Lá Chắn tuyệt đối!`);
                            } else if (entity.bossSkillType === 'dash') {
                                entity.bossSkillTimer = 1000; // Action duration 
                            } else if (entity.bossSkillType === 'bullet_hell') {
                                entity.bossSkillTimer = 3000;
                            } else if (entity.bossSkillType === 'laser') {
                                entity.bossSkillTimer = 5000; // 5s duration
                                // Initialize angle towards target
                                const target = entity.isAlly ? livingEnemies[0] : (playerEntity && playerEntity.hp > 0 ? playerEntity : livingAllies[0]);
                                if (target) {
                                    entity.currentLaserAngle = Math.atan2(target.y - entity.y, target.x - entity.x);
                                } else {
                                    entity.currentLaserAngle = 0;
                                }
                                spawnVfx("DIỆT THẾ CHI QUANG! ☄️", entity.x, entity.y - 60, '#ef4444');
                            } else if (entity.bossSkillType === 'summon') {
                                // Boss checking if old minions are still alive
                                const currentMinions = s.entities.filter(e => e.combatant.name === 'Tay sai BOSS' && !e.isDead);
                                if (currentMinions.length > 0) {
                                     // Skip summon if minions exist
                                     entity.bossSkillPhase = 'idle';
                                     entity.bossSkillTimer = 1000;
                                     return;
                                }

                                entity.bossSkillTimer = 500;
                                const bossAtkVal = bossStats?.sucTanCong || 10;
                                const minionAtk = Math.max(1, Math.floor(bossAtkVal * 0.05));
                                const minionHp = Math.floor(entity.maxHp * 0.05);

                                for(let i=0; i<3; i++) {
                                    const minion: RTEntity = {
                                        id: `${entity.id}_minion_${Date.now()}_${i}`,
                                        combatant: { 
                                            ...entity.combatant, 
                                            id: `minion_${entity.id}_${Date.now()}_${i}`, 
                                            name: 'Tay sai BOSS', 
                                            playerSkills: [], 
                                            skills: [],
                                            stats: { 
                                                ...bossStats, 
                                                sucTanCong: minionAtk,
                                                sinhLuc: minionHp,
                                                maxSinhLuc: minionHp
                                            }
                                        } as any,
                                        isPlayer: false,
                                        isAlly: entity.isAlly,
                                        x: entity.x + (Math.random() * 100 - 50),
                                        y: entity.y + (Math.random() * 100 - 50),
                                        vx: 0,
                                        vy: 0,
                                        radius: 12,
                                        globalCooldown: 0,
                                        speed: 150,
                                        attackRange: 80,
                                        attackCooldown: 1000,
                                        maxAttackCooldown: 1000,
                                        hp: minionHp,
                                        maxHp: minionHp,
                                        isDead: false,
                                        aiDecisionTimer: 1000,
                                        circleDir: 1,
                                        dodgeTimer: 0,
                                        shieldTimer: 0,
                                        shieldCd: 0,
                                        emoji: '👾',
                                        aiMode: 'combat',
                                        aiModeTimer: 5000,
                                        isSummoned: true,
                                        attackType: 'melee'
                                    };
                                    state.current.entities.push(minion);
                                }
                                spawnVfx("TRIỆU HỒI!", entity.x, entity.y - 40, '#a855f7');
                            }
                        } else if (entity.bossSkillPhase === 'action') {
                            entity.bossSkillPhase = 'idle';
                            const nextInterval = ((entity.combatant as any).triggerBoss || entity.combatant.name.toLowerCase().includes('triggerboss')) ? 10000 : (3000 + Math.random() * 2000);
                            entity.bossSkillTimer = nextInterval; // Cooldown between skills
                            entity.bossTelegraphPos = undefined;
                        }
                    }
                    
                    // Continuous Action handling
                    if (entity.bossSkillPhase === 'action') {
                        if (entity.bossSkillType === 'bullet_hell') {
                            // Fire circular wave of ⚡ every 200ms
                            if (Math.floor(entity.bossSkillTimer) % 200 < dt) {
                                const numProjectiles = 12;
                                for(let i=0; i<numProjectiles; i++) {
                                    const angle = (i / numProjectiles) * Math.PI * 2 + (entity.bossSkillTimer / 500); 
                                    const vx = Math.cos(angle) * 200;
                                    const vy = Math.sin(angle) * 200;
                                    state.current.projectiles.push({
                                        id: `boss_hell_${Date.now()}_${Math.random()}`,
                                        x: entity.x, y: entity.y,
                                        vx, vy, targetId: '', sourceId: entity.id,
                                        damage: 5 + (entity.hp / entity.maxHp) * 10 + bossAtk,
                                        isCrit: false, color: '#facc15', life: 7000,
                                        isPiercing: true
                                    });
                                }
                            }
                        } else if (entity.bossSkillType === 'aoe_slam') {
                            // Expanding rings 🌋 - Radius x4, Icon size x5 in render, Duration 1s
                            const t = Math.floor(entity.bossSkillTimer);
                            let spawnRing = -1;
                            if (t < 800 && t + dt >= 800) spawnRing = 1; 
                            else if (t < 500 && t + dt >= 500) spawnRing = 2; 
                            else if (t <= 0 && t + dt > 0) spawnRing = 3; 
                            
                            if (spawnRing > 0) {
                                const radius = 200 + spawnRing * 200; // 400, 600, 800 (x4 of original 100, 150, 200)
                                const targets = entity.isAlly ? livingEnemies : livingAllies;
                                targets.forEach(target => {
                                    if (entity.bossTelegraphPos && Math.hypot(target.x - entity.bossTelegraphPos.x, target.y - entity.bossTelegraphPos.y) < radius + 40) {
                                        const dmg = 20 + bossAtk;
                                        target.hp -= dmg; 
                                        spawnVfx(`-${dmg}`, target.x, target.y - 20, '#ef4444');
                                    }
                                });
                                // Spawn VFX around circle
                                const numVfx = 12 + spawnRing * 6;
                                for(let i=0; i<numVfx; i++) {
                                    const angle = (i / numVfx) * Math.PI * 2;
                                    s.vfx.push({
                                        id: `slam_ring_${Date.now()}_${Math.random()}`,
                                        text: "🌋", x: entity.bossTelegraphPos!.x + Math.cos(angle)*radius, y: entity.bossTelegraphPos!.y + Math.sin(angle)*radius,
                                        color: '#ef4444', life: 1000, maxLife: 1000
                                    });
                                }
                            }
                        } else if (entity.bossSkillType === 'lightning') {
                            // Map-wide Lightning Strikes every 150ms
                            if (Math.floor(entity.bossSkillTimer) % 150 < dt) {
                                const targets = entity.isAlly ? livingEnemies : livingAllies;
                                targets.forEach(t => {
                                    if (Math.random() < 0.3) {
                                        const dmg = 15 + bossAtk;
                                        t.hp -= dmg;
                                        spawnVfx("⚡", t.x, t.y - 40, '#facc15');
                                        spawnVfx(`-${dmg}`, t.x, t.y - 20, '#ef4444');
                                        // Spawn Tornado 🌪️ size x6 lingering for 3s
                                        s.vfx.push({
                                            id: `lightning_torn_${Date.now()}_${Math.random()}`,
                                            text: "🌪️", x: t.x, y: t.y,
                                            color: '#94a3b8', life: 3000, maxLife: 3000
                                        });
                                    }
                                });
                                // Random strikes on map
                                for(let i=0; i<3; i++) {
                                    const rx = Math.random() * s.width;
                                    const ry = Math.random() * s.height;
                                    spawnVfx("⚡", rx, ry, '#facc15');
                                    s.vfx.push({
                                        id: `lightning_torn_rnd_${Date.now()}_${Math.random()}`,
                                        text: "🌪️", x: rx, y: ry,
                                        color: '#94a3b8', life: 3000, maxLife: 3000
                                    });
                                }
                            }
                        } else if (entity.bossSkillType === 'dash') {
                            // Fast dash towards bossTelegraphPos
                            if (entity.bossTelegraphPos) {
                                const dx = entity.bossTelegraphPos.x - entity.x;
                                const dy = entity.bossTelegraphPos.y - entity.y;
                                const dist = Math.hypot(dx, dy);
                                const moveDist = 800 * dts;
                                
                                if (dist <= moveDist) {
                                    entity.x = entity.bossTelegraphPos.x;
                                    entity.y = entity.bossTelegraphPos.y;
                                    entity.bossSkillTimer = 0; // End dash
                                } else {
                                    entity.x += (dx / dist) * moveDist;
                                    entity.y += (dy / dist) * moveDist;
                                }
                                spawnAfterimage(entity);
                                
                                const targets = entity.isAlly ? livingEnemies : livingAllies;
                                targets.forEach(target => {
                                    if (Math.hypot(target.x - entity.x, target.y - entity.y) < entity.radius + target.radius + 10) {
                                        if (target.dodgeTimer <= 0) { 
                                            const dmg = 15 + bossAtk;
                                            target.hp -= dmg;
                                            target.dodgeTimer = 1000; // Stun
                                            spawnVfx("STUN!", target.x, target.y - 20, '#facc15');
                                        }
                                    }
                                });
                            }
                        } else if (entity.bossSkillType === 'laser') {
                            // Rotating Mega Laser Logic: 5 deg/s
                            const target = entity.isAlly ? livingEnemies[0] : (playerEntity && playerEntity.hp > 0 ? playerEntity : livingAllies[0]);
                            if (target && entity.currentLaserAngle !== undefined) {
                                const targetAngle = Math.atan2(target.y - entity.y, target.x - entity.x);
                                
                                // Normalize angles
                                let diff = targetAngle - entity.currentLaserAngle;
                                while (diff < -Math.PI) diff += Math.PI * 2;
                                while (diff > Math.PI) diff -= Math.PI * 2;
                                
                                // Rotate at 5 degrees per second (conveted to rad per frame)
                                const maxRotate = (5 * Math.PI / 180) * (dt / 1000);
                                if (Math.abs(diff) < maxRotate) {
                                    entity.currentLaserAngle = targetAngle;
                                } else {
                                    entity.currentLaserAngle += Math.sign(diff) * maxRotate;
                                }

                                // Damage logic (check collision along the infinite beam)
                                const beamLen = 5000;
                                const lx2 = entity.x + Math.cos(entity.currentLaserAngle) * beamLen;
                                const ly2 = entity.y + Math.sin(entity.currentLaserAngle) * beamLen;
                                
                                const victims = entity.isAlly ? livingEnemies : livingAllies;
                                victims.forEach(v => {
                                    // Distance between point and infinite line logic
                                    const x1 = entity.x, y1 = entity.y;
                                    const x2 = lx2, y2 = ly2;
                                    const px = v.x, py = v.y;
                                    
                                    const lineLenSq = (x2-x1)**2 + (y2-y1)**2;
                                    if (lineLenSq === 0) return;
                                    
                                    const t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / lineLenSq;
                                    
                                    // We only care about points in front of the boss
                                    if (t >= 0) {
                                        const projX = x1 + t * (x2 - x1);
                                        const projY = y1 + t * (y2 - y1);
                                        const dist = Math.hypot(px - projX, py - projY);
                                        
                                        if (dist < 60) {
                                            // Boss Laser Damage: 1% HP every 0.2s
                                            const now = performance.now();
                                            if (!v.lastLaserHitTime || now - v.lastLaserHitTime >= 200) {
                                                v.lastLaserHitTime = now;
                                                const dmg = Math.max(1, Math.floor(v.maxHp * 0.01));
                                                v.hp -= dmg;
                                                if (v.hp < 0) v.hp = 0;
                                                const stats = getMutableStats(v.combatant);
                                                if (stats) stats.sinhLuc = v.hp;
                                                spawnVfx(`-${dmg}`, v.x, v.y - 20, '#ef4444');
                                                if (v.hp <= 0) {
                                                     v.isDead = true;
                                                     s.combatLogs.push(`${v.combatant.name} bị tiêu diệt bởi tia laser!`);
                                                }
                                            }
                                        }
                                    }
                                });
                            }
                        }
                    }
                }
            }

            let dx = 0, dy = 0;

            let currentSpeed = entity.speed;
            if (entity.attackType === 'melee') {
                currentSpeed *= 1.15; // Cận chiến tăng 15% tốc độ di chuyển
            }
            if (entity.tocTimer && entity.tocTimer > 0) currentSpeed *= 1.5;
            if (entity.hoanTimer && entity.hoanTimer > 0) currentSpeed *= 0.5;
            if (entity.slowTimer && entity.slowTimer > 0) currentSpeed *= (1 - (entity.slowRate || 0.3));

            if (entity.isPlayer) {
                if (isStunned) {
                    dx = 0;
                    dy = 0;
                } else {
                    dx = s.joystick.dx * currentSpeed * dts;
                    dy = s.joystick.dy * currentSpeed * dts;
                }
                
                // MC: Target selection
                let primaryTarget = null;
                if (s.lockedTargetId) {
                    primaryTarget = livingEnemies.find(e => e.id === s.lockedTargetId);
                }
                
                if (!primaryTarget) {
                    let mcMinDist = Infinity;
                    livingEnemies.forEach(e => {
                        const d = Math.hypot(e.x - entity.x, e.y - entity.y);
                        if (d < mcMinDist) {
                            mcMinDist = d;
                            primaryTarget = e;
                        }
                    });
                    if (primaryTarget) {
                        s.lockedTargetId = primaryTarget.id;
                        setLockedTargetId(primaryTarget.id);
                    } else {
                        s.lockedTargetId = null;
                        setLockedTargetId(null);
                    }
                }

                if (entity.attackCooldown <= 0 && primaryTarget) {
                    const effectiveRange = entity.attackType === 'melee' ? 200 : entity.attackRange;
                    let targetToAttack = primaryTarget;
                    
                    if (Math.hypot(primaryTarget.x - entity.x, primaryTarget.y - entity.y) > effectiveRange) {
                         const enemiesInRange = livingEnemies.filter(e => Math.hypot(e.x - entity.x, e.y - entity.y) <= effectiveRange);
                         if (enemiesInRange.length > 0) {
                              targetToAttack = enemiesInRange.sort((a,b) => Math.hypot(a.x - entity.x, a.y - entity.y) - Math.hypot(b.x - entity.x, b.y - entity.y))[0];
                         }
                    }

                    if (Math.hypot(targetToAttack.x - entity.x, targetToAttack.y - entity.y) <= effectiveRange) {
                        entity.attackCooldown = entity.maxAttackCooldown;
                        handleAttack(entity, targetToAttack);
                    }
                }
            } else {
                // NPC AI: Direct Aggressive Attack & Strategic Movement / Defensive Guard
                const enemies = entity.isAlly ? livingEnemies : livingAllies;
                const isAllyNpc = entity.isAlly && !entity.isPlayer;
                const isDefenseStance = isAllyNpc && s.allyStance === 'defense';
                const player = s.entities.find(e => e.isPlayer && !e.isDead);

                let nearest: RTEntity | null = null;

                if (isDefenseStance && player) {
                    // Chế độ PHÒNG THỦ: Tính toán mục tiêu phòng thủ (ưu tiên kẻ địch trong tầm 600 từ player hoặc trong tầm đánh)
                    const defResult = calculateAllyDefenseMovement(entity, player, enemies);
                    nearest = defResult.targetEnemy as RTEntity | null;
                } else {
                    // Chế độ TẤN CÔNG (hoặc quái địch): Target selection - find closest or lowest HP enemy
                    if (enemies.length > 0) {
                        const enemiesIn800 = enemies.filter(e => Math.hypot(e.x - entity.x, e.y - entity.y) <= 800);
                        if (enemiesIn800.length > 0) {
                            // Ưu tiên yếu máu nhất trong tầm 800
                            nearest = [...enemiesIn800].sort((a, b) => a.hp - b.hp)[0];
                        } else {
                            // Nếu không ai trong tầm 800, tìm kẻ gần nhất
                            nearest = [...enemies].sort((a, b) => Math.hypot(a.x - entity.x, a.y - entity.y) - Math.hypot(b.x - entity.x, b.y - entity.y))[0];
                        }
                    }
                }

                // AI tiếp tục xử lý di chuyển và hành vi nếu có kẻ địch hoặc đang ở chế độ phòng thủ quanh người chơi
                if (nearest || (isDefenseStance && player)) {
                    entity.aiDecisionTimer -= dt;
                    if (entity.aiDecisionTimer <= 0) {
                        entity.aiDecisionTimer = 1000 + Math.random() * 500;
                        entity.circleDir = Math.random() > 0.5 ? 1 : -1;
                    }

                    let targetDx = 0;
                    let targetDy = 0;

                    // Move logic
                    if (entity.isDead || isStunned) return;

                    const hpRatio = entity.hp / entity.maxHp;
                    // CHỈ rút lui khỏi tầm tấn công của kẻ địch khi đã dưới 15% HP
                    const isRetreating = hpRatio < 0.15;
                    const isChanneling = entity.channelTimer && entity.channelTimer > 0;

                    // AI khi có < 50% HP sẽ chủ động tìm và chạy vào trong Aura Zone (Vùng Trị Liệu / Linh Thuẫn) cùng phe
                    let targetFriendlyAura: RTAura | null = null;
                    if (hpRatio < 0.5 && !isChanneling) {
                        let nearestAuraDist = Infinity;
                        s.auras.forEach(aura => {
                            const auraCaster = s.entities.find(c => c.id === aura.casterId);
                            if (auraCaster && !auraCaster.isDead && auraCaster.isAlly === entity.isAlly) {
                                const distToAuraCenter = Math.hypot(auraCaster.x - entity.x, auraCaster.y - entity.y);
                                if (distToAuraCenter < nearestAuraDist) {
                                    nearestAuraDist = distToAuraCenter;
                                    targetFriendlyAura = aura;
                                }
                            }
                        });
                    }

                    // Apply Speed multiplier
                    let moveSpeed = currentSpeed;
                    if (isSlowed) moveSpeed *= (1 - (entity.slowRate || 0.3));
                    if (entity.isEnraged) moveSpeed *= 1.5;

                    if (targetFriendlyAura) {
                        const auraCaster = s.entities.find(c => c.id === targetFriendlyAura!.casterId);
                        if (auraCaster) {
                            const distToAuraCenter = Math.hypot(auraCaster.x - entity.x, auraCaster.y - entity.y);
                            // Nếu ở ngoài hoặc sát viền Aura Zone (bán kính 250), lập tức chạy về phía tâm Aura Zone
                            if (distToAuraCenter > 150) {
                                targetDx = (auraCaster.x - entity.x) / (distToAuraCenter || 1);
                                targetDy = (auraCaster.y - entity.y) / (distToAuraCenter || 1);
                                moveSpeed *= 1.3; // Chạy nhanh hơn khi đang tìm nơi trú ẩn
                            } else {
                                if (nearest) {
                                    const targetDist = Math.hypot(nearest.x - entity.x, nearest.y - entity.y) || 1;
                                    const effectiveRange = entity.attackType === 'melee' ? 180 : (entity.attackRange || 450);
                                    const stopDist = entity.attackType === 'melee' ? 100 : effectiveRange * 0.8;
                                    if (targetDist > stopDist) {
                                        targetDx = (nearest.x - entity.x) / targetDist;
                                        targetDy = (nearest.y - entity.y) / targetDist;
                                    } else {
                                        targetDx = (nearest.x - entity.x) / targetDist * 0.2;
                                        targetDy = (nearest.y - entity.y) / targetDist * 0.2;
                                    }
                                }
                            }
                        }
                    } else if (isRetreating && nearest) {
                        // Tháo chạy né đòn khi HP dưới 15%
                        const targetDist = Math.hypot(nearest.x - entity.x, nearest.y - entity.y) || 1;
                        targetDx = (entity.x - nearest.x) / targetDist;
                        targetDy = (entity.y - nearest.y) / targetDist;
                        
                        // Avoid walls when running away so they don't get trapped
                        const wallMargin = 200;
                        if (entity.x < wallMargin) targetDx += (wallMargin - entity.x) / wallMargin * 2.5;
                        if (entity.x > s.width - wallMargin) targetDx -= (entity.x - (s.width - wallMargin)) / wallMargin * 2.5;
                        if (entity.y < wallMargin) targetDy += (wallMargin - entity.y) / wallMargin * 2.5;
                        if (entity.y > s.height - wallMargin) targetDy -= (entity.y - (s.height - wallMargin)) / wallMargin * 2.5;

                        moveSpeed *= 1.25;
                    } else if (isDefenseStance && player) {
                        // Chế độ PHÒNG THỦ: Tụ tập bảo vệ người chơi & phản ứng kẻ địch trong tầm 600
                        const defResult = calculateAllyDefenseMovement(entity, player, enemies);
                        targetDx = defResult.moveVec.dx;
                        targetDy = defResult.moveVec.dy;
                    } else if (nearest) {
                        // Chế độ TẤN CÔNG (hoặc quái địch): Áp sát hoặc Kiting đúng khoảng cách chuẩn
                        const targetDist = Math.hypot(nearest.x - entity.x, nearest.y - entity.y) || 1;
                        const moveVec = calculateNpcAiMovement(entity, nearest, targetDist);
                        targetDx = moveVec.dx;
                        targetDy = moveVec.dy;
                    }

                    // Dodge & Shield logic: check nearby projectiles
                    s.projectiles.forEach(p => {
                        if (p.isHeal || p.sourceId === entity.id) return;
                        const distToProj = Math.hypot(p.x - entity.x, p.y - entity.y);
                        
                        const triggerDist = 120;
                        if (distToProj < triggerDist && entity.shieldCd <= 0) {
                            entity.shieldTimer = 800;
                            entity.shieldCd = 4000;
                            spawnVfx("KHIÊN!", entity.x, entity.y - 40, '#38bdf8');
                        }

                        if (distToProj < 200) {
                            const pMag = Math.hypot(p.vx, p.vy) || 1;
                            const pnx = -p.vy / pMag;
                            const pny = p.vx / pMag;
                            const dodgeWeight = ((200 - distToProj) / 200) * 3;
                            targetDx += pnx * dodgeWeight;
                            targetDy += pny * dodgeWeight;
                        }
                    });

                    // Ally Separation (Nhẹ nhàng để không gây cản trở nhau tiến công)
                    s.entities.forEach(ally => {
                        if (ally.id !== entity.id && ally.isAlly === entity.isAlly && !ally.isDead && !ally.isObstacle) {
                            const allyDist = Math.hypot(ally.x - entity.x, ally.y - entity.y);
                            if (allyDist < 40 && allyDist > 0) {
                                targetDx += ((entity.x - ally.x) / allyDist) * 0.3;
                                targetDy += ((entity.y - ally.y) / allyDist) * 0.3;
                            }
                        }
                    });

                    // 2.6. Obstacle Avoidance (Biết né vật cản - Tối ưu)
                    s.entities.forEach(obs => {
                        if (obs.isObstacle && !obs.isDead) {
                            const obDist = Math.hypot(obs.x - entity.x, obs.y - entity.y);
                            const avoidRadius = obs.radius + entity.radius + 120; // Tăng vùng nhận diện
                            if (obDist < avoidRadius && obDist > 0) {
                                // Steer away strongly from obstacle
                                const urgency = ((avoidRadius - obDist) / avoidRadius) * 6; // Tăng độ ưu tiên né
                                targetDx += ((entity.x - obs.x) / obDist) * urgency;
                                targetDy += ((entity.y - obs.y) / obDist) * urgency;
                                
                                // Predictive tangent sliding - Mượt hơn khi lướt qua vật cản
                                // Dự đoán hướng di chuyển tiếp theo để quyết định chiều trượt
                                const futureDist = Math.hypot(obs.x - (entity.x + targetDx), obs.y - (entity.y + targetDy));
                                if (futureDist < obDist) {
                                    const tangentX = -(obs.y - entity.y) / obDist;
                                    const tangentY = (obs.x - entity.x) / obDist;
                                    // Trượt mạnh hơn dọc theo bề mặt
                                    targetDx += tangentX * urgency * entity.circleDir * 1.5;
                                    targetDy += tangentY * urgency * entity.circleDir * 1.5;
                                }
                            }
                        }
                    });

                    // Normalize move dir
                    const moveMag = Math.hypot(targetDx, targetDy);
                    if (moveMag > 0) {
                        dx = (targetDx / moveMag) * moveSpeed * dts;
                        dy = (targetDy / moveMag) * moveSpeed * dts;
                    }

                    // 3. NPC Attack selection
                    const isBossBusy = entity.isBoss && entity.bossSkillPhase !== 'idle' && entity.bossSkillType === 'laser';
                    if (!isStunned && !entity.isSummoned && entity.combatant.name !== 'Tay sai BOSS' && !isBossBusy) {
                        const combatantToAttack = nearest;
                        
                        if (entity.auraFarmingModel === 'garou') {
                            handleAuraFarmingBossAttack(entity, combatantToAttack, s, getMutableStats);
                        } else {
                            const npcSkills = (entity.combatant as any).playerSkills || (entity.combatant as any).skills || [];
                            
                            // 3b. Offensive and Support Skills - PRIORITIZED! (Hễ có skill hết cooldown là dùng ngay lập tức)
                            let usedSkillThisTick = false;
                            if (npcSkills.length > 0 && (!entity.skillCooldown || entity.skillCooldown <= 0) && entity.globalCooldown <= 0) {
                                const isSupport = (name: string) => {
                                    const n = name.toUpperCase();
                                    return (n.includes('HỒI') && !n.includes('TRIỆU HỒI')) || n.includes('BUFF') || n.includes('TRỊ') || n.includes('PHỤC');
                                };
                                const attackSkill = npcSkills.find((sk: any) => !isSupport(sk.name));
                                const supportSkill = npcSkills.find((sk: any) => isSupport(sk.name));
    
                                const potentialAllies = s.entities.filter(e => e.isAlly === entity.isAlly && !e.isDead);
                                const weakestAlly = potentialAllies.sort((a,b) => a.hp/a.maxHp - b.hp/b.maxHp)[0];
                                
                                if (supportSkill && weakestAlly && weakestAlly.hp < weakestAlly.maxHp * 0.8) {
                                    entity.skillCooldown = getSkillCooldownMs(supportSkill);
                                    handleSkillLogic(entity, supportSkill);
                                    usedSkillThisTick = true;
                                } else {
                                    const nextSkill = attackSkill || supportSkill;
                                    if (nextSkill) {
                                        entity.skillCooldown = getSkillCooldownMs(nextSkill);
                                        handleSkillLogic(entity, nextSkill);
                                        usedSkillThisTick = true;
                                    }
                                }
                            }

                            // 3a. Basic Continuous Attacks (Only if we didn't use a skill this tick to ensure skill priority)
                            if (!usedSkillThisTick) {
                                const enemies = entity.isAlly ? livingEnemies : livingAllies;
                                const targetToAttack = (findEnemyInAttackRange(entity, enemies) || combatantToAttack) as RTEntity | null;
                                const effectiveRange = entity.attackType === 'melee' ? 200 : (entity.attackRange || 450);

                                if (entity.attackCooldown <= 0 && targetToAttack && Math.hypot(targetToAttack.x - entity.x, targetToAttack.y - entity.y) <= effectiveRange) {
                                    entity.attackCooldown = entity.maxAttackCooldown; // 1s basic attack interval
                                    handleAttack(entity, targetToAttack);
                                }
                            }
                        }
                    } else if (!isStunned && (entity.isSummoned || entity.combatant.name === 'Tay sai BOSS')) {
                        // Minions ONLY basic attack
                        const enemies = entity.isAlly ? livingEnemies : livingAllies;
                        const targetToAttack = (findEnemyInAttackRange(entity, enemies) || nearest) as RTEntity | null;
                        const effectiveRange = entity.attackType === 'melee' ? 200 : (entity.attackRange || 450);

                        if (entity.attackCooldown <= 0 && targetToAttack && Math.hypot(targetToAttack.x - entity.x, targetToAttack.y - entity.y) <= effectiveRange) {
                            entity.attackCooldown = entity.maxAttackCooldown;
                            handleAttack(entity, targetToAttack);
                        }
                    }
                }
            }

            const isLaserChargingOrFiring = (entity.bossSkillType === 'laser' && (entity.bossSkillPhase === 'telegraph' || entity.bossSkillPhase === 'action'));
            if (entity.isBoss && (isLaserChargingOrFiring || (entity.bossSkillPhase === 'action' && (entity.bossSkillType === 'bullet_hell')))) {
                dx = 0;
                dy = 0;
            }

            entity.x += dx;
            entity.y += dy;

            // Boundary
            entity.x = Math.max(entity.radius, Math.min(s.width - entity.radius, entity.x));
            entity.y = Math.max(entity.radius, Math.min(s.height - entity.radius, entity.y));
        });

        // Resolve collisions to prevent stacking
        for (let i = 0; i < s.entities.length; i++) {
            for (let j = i + 1; j < s.entities.length; j++) {
                const e1 = s.entities[i]; const e2 = s.entities[j];
                if (e1.isDead || e2.isDead || e1.isQueued || e2.isQueued || (e1.beastBombAirborneTimer && e1.beastBombAirborneTimer > 0) || (e2.beastBombAirborneTimer && e2.beastBombAirborneTimer > 0)) continue;
                const dist = Math.hypot(e2.x - e1.x, e2.y - e1.y);
                const minD = e1.radius + e2.radius;
                if (dist < minD) {
                    const overlap = minD - dist;
                    const nx = dist === 0 ? 1 : (e2.x - e1.x) / dist;
                    const ny = dist === 0 ? 0 : (e2.y - e1.y) / dist;
                    
                    if (e1.isObstacle && !e2.isObstacle) {
                        e2.x += nx * overlap; e2.y += ny * overlap;
                    } else if (e2.isObstacle && !e1.isObstacle) {
                        e1.x -= nx * overlap; e1.y -= ny * overlap;
                    } else if (!e1.isObstacle && !e2.isObstacle) {
                        e1.x -= nx * overlap * 0.5; e1.y -= ny * overlap * 0.5;
                        e2.x += nx * overlap * 0.5; e2.y += ny * overlap * 0.5;
                    }
                }
            }
        }

        // Update Active Auras (Healing Aura & Shield Dome Aura)
        for (let i = s.auras.length - 1; i >= 0; i--) {
            const aura = s.auras[i];
            const caster = s.entities.find(e => e.id === aura.casterId);
            if (!caster || caster.isDead || aura.duration <= 0 || (aura.type === 'SHIELD' && aura.hp <= 0)) {
                s.auras.splice(i, 1);
                continue;
            }

            aura.duration -= dt;

            // Healing Aura logic (1 tick per 1000ms = 1s)
            if (aura.type === 'HEAL') {
                aura.tickTimer -= dt;
                if (aura.tickTimer <= 0) {
                    aura.tickTimer = 1000; // Reset 1 second timer
                    s.entities.forEach(target => {
                        if (!target.isDead && !target.isObstacle && target.isAlly === caster.isAlly) {
                            const dist = Math.hypot(target.x - caster.x, target.y - caster.y);
                            if (dist <= aura.radius) {
                                const oldHp = target.hp;
                                target.hp = Math.min(target.maxHp, target.hp + aura.healPerTick);
                                const stats = getMutableStats(target.combatant);
                                if (stats) stats.sinhLuc = target.hp;
                                const actualHealed = target.hp - oldHp;
                                spawnVfx(`+${actualHealed}`, target.x, target.y - 20, '#22c55e');
                            }
                        }
                    });
                }
            }

            // Shield Dome Aura logic (absorbs damage & blocks enemy projectiles in range)
            if (aura.type === 'SHIELD') {
                for (let j = s.projectiles.length - 1; j >= 0; j--) {
                    const p = s.projectiles[j];
                    if (p.isHeal) continue;
                    const pSource = s.entities.find(e => e.id === p.sourceId);
                    const pSourceIsAlly = p.sourceId === 'player' || (pSource ? pSource.isAlly : isAlly(p.sourceId));
                    if (pSourceIsAlly !== caster.isAlly) {
                        const distToCaster = Math.hypot(p.x - caster.x, p.y - caster.y);
                        if (distToCaster <= aura.radius) {
                            const pDmg = p.damage || 10;
                            aura.hp -= pDmg;
                            p.life = -1; // Destroy projectile
                            spawnVfx(`Chặn! (-${Math.floor(pDmg)})`, p.x, p.y, '#3b82f6');
                            if (aura.hp <= 0) {
                                spawnVfx("LINH THUẪN VỠ!", caster.x, caster.y - 40, '#ef4444');
                                s.auras.splice(i, 1);
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Calculate total damage/healing applied this frame to avoid overlapping
        for (let i = s.projectiles.length - 1; i >= 0; i--) {
            const p = s.projectiles[i];
            if ((p as any).isAuraFarmingExplosion) {
                p.life -= dt;
                if (p.life <= 0) s.projectiles.splice(i, 1);
                continue;
            }
            
            const target = s.entities.find(e => e.id === p.targetId);
            
            // Homing logic for heals or lifesteal skills
            if ((p.isHeal || p.isLifesteal) && target && !target.isDead) {
                const dx = target.x - p.x;
                const dy = target.y - p.y;
                const dist = Math.sqrt(dx*dx + dy*dy) || 1;
                const speed = (p.isLifesteal) ? 200 : 700; // 1/2 of 400 for lifesteal
                p.vx = (dx / dist) * speed;
                p.vy = (dy / dist) * speed;
            }

            // Beast Bomb Parabolic Flight & Explosion logic
            if (p.isBeastBomb) {
                p.arcProgress = (p.arcProgress || 0) + dt / 1500; 
                const t = Math.min(1, p.arcProgress);
                const startX = p.startX || p.x;
                const startY = p.startY || p.y;
                const targetX = p.targetX || p.x;
                const targetY = p.targetY || p.y;
                
                const currX = startX + (targetX - startX) * t;
                const currY = startY + (targetY - startY) * t;
                const heightOffset = -400 * Math.sin(t * Math.PI);
                
                const nextX = currX;
                const nextY = currY + heightOffset;

                // Collision check
                const pSource = s.entities.find(ent => ent.id === p.sourceId);
                const pSourceIsAlly = p.sourceId === 'player' || (pSource ? pSource.isAlly : isAlly(p.sourceId));
                
                if (p.arcProgress < 1.01) {
                    const hitRadius = 15 * (p.scaleMultiplier || 1);
                    const hitTarget = s.entities.find(ent => {
                        if (ent.isDead || ent.id === p.sourceId) return false;
                        // Bom Vĩ Thú phát nổ khi chạm vào bất kỳ thực thể nào (hoặc vật cản)
                        return Math.hypot(ent.x - nextX, ent.y - nextY) < (ent.radius || 25) + hitRadius;
                    });

                    p.x = nextX;
                    p.y = nextY;

                    if (t >= 1 || hitTarget) {
                        p.life = 1200; 
                        p.arcProgress = 1.01; 
                        p.targetX = p.x;
                        p.targetY = p.y;
                        s.screenShakeTimer = 800 * (p.scaleMultiplier || 1);
                        s.screenFlashTimer = 300 * (p.scaleMultiplier || 1);
                        
                        // AoE Damage (500px * scaleMultiplier) - Tác động lên tất cả ngoại trừ người thi triển
                        const aoeRadius = 500 * (p.scaleMultiplier || 1);
                        s.entities.forEach(target => {
                            if (!target.isDead && target.id !== p.sourceId) {
                                const dist = Math.hypot(target.x - p.x, target.y - p.y);
                                if (dist <= aoeRadius) {
                                    const dmgFactor = (1.5 - (dist / aoeRadius));
                                    const dmg = Math.floor(p.damage * dmgFactor);
                                    target.hp = Math.max(0, target.hp - dmg);
                                    const ceStat = getMutableStats(target.combatant);
                                    if (ceStat) ceStat.sinhLuc = target.hp;
                                    spawnVfx(`-${dmg}`, target.x, target.y - 30, '#ef4444');
                                    
                                    // Chỉ ghi nhận chỉ số khi gây sát thương lên kẻ địch
                                    const isEnemy = target.isAlly !== pSourceIsAlly;
                                    if (isEnemy && pSource && (pSource.isAlly || pSource.isPlayer)) {
                                        pSource.totalDamageDealt = (pSource.totalDamageDealt || 0) + dmg;
                                        if (target.hp <= 0 && !target.lastHitBy) {
                                            target.lastHitBy = { id: p.sourceId, name: pSource.combatant.name };
                                            pSource.killCount = (pSource.killCount || 0) + 1;
                                            target.isDead = true;
                                        }
                                    } else if (target.hp <= 0) {
                                        // Nếu đồng minh chết do trúng đạn lạc, vẫn đánh dấu chết
                                        target.isDead = true;
                                    }

                                    // Knockback or Beast Bomb Airborne movement
                                    const angle = Math.atan2(target.y - p.y, target.x - p.x);
                                    if (!target.isDead) {
                                        target.beastBombAirborneTimer = 1500; // 1.5s in the air
                                        target.beastBombLandTimer = 0;
                                        target.beastBombStartX = target.x;
                                        target.beastBombStartY = target.y;
                                        // 200px from the center of the explosion (clamped to map boundaries)
                                        target.beastBombTargetX = Math.max(target.radius, Math.min(s.width - target.radius, p.x + Math.cos(angle) * 200));
                                        target.beastBombTargetY = Math.max(target.radius, Math.min(s.height - target.radius, p.y + Math.sin(angle) * 200));
                                    } else {
                                        const force = (1 - (dist / aoeRadius)) * 60 * (p.scaleMultiplier || 1);
                                        target.x += Math.cos(angle) * force;
                                        target.y += Math.sin(angle) * force;
                                    }
                                }
                            }
                        });
                    }
                }
                
                p.life -= dt;
                if (p.life <= 0) {
                    s.projectiles.splice(i, 1);
                }
                continue; // Skip all other projectile logic for Beast Bomb
            }
             // Expanding circle AND Arc Wave logic (Stationary expansion)
            if (p.isExpandingCircle || (p.isArcWave && !p.vx && !p.vy)) {
                // Expanding circle maps grow globally, Arc Map grows directionally
                const growthSpeed = p.isArcWave ? 400 : 1200;
                p.baseSize = (p.baseSize || 0) + growthSpeed * dts; 
            
            // To ensure circles cover the whole map quickly for healing/ultimate skills
            if (p.isExpandingCircle && p.isHeal) {
                p.baseSize += 800 * dts; // Extra speed for healing circles
            }
                
                const potentialTargets = p.isHeal 
                    ? s.entities.filter(e => (e.isAlly === isAlly(p.sourceId) || e.id === p.sourceId) && !e.isDead && !e.isObstacle) 
                    : s.entities.filter(e => (e.isAlly !== isAlly(p.sourceId) || e.isObstacle) && !e.isDead);
                
                potentialTargets.forEach(e => {
                    p.hitIds = p.hitIds || [];
                    if (p.hitIds.includes(e.id)) return;
                    
                    const distToEntity = Math.hypot(p.x - e.x, p.y - e.y);
                    
                    // For healing/buffs, if it's an expanding circle, hit everything it has *already* covered
                    const withinRange = p.isHeal 
                        ? distToEntity <= p.baseSize!
                        : (distToEntity <= p.baseSize! && distToEntity >= p.baseSize! - 50);

                    if (withinRange) {
                        
                        let withinAngle = true;
                        if (p.isArcWave) {
                            const angleToTarget = Math.atan2(e.y - p.y, e.x - p.x);
                            const arcDir = Math.atan2(p.vy, p.vx);
                            let angleDiff = angleToTarget - arcDir;
                            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                            
                            // 15 degrees total = +/- 7.5 degrees
                            if (Math.abs(angleDiff) > (7.5 * Math.PI / 180)) {
                                withinAngle = false;
                            }
                        }
                        
                        if (withinAngle) {
                            p.hitIds.push(e.id);
                            resolveHit(e, p);
                        }
                    }
                });
            } else {
                const customRes = updateCustomSkillProjectiles(p, dt, s, spawnVfx, resolveHit);
                if (customRes.handled) {
                    if (customRes.expired || p.life <= 0) {
                        s.projectiles.splice(i, 1);
                    }
                    continue;
                }
                const handledOrbit = handleAuraFarmingProjectileUpdate(p, s, dt, dts, isAlly, resolveHit, spawnVfx);
                if (!handledOrbit) {
                    if (p.targetId && p.emoji) {
                        const target = s.entities.find(e => e.id === p.targetId && !e.isDead);
                        if (target) {
                            const dx = target.x - p.x;
                            const dy = target.y - p.y;
                            const dist = Math.hypot(dx, dy) || 1;
                            const speed = 400;
                            p.vx = (dx / dist) * speed;
                            p.vy = (dy / dist) * speed;
                        }
                    }
                    p.x += p.vx * dts; p.y += p.vy * dts;
                }
            }
            p.life -= dt;
            
            // Ultimate growth
            if (p.isUltimateStrike && p.baseSize !== undefined) {
                p.baseSize += 120 * dts;
            }
            if (p.isDebuffWave && p.baseSize !== undefined) {
                p.baseSize += 100 * dts;
            }

            // Piercing Logic (Moving waves / projectiles)
            if (p.isPiercing && !p.isExpandingCircle) {
                let hitObstacle = false;
                s.entities.forEach(e => {
                    const isSelf = e.id === p.sourceId;
                    if (e.isDead || e.isQueued || (isSelf && !p.isHeal) || hitObstacle) return;
                    
                    const pSource = s.entities.find(ent => ent.id === p.sourceId);
                    const pSourceIsAlly = p.sourceId === 'player' || (pSource ? pSource.isAlly : isAlly(p.sourceId));

                    // No friendly fire in piercing
                    if (e.isAlly === pSourceIsAlly && !e.isObstacle && !p.isHeal) return;

                    p.hitIds = p.hitIds || [];
                    if (p.hitIds.includes(e.id)) return;
                    
                    const dist = Math.hypot(e.x - p.x, e.y - p.y);
                    if (dist < (p.baseSize || 10) + e.radius) {
                        if (e.isObstacle && !p.isArcWave && !p.isPierceAll) hitObstacle = true;
                        p.hitIds.push(e.id);
                        resolveHit(e, p);
                    }
                });
                if (hitObstacle && !p.isArcWave && !p.isPierceAll) p.life = -1;
            } else if (!p.isExpandingCircle) {
                // Non-piercing regular projectiles
                let hasHit = false;
                for (const e of s.entities) {
                    if (e.isDead || e.id === p.sourceId) continue;

                    const pSource = s.entities.find(ent => ent.id === p.sourceId);
                    const pSourceIsAlly = p.sourceId === 'player' || (pSource ? pSource.isAlly : isAlly(p.sourceId));

                    // Potential optimization and FF check: only hit obstacles or opposite team
                    if (e.isAlly === pSourceIsAlly && !e.isObstacle && !p.isHeal) continue;
                    
                    const distToEntity = Math.hypot(e.x - p.x, e.y - p.y);
                    const blockRadius = e.radius + (p.baseSize || 5);
                    
                    if (distToEntity < blockRadius && !p.hitIds?.includes(e.id)) {
                        // Aura Farming: Burst points accumulation
                        handleAuraFarmingBurst(e, spawnVfx);

                        if (e.isObstacle) {
                            hasHit = true;
                            // Apply damage to obstacle
                            const dmg = Math.max(1, Math.floor(p.damage));
                            e.hp -= dmg;
                            if (e.hp < 0) e.hp = 0;
                            spawnVfx(`CHẶN`, p.x, p.y, '#9ca3af');
                            spawnVfx(`-${dmg}`, e.x + (Math.random()*20-10), e.y - 20, '#9ca3af');
                            
                            if (p.isAuraFarmingAttack) {
                                handleAuraFarmingExplosion(p, s, isAlly, resolveHit, spawnVfx, e.id);
                            }
                            
                            break;
                        }
                        // HIT LOGIC
                        if (p.isHeal) {
                            // Heals only affect the target or allies
                            if (e.isAlly === (p.sourceId === 'player' || isAlly(p.sourceId))) {
                                const heal = p.healAmount || 0;
                                e.hp = Math.min(e.maxHp, e.hp + heal);
                                const ceStat = getMutableStats(e.combatant);
                                if (ceStat) ceStat.sinhLuc = e.hp;
                                spawnVfx(`+${heal}`, e.x + (Math.random()*20 - 10), e.y - 20, '#22c55e');
                                hasHit = true; 
                            }
                        } else if (p.isLifesteal) {
                            if (!p.isAttached && e.id === p.targetId) {
                                // Apply immediate damage
                                if (e.shieldTimer <= 0) {
                                    e.hp -= p.damage;
                                    if (e.hp < 0) e.hp = 0;
                                    const ceStat = getMutableStats(e.combatant);
                                    if (ceStat) ceStat.sinhLuc = e.hp;
                                    
                                    spawnVfx(`💥`, e.x, e.y, '#fff');
                                    spawnVfx(`-${p.damage}`, e.x + (Math.random()*20 - 10), e.y - 20, '#ef4444');

                                    // Lifesteal Healing
                                    const source = s.entities.find(en => en.id === p.sourceId);
                                    if (source) {
                                        const healAmount = p.damage;
                                        source.hp += healAmount;
                                        if (source.hp > source.maxHp) source.hp = source.maxHp;
                                        const sourceStat = getMutableStats(source.combatant);
                                        if (sourceStat) sourceStat.sinhLuc = source.hp;
                                        spawnVfx(`+${healAmount}`, source.x, source.y - 40, '#22c55e');
                                    }
                                    
                                    if (e.hp <= 0) {
                                        e.hp = 0; e.isDead = true; 
                                        if (!e.isAlly && !e.isObstacle) s.combatLogs.push(`${e.combatant.name} bị hạ gục!`);
                                    }
                                }

                                p.life = -1;
                                hasHit = true;
                            }
                        } else {
                            // Normal damage
                            if (e.shieldTimer <= 0) {
                                let finalDmg = p.damage;
                                if (e.isEnraged) finalDmg *= 0.5;
                                e.hp -= finalDmg;
                                if (e.hp < 0) e.hp = 0;
                                const ceStat = getMutableStats(e.combatant);
                                if (ceStat) ceStat.sinhLuc = e.hp;
                                
                                const pSource = s.entities.find(ent => ent.id === p.sourceId);
                                if (pSource && (pSource.isAlly || pSource.isPlayer)) {
                                    pSource.totalDamageDealt = (pSource.totalDamageDealt || 0) + finalDmg;
                                }

                                if (e.hp <= 0 && !e.lastHitBy) {
                                    e.lastHitBy = { id: p.sourceId, name: pSource?.combatant.name || "Kẻ địch" };
                                    if (pSource && (pSource.isAlly || pSource.isPlayer)) {
                                        pSource.killCount = (pSource.killCount || 0) + 1;
                                    }
                                }

                                spawnVfx(`💥`, e.x, e.y, '#fff'); // Hit effect
                                spawnVfx(`-${p.damage}`, e.x + (Math.random()*20 - 10), e.y - 20, p.isUltimateStrike ? '#ffffff' : (p.isCrit ? '#ef4444' : '#f97316'));
                                
                                if (e.hp <= 0) {
                                    e.hp = 0; 
                                    e.isDead = true; 
                                    if (!e.isAlly && !e.isObstacle) s.combatLogs.push(`${e.combatant.name} bị hạ gục!`);
                                }
                                
                                p.hitIds = p.hitIds || [];
                                p.hitIds.push(e.id);

                                // Projectile Explosion for AOE (if explosive)
                                if (p.isExplosive && !p.isShard) {
                                    const numShards = 8;
                                    const shardDmg = Math.floor(p.damage * 0.4);
                                    for (let j = 0; j < numShards; j++) {
                                        const angle = (j / numShards) * Math.PI * 2;
                                        s.projectiles.push({
                                            id: Math.random().toString(),
                                            x: p.x, y: p.y,
                                            vx: Math.cos(angle) * 350, vy: Math.sin(angle) * 350,
                                            targetId: '', 
                                            sourceId: p.sourceId,
                                            damage: shardDmg,
                                            isCrit: false,
                                            color: p.color,
                                            life: 500,
                                            isShard: true
                                        });
                                    }
                                }
                                
                                if (p.isAuraFarmingAttack) {
                                    handleAuraFarmingExplosion(p, s, isAlly, resolveHit, spawnVfx, e.id);
                                }
                            } else {
                                spawnVfx(`MIỄN NHIỄM`, e.x, e.y - 20, '#38bdf8');
                            }
                            hasHit = true;
                        }
                        if (hasHit) break;
                    }
                }

                if (hasHit && !p.isUltimateStrike) {
                    s.projectiles.splice(i, 1);
                    continue;
                }

                // Shard proximity hit detection
                if (p.isShard) {
                    const enemies = p.sourceId === 'player' || isAlly(p.sourceId) ? livingEnemies : livingAllies;
                    for (const e of enemies) {
                        if (Math.hypot(e.x - p.x, e.y - p.y) < e.radius) {
                            if (e.shieldTimer <= 0) {
                                let finalDmg = p.damage;
                                if (e.isEnraged) finalDmg *= 0.5;
                                e.hp -= finalDmg;
                                if (e.hp < 0) e.hp = 0;
                                const ceStat = getMutableStats(e.combatant);
                                if (ceStat) ceStat.sinhLuc = e.hp;

                                const pSource = s.entities.find(ent => ent.id === p.sourceId);
                                if (pSource && (pSource.isAlly || pSource.isPlayer)) {
                                    pSource.totalDamageDealt = (pSource.totalDamageDealt || 0) + finalDmg;
                                }

                                if (e.hp <= 0 && !e.lastHitBy) {
                                    e.lastHitBy = { id: p.sourceId, name: pSource?.combatant.name || "Kẻ địch" };
                                    if (pSource && (pSource.isAlly || pSource.isPlayer)) {
                                        pSource.killCount = (pSource.killCount || 0) + 1;
                                    }
                                }

                                spawnVfx(`💥`, e.x, e.y, '#fff'); // Hit effect
                                spawnVfx(`-${Math.floor(finalDmg)}`, e.x, e.y - 15, p.color);
                                if (e.hp <= 0) { e.hp = 0; e.isDead = true; }
                            } else {
                                 spawnVfx(`MIỄN NHIỄM`, e.x, e.y - 20, '#38bdf8');
                            }
                            s.projectiles.splice(i, 1);
                            hasHit = true;
                            break;
                        }
                    }
                    if (hasHit) continue;
                }
            }

            if (p.life <= 0) {
                s.projectiles.splice(i, 1);
                continue;
            }
        }
            
        // Pending lasers processing
        for (let i = s.pendingLasers.length - 1; i >= 0; i--) {
            const l = s.pendingLasers[i];
            l.timer += dt;
            
            if (l.timer >= 100) { // Reduced buildup time as requested
                 const ang = Math.atan2(l.ty - l.y, l.tx - l.x);
                 const speed = 15000; // Light speed (extremely fast)
                 const sourceIsAlly = isAlly(l.sourceId);
                 
                 if (l.isSieuManhKich) {
                     // 5 parallel beams: center + 2 on each side
                     // Increased spacing to look like one character width between beams
                     const offsets = [-140, -70, 0, 70, 140];
                     offsets.forEach((off, idx) => {
                         const perpAng = ang + Math.PI / 2;
                         const offsetX = Math.cos(perpAng) * off;
                         const offsetY = Math.sin(perpAng) * off;
                         
                         s.projectiles.push({
                             id: Math.random().toString(),
                             x: l.x + offsetX, y: l.y + offsetY,
                             vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
                             targetId: idx === 2 ? l.targetId : '', // Central beam tracks ID, others are just projectiles
                             sourceId: l.sourceId,
                             damage: l.damage / 3, // Boosted total damage for Boss, split between beams
                             isCrit: false,
                             color: sourceIsAlly ? '#3b82f6' : '#ef4444', 
                             life: 5000,
                             isLaser: true,
                             isPiercing: true,
                             isManhKich: true,
                             baseSize: 45 // Slightly smaller beams for parallel look
                         });
                     });
                 } else {
                     s.projectiles.push({
                         id: Math.random().toString(),
                         x: l.x, y: l.y,
                         vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
                         targetId: l.targetId || '',
                         sourceId: l.sourceId,
                         damage: l.damage,
                         isCrit: false,
                         color: sourceIsAlly ? '#3b82f6' : '#ef4444', 
                         life: 5000,
                         isLaser: true,
                         isPiercing: true,
                         isManhKich: true,
                         baseSize: 60 // Beam width
                     });
                 }
                 s.pendingLasers.splice(i, 1);
            }
        }

        // VFX update
        for (let i = s.vfx.length - 1; i >= 0; i--) {
            const v = s.vfx[i];
            if (!v.isImage) {
                v.y -= 30 * dts;
            }
            v.life -= dt;
            if (v.life <= 0) s.vfx.splice(i, 1);
        }
    };

    const draw = (ctx: CanvasRenderingContext2D) => {
        const s = state.current;
        // The display dimensions:
        const screenW = canvasRef.current ? canvasRef.current.width : window.innerWidth;
        const screenH = canvasRef.current ? canvasRef.current.height : window.innerHeight;
        const resScale = graphicsConfig.resolutionScale || 1.0;
        
        ctx.clearRect(0, 0, screenW, screenH);
        
        ctx.save();
        ctx.scale(resScale, resScale);
        
        const zoom = 0.35; // Gấp đôi độ cao camera, góc nhìn rộng hơn gấp đôi
        
        // Find player to center camera on them
        const player = s.entities.find(e => e.isPlayer);
        let camX = (player ? player.x : s.width / 2) + (s.cameraOffset?.x || 0);
        let camY = (player ? player.y : s.height / 2) + (s.cameraOffset?.y || 0);
        
        // Clamp camera to map bounds
        camX = Math.max(0, Math.min(s.width, camX));
        camY = Math.max(0, Math.min(s.height, camY));
        
        ctx.translate((screenW / resScale) / 2, (screenH / resScale) / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-camX, -camY);

        // Screen Shake
        if (s.screenShakeTimer > 0) {
            const intensity = 30 * (s.screenShakeTimer / 800);
            ctx.translate((Math.random() - 0.5) * intensity, (Math.random() - 0.5) * intensity);
        }

        // Background: grim textured look
        ctx.fillStyle = '#2c332c'; // Dark mossy background
        ctx.fillRect(0, 0, s.width, s.height);
        
        // Boundaries
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, s.width, s.height);
        
        // Simple procedural noise dots for grass/dirt texture
        ctx.fillStyle = '#222822';
        for(let x = 0; x < s.width; x += 60) {
            for(let y = 0; y < s.height; y += 60) {
                 ctx.beginPath(); 
                 ctx.arc(x + (Math.sin(y*0.1)*10), y + (Math.cos(x*0.1)*10), 1.5, 0, Math.PI*2); 
                 ctx.fill();
            }
        }



        // Render Active Auras (Healing Aura & Shield Dome Aura - 300px diameter)
        s.auras.forEach(aura => {
            const caster = s.entities.find(e => e.id === aura.casterId);
            if (!caster || caster.isDead) return;

            ctx.save();
            ctx.beginPath();
            ctx.arc(caster.x, caster.y, aura.radius, 0, Math.PI * 2);

            // Radial Gradient
            const grad = ctx.createRadialGradient(caster.x, caster.y, aura.radius * 0.1, caster.x, caster.y, aura.radius);
            if (aura.type === 'HEAL') {
                grad.addColorStop(0, 'rgba(34, 197, 94, 0.05)');
                grad.addColorStop(0.7, 'rgba(34, 197, 94, 0.18)');
                grad.addColorStop(1, 'rgba(34, 197, 94, 0.35)');
            } else {
                grad.addColorStop(0, 'rgba(59, 130, 246, 0.08)');
                grad.addColorStop(0.7, 'rgba(59, 130, 246, 0.22)');
                grad.addColorStop(1, 'rgba(59, 130, 246, 0.45)');
            }
            ctx.fillStyle = grad;
            ctx.fill();

            // Border Stroke
            const auraColor = aura.color || (aura.type === 'HEAL' ? '#22c55e' : '#3b82f6');
            ctx.strokeStyle = auraColor;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 12;
            ctx.shadowColor = auraColor;
            ctx.setLineDash([10, 6]);
            ctx.stroke();

            // Text Label / HP status above ring
            ctx.setLineDash([]);
            if (aura.type === 'SHIELD') {
                const shieldRatio = Math.max(0, Math.min(1, aura.hp / (aura.maxHp || 1)));
                const pct = Math.floor(shieldRatio * 100);

                // Text status
                ctx.fillStyle = '#60a5fa';
                ctx.font = 'bold 12px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.shadowColor = '#000';
                ctx.shadowBlur = 4;
                ctx.fillText(`🛡️ Linh Thuẫn (${pct}%) - ${Math.floor(aura.hp)}/${aura.maxHp} HP`, caster.x, caster.y - aura.radius - 20);

                // Draw Shield HP Bar Container
                const barW = 140;
                const barH = 10;
                const barX = caster.x - barW / 2;
                const barY = caster.y - aura.radius - 12;

                // Background
                ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.rect(barX, barY, barW, barH);
                ctx.fill();
                ctx.stroke();

                // Shield Fill Bar
                if (shieldRatio > 0) {
                    ctx.fillStyle = shieldRatio > 0.5 ? '#3b82f6' : (shieldRatio > 0.25 ? '#f59e0b' : '#ef4444');
                    ctx.beginPath();
                    ctx.rect(barX + 1.5, barY + 1.5, Math.max(0, (barW - 3) * shieldRatio), barH - 3);
                    ctx.fill();
                }
            } else if (aura.type === 'HEAL') {
                ctx.fillStyle = '#4ade80';
                ctx.font = 'bold 12px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.shadowColor = '#000';
                ctx.shadowBlur = 4;
                ctx.fillText(`✨ Vùng Trị Liệu`, caster.x, caster.y - aura.radius - 10);
            }

            ctx.restore();
        });

        // Mushroom Cloud Explosions (Bom Vĩ Thú)
        s.projectiles.forEach(p => {
            if (p.isBeastBomb && p.arcProgress && p.arcProgress >= 1) {
                const alpha = Math.max(0, 1.2 - (p.arcProgress - 1) * 2); 
                const progress = Math.min(1, (p.arcProgress - 1) * 2);
                if (alpha <= 0) return;

                ctx.save();
                ctx.translate(p.targetX!, p.targetY!);
                if (p.scaleMultiplier && p.scaleMultiplier !== 1) {
                    ctx.scale(p.scaleMultiplier, p.scaleMultiplier);
                }
                
                // 1. Ground shockwave ring
                ctx.beginPath();
                ctx.ellipse(0, 0, 250 * progress, 80 * progress, 0, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * alpha})`;
                ctx.lineWidth = 4;
                ctx.stroke();

                // 2. Mushroom cloud stem (rising column)
                const stemHeight = 250 * Math.min(1, progress * 1.5);
                const stemWidth = 60 * alpha;
                
                const stemGrad = ctx.createLinearGradient(0, 0, 0, -stemHeight);
                stemGrad.addColorStop(0, `rgba(127, 29, 29, ${0.8 * alpha})`);
                stemGrad.addColorStop(0.5, `rgba(0, 0, 0, ${0.6 * alpha})`);
                stemGrad.addColorStop(1, `rgba(127, 29, 29, ${0.4 * alpha})`);
                
                ctx.fillStyle = stemGrad;
                ctx.beginPath();
                ctx.moveTo(-stemWidth/2, 0);
                ctx.lineTo(-stemWidth/4, -stemHeight);
                ctx.lineTo(stemWidth/4, -stemHeight);
                ctx.lineTo(stemWidth/2, 0);
                ctx.closePath();
                ctx.fill();

                // 3. Mushroom head (The big cloud)
                const cloudRadius = 180 * Math.min(1, progress * 1.2);
                ctx.translate(0, -stemHeight);
                
                // Draw multiple overlapping dark/red blobs for "mushroom" effect
                for (let i = 0; i < 12; i++) {
                    const angle = (i / 12) * Math.PI * 2;
                    const r = cloudRadius * (0.4 + Math.random() * 0.3);
                    const dist = cloudRadius * 0.5 * Math.random();
                    const ox = Math.cos(angle) * dist;
                    const oy = Math.sin(angle) * dist * 0.6;
                    
                    const blobGrad = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
                    blobGrad.addColorStop(0, `rgba(0, 0, 0, ${0.9 * alpha})`);
                    blobGrad.addColorStop(0.7, `rgba(127, 29, 29, ${0.7 * alpha})`);
                    blobGrad.addColorStop(1, `rgba(0, 0, 0, 0)`);
                    
                    ctx.fillStyle = blobGrad;
                    ctx.beginPath();
                    ctx.arc(ox, oy, r, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();
            }
        });

        // Entities
        [...s.entities].sort((a,b) => a.y - b.y).forEach(e => {
            if (e.isQueued) return; // Skip drawing queued reserve characters entirely

            // Beast Bomb Charging Effect
            if (e.channelTimer && e.channelTimer > 0 && !e.isDead) {
                const prog = 1 - (e.channelTimer / (e.maxChannelTimer || 5000));
                ctx.save();
                
                // Gathering particles
                const particleCount = 12;
                const time = s.totalTime / 200;
                for (let i = 0; i < particleCount; i++) {
                    const angle = (i / particleCount) * Math.PI * 2 + time;
                    const r = 80 * (1 - (s.totalTime % 500 / 500));
                    const px = e.x + Math.cos(angle) * r;
                    const py = e.y + Math.sin(angle) * r;
                    
                    ctx.beginPath();
                    ctx.arc(px, py, 3, 0, Math.PI * 2);
                    ctx.fillStyle = i % 2 === 0 ? '#000000' : '#ef4444';
                    ctx.fill();
                }

                // Central Ball growing
                const ballR = 10 + prog * 30;
                const grad = ctx.createRadialGradient(e.x, e.y - ballR - 20, ballR * 0.2, e.x, e.y - ballR - 20, ballR);
                grad.addColorStop(0, '#ef4444');
                grad.addColorStop(0.8, '#000000');
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                
                ctx.beginPath();
                ctx.arc(e.x, e.y - ballR - 20, ballR, 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();
                
                // Casting bar
                const barW = 100;
                const barH = 6;
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(e.x - barW/2, e.y + 45, barW, barH);
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(e.x - barW/2, e.y + 45, barW * prog, barH);
                
                ctx.restore();
            }
            if (e.isDead) {
                if (e.isObstacle) return; // Disappear if dead obstacle
                // Dead body
                ctx.globalAlpha = 0.3;
                ctx.fillStyle = '#000';
                ctx.beginPath(); ctx.ellipse(e.x, e.y + e.radius/2, e.radius, e.radius/2, 0, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1.0;
                return;
            }

            // Boss Laser Telegraph Effect
            if (e.isBoss && e.bossSkillType === 'laser' && e.bossSkillPhase === 'telegraph') {
                const isTriggerBoss = (e.combatant as any).triggerBoss || e.combatant.name.toLowerCase().includes('triggerboss');
                if (isTriggerBoss) {
                    ctx.save();
                    const telegraphTotal = 700;
                    const progress = (telegraphTotal - (e.bossSkillTimer || 0)) / telegraphTotal;
                    ctx.strokeStyle = '#ef4444';
                    ctx.lineWidth = 2;
                    const numBeams = 12;
                    for (let i = 0; i < numBeams; i++) {
                        const angle = (i / numBeams) * Math.PI * 2 + performance.now() / 200;
                        const lifeTime = (performance.now() / 500) % 1;
                        const radius = 150 * (1 - lifeTime); 
                        if (radius > 10) {
                            const startX = e.x + Math.cos(angle) * (radius + 30);
                            const startY = e.y + Math.sin(angle) * (radius + 30);
                            const endX = e.x + Math.cos(angle) * radius;
                            const endY = e.y + Math.sin(angle) * radius;
                            ctx.beginPath();
                            ctx.moveTo(startX, startY);
                            ctx.lineTo(endX, endY);
                            ctx.stroke();
                        }
                    }
                    // Inner glow expanding with progress
                    ctx.beginPath();
                    ctx.fillStyle = `rgba(239, 68, 68, ${0.2 + progress * 0.4})`;
                    ctx.arc(e.x, e.y, e.radius * (1 + progress * 2), 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }

            // Boss Rotating Laser Render
            if (e.isBoss && e.bossSkillType === 'laser' && e.bossSkillPhase === 'action' && e.currentLaserAngle !== undefined) {
                const beamLen = 5000;
                const x2 = e.x + Math.cos(e.currentLaserAngle) * beamLen;
                const y2 = e.y + Math.sin(e.currentLaserAngle) * beamLen;

                ctx.save();
                ctx.shadowBlur = 40;
                ctx.shadowColor = '#ef4444';
                
                // Outer Red
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 100;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(e.x, e.y);
                ctx.lineTo(x2, y2);
                ctx.stroke();

                // Middle Orange/Pink
                ctx.strokeStyle = '#fca5a5';
                ctx.lineWidth = 60;
                ctx.beginPath();
                ctx.moveTo(e.x, e.y);
                ctx.lineTo(x2, y2);
                ctx.stroke();

                // White Core
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 20;
                ctx.shadowBlur = 20;
                ctx.beginPath();
                ctx.moveTo(e.x, e.y);
                ctx.lineTo(x2, y2);
                ctx.stroke();

                ctx.restore();
            }

            // Draw Boss Telegraphs
            if (e.isBoss && e.isEnraged && e.bossTelegraphPos) {

            if (e.bossSkillType === 'aoe_slam' && e.bossSkillPhase === 'telegraph') {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
                    ctx.lineWidth = 3;
                    ctx.setLineDash([5, 10]);
                    const pulse = Math.sin(performance.now() / 100) * 0.2 + 0.8;
                    ctx.globalAlpha = pulse;
                    ctx.beginPath();
                    ctx.arc(e.bossTelegraphPos.x, e.bossTelegraphPos.y, e.bossTelegraphRadius || 50, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
                    ctx.fill();
                    ctx.restore();
                } else if (e.bossSkillType === 'dash' && (e.bossSkillPhase === 'telegraph' || e.bossSkillPhase === 'action')) {
                    const dx = e.bossTelegraphPos.x - e.x;
                    const dy = e.bossTelegraphPos.y - e.y;
                    const dist = Math.hypot(dx, dy);
                    const steps = Math.floor(dist / 30); // Use 30 to make sure emojis don't overlap too much
                    ctx.save();
                    ctx.font = "16px Arial";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    for(let i=1; i<=steps; i++) {
                       const px = e.x + (dx/dist) * (i * 30);
                       const py = e.y + (dy/dist) * (i * 30);
                       ctx.fillText("🌀", px, py);
                    }
                    ctx.restore();
                }
            }

            // Target Lock Indicator
            if (s.lockedTargetId === e.id) {
                ctx.save();
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                const lockPulse = Math.sin(performance.now() / 150) * 5;
                ctx.beginPath();
                ctx.arc(e.x, e.y, e.radius + 15 + lockPulse, 0, Math.PI * 2);
                ctx.stroke();
                
                // Crosshairs
                const chSize = 10;
                ctx.setLineDash([]);
                ctx.beginPath();
                // Top
                ctx.moveTo(e.x, e.y - e.radius - 20); ctx.lineTo(e.x, e.y - e.radius - 5);
                // Bottom
                ctx.moveTo(e.x, e.y + e.radius + 5); ctx.lineTo(e.x, e.y + e.radius + 20);
                // Left
                ctx.moveTo(e.x - e.radius - 20, e.y); ctx.lineTo(e.x - e.radius - 5, e.y);
                // Right
                ctx.moveTo(e.x + e.radius + 5, e.y); ctx.lineTo(e.x + e.radius + 20, e.y);
                ctx.stroke();
                ctx.restore();
            }
            
            if (e.isObstacle) {
                ctx.save();
                ctx.font = `${e.radius * 1.5}px Inter, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                // Subtle shadow for the emoji itself
                ctx.shadowColor = 'rgba(0,0,0,0.3)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetY = 2;
                ctx.fillText(e.emoji || "🪨", e.x, e.y);
                
                // Draw HP bar for obstacle specifically
                const barY = e.y - e.radius - 5;
                const hpWidth = e.radius * 1.2;
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(e.x - hpWidth/2, barY, hpWidth, 3);
                ctx.fillStyle = '#22c55e';
                ctx.fillRect(e.x - hpWidth/2, barY, hpWidth * (e.hp / e.maxHp), 3);
                
                ctx.restore();
                return;
            }
            
            // Shadow
            const sc = e.radius / 20;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath(); ctx.ellipse(e.x, e.y + e.radius - 4 * sc, Math.max(0, e.radius*0.8), Math.max(0, e.radius * 0.3), 0, 0, Math.PI * 2); ctx.fill();

            // Glowing indicator rings under feet
            if (!e.isPlayer && !e.isObstacle) {
                ctx.save();
                let ringColor = '';
                if (e.isSummoned) {
                    ringColor = 'rgba(124, 58, 237, 0.85)'; // Xanh tím (purple-indigo)
                } else if (e.isAlly) {
                    ringColor = 'rgba(34, 197, 94, 0.85)'; // Xanh lá (green)
                } else {
                    ringColor = 'rgba(239, 68, 68, 0.85)'; // Đỏ (red)
                }

                ctx.strokeStyle = ringColor;
                ctx.lineWidth = 2.5 * sc;
                ctx.shadowBlur = 10 * sc;
                ctx.shadowColor = ringColor;
                
                ctx.beginPath();
                ctx.ellipse(e.x, e.y + e.radius - 4 * sc, Math.max(0, e.radius * 1.1), Math.max(0, e.radius * 0.4), 0, 0, Math.PI * 2);
                ctx.stroke();

                ctx.shadowBlur = 0;
                const fillAlpha = e.isSummoned ? 'rgba(124, 58, 237, 0.12)' : (e.isAlly ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)');
                ctx.fillStyle = fillAlpha;
                ctx.fill();

                ctx.restore();
            }

            // Head and Body styling
            let colorHead = e.isPlayer ? '#fcd5ce' : (e.isAlly ? '#86efac' : '#fca5a5');
            let colorBody = e.isPlayer ? '#e2e8f0' : (e.isAlly ? '#22c55e' : '#991b1b');
            let colorOutline = e.isPlayer ? '#fbbf24' : '#111';

            if (e.isBoss) {
                colorHead = '#111';
                colorBody = '#7f1d1d';
                colorOutline = '#ef4444';
            }
            
            // Wobble animation while walking
            const isMoving = e.isPlayer ? (s.joystick.dx !== 0 || s.joystick.dy !== 0) : true;
            const wobble = isMoving ? Math.sin(performance.now() / 100) * 3 * sc : 0;
            const facingLeft = e.isPlayer ? s.joystick.dx < 0 : (!e.isAlly);

            ctx.save();
            let zOffset = 0;
            let rotation = 0;
            if (e.beastBombAirborneTimer && e.beastBombAirborneTimer > 0) {
                const progress = Math.min(1.0, (1500 - e.beastBombAirborneTimer) / 1500);
                zOffset = Math.sin(progress * Math.PI) * 150;
                rotation = Math.PI / 2;
            } else if (e.beastBombLandTimer && e.beastBombLandTimer > 0) {
                rotation = Math.PI / 2;
            }

            ctx.translate(e.x, e.y - zOffset);
            if (rotation) ctx.rotate(rotation);
            if (facingLeft) ctx.scale(-1, 1);

            // Weapon (Sword) for player & allies, claws for enemies
            if (e.isPlayer || e.isAlly) {
                const attackAnim = e.attackCooldown > e.maxAttackCooldown - 200 ? Math.sin((e.maxAttackCooldown - e.attackCooldown) / 50) : 0;
                ctx.save();
                ctx.translate(e.radius - 5 * sc, wobble + 5 * sc);
                ctx.rotate(Math.PI / 4 + attackAnim); // Swipe motion
                ctx.fillStyle = '#cbd5e1'; // Silver blade
                ctx.fillRect(0, -e.radius, 4 * sc, e.radius * 1.5);
                ctx.fillStyle = '#8b5cf6'; // Hilt
                ctx.fillRect(-2 * sc, 0, 8 * sc, 4 * sc);
                ctx.restore();
            }

            // Body
            ctx.fillStyle = colorBody;
            ctx.strokeStyle = colorOutline;
            ctx.lineWidth = 1.5 * sc;
            ctx.beginPath();
            ctx.arc(0, wobble + 8 * sc, Math.max(0, e.radius * 0.8), Math.PI, 0); // Shoulders
            ctx.lineTo(Math.max(0, e.radius * 0.8), wobble + e.radius); // Robe bottom
            ctx.lineTo(-Math.max(0, e.radius * 0.8), wobble + e.radius);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            
            // Head
            ctx.fillStyle = colorHead;
            ctx.beginPath();
            ctx.arc(0, wobble - 6 * sc, Math.max(0, e.radius * 0.6), 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();

            // Shield Bubble
            if (e.shieldTimer > 0) {
                ctx.save();
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 3 * sc;
                ctx.globalAlpha = 0.6 + Math.sin(performance.now()/50)*0.2;
                ctx.beginPath();
                ctx.arc(0, 0, Math.max(0, e.radius * 1.5), 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = '#38bdf8'; ctx.globalAlpha = 0.2;
                ctx.fill();
                ctx.restore();
            }

            // Energy gathering animation for Beast Bomb
            if (e.channelTimer > 0 && (e.channelSkillName?.includes('Bom Vĩ Thú') || e.channelSkillCoreName?.includes('Bom Vĩ Thú'))) {
                const progress = 1 - (e.channelTimer / 5000);
                const size = 10 + progress * 50;
                
                ctx.save();
                ctx.translate(e.x, e.y - 40);
                
                // Outer glow
                const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.5);
                glow.addColorStop(0, 'rgba(168, 85, 247, 0.6)'); // Purple/Dark
                glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
                ctx.fill();

                // Core sphere
                const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
                coreGrad.addColorStop(0, '#000000');
                coreGrad.addColorStop(0.7, '#7f1d1d'); // Dark Red
                coreGrad.addColorStop(1, '#000000');
                ctx.fillStyle = coreGrad;
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, Math.PI * 2);
                ctx.fill();

                // Swirling particles
                const particleCount = 20;
                for (let i = 0; i < particleCount; i++) {
                    const time = performance.now() / 500;
                    const angle = (i / particleCount) * Math.PI * 2 + time * 2;
                    const dist = (size * 2) * (1 - ((time + i * 0.1) % 1));
                    const px = Math.cos(angle) * dist;
                    const py = Math.sin(angle) * dist;
                    
                    ctx.fillStyle = i % 2 === 0 ? '#ef4444' : '#000000';
                    ctx.beginPath();
                    ctx.arc(px, py, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                ctx.restore();
            }

            // Eyes
            ctx.fillStyle = e.isBoss ? '#ef4444' : '#111';
            ctx.beginPath();
            ctx.arc(4 * sc, wobble - 8 * sc, Math.max(0, (e.isBoss ? 2.5 : 1.5) * sc), 0, Math.PI*2); 
            ctx.fill();

            // Boss Crown / Aura
            if (e.isBoss) {
                ctx.restore(); // Undo the flip if facing left
                ctx.save();
                ctx.translate(e.x, e.y);
                ctx.strokeStyle = e.isEnraged ? '#ef4444' : '#ef4444'; 
                ctx.lineWidth = 2 * sc;
                
                if (e.isEnraged) {
                    // Enraged Red Aura
                    ctx.shadowBlur = 15; ctx.shadowColor = '#ef4444';
                    ctx.strokeStyle = '#ef4444';
                    ctx.beginPath();
                    ctx.arc(0, 0, e.radius + 10 * sc, 0, Math.PI * 2);
                    ctx.stroke();
                }

                ctx.beginPath();
                for(let i=0; i<6; i++) {
                    const ang = (i/6)*Math.PI*2 + performance.now()/400;
                    ctx.moveTo(Math.cos(ang)*e.radius, Math.sin(ang)*e.radius);
                    ctx.lineTo(Math.cos(ang)*(e.radius+(e.isEnraged ? 20 : 12)*sc), Math.sin(ang)*(e.radius+(e.isEnraged ? 20 : 12)*sc));
                }
                ctx.stroke();
                ctx.restore();
                ctx.save(); // restore back for potentially more logic
                ctx.translate(e.x, e.y);
                if (facingLeft) ctx.scale(-1, 1);
            }

            // Red glowing eyes for enemies
            if (!e.isPlayer && !e.isAlly) {
                ctx.fillStyle = 'red';
                ctx.beginPath(); ctx.arc(4 * sc, wobble - 8 * sc, Math.max(0, 2 * sc), 0, Math.PI*2); ctx.fill();
                ctx.shadowBlur = 5; ctx.shadowColor = 'red'; ctx.fill(); ctx.shadowBlur = 0;
            }

            ctx.restore();

            // HP Bar
            const barScale = Math.max(0.7, e.radius / 20);
            const hpPct = e.hp / e.maxHp;
            const barW = 32 * barScale; const barH = 4 * barScale;
            ctx.fillStyle = '#7f1d1d'; ctx.fillRect(e.x - barW/2, e.y + e.radius + 6 * barScale, barW, barH);
            ctx.fillStyle = e.isPlayer ? '#3b82f6' : '#22c55e'; ctx.fillRect(e.x - barW/2, e.y + e.radius + 6 * barScale, barW * hpPct, barH);
            // Burst Bar for Boss
        if (e.isBoss) {
            const currentBurst = e.burstPoints || 0;
            const remaining = Math.max(0, 50 - currentBurst);
            const burstPct = Math.min(1, currentBurst / 50);
            const barY = e.y + e.radius + 6 * barScale + barH + 2;
            
            // Background
            ctx.fillStyle = '#450a0a'; 
            ctx.fillRect(e.x - barW/2, barY, barW, barH * 0.8);
            
            // Fill
            ctx.fillStyle = '#a855f7'; 
            ctx.fillRect(e.x - barW/2, barY, barW * burstPct, barH * 0.8);
            
            // Border
            ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
            ctx.strokeRect(e.x - barW/2, barY, barW, barH * 0.8);

            // Countdown Text
            ctx.fillStyle = '#f0abfc'; // Pinkish purple
            ctx.font = `bold ${Math.max(8, 9 * barScale)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(remaining.toString(), e.x, barY + barH * 0.8 + 8);
        }
        
        // HP Border
            ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.strokeRect(e.x - barW/2, e.y + e.radius + 6 * barScale, barW, barH);
            
            // Name tag
            ctx.fillStyle = '#fff'; ctx.font = `bold 25px Inter, sans-serif`; ctx.textAlign = 'center';
            ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
            ctx.fillText(e.combatant.name.substring(0,14), e.x, e.y - e.radius - 14);
            
            // Render statuses
            let statusY = e.y - e.radius - 30;
            const drawStatus = (text: string, color: string) => {
                ctx.fillStyle = color;
                ctx.fillText(text, e.x, statusY);
                statusY -= 12 * barScale;
            };

            if (e.thuTimer && e.thuTimer > 0) drawStatus("THỦ", "#22c55e");
            if (e.tocTimer && e.tocTimer > 0) drawStatus("TỐC", "#22c55e");
            if (e.hoanTimer && e.hoanTimer > 0) drawStatus("Hoãn", "#ef4444");
            if (e.docTimer && e.docTimer > 0) drawStatus("Độc", "#ef4444");
            if (e.camTimer && e.camTimer > 0) drawStatus("Cấm", "#ef4444");
            if (e.phaTimer && e.phaTimer > 0) drawStatus("Phá", "#ef4444");

            ctx.shadowBlur = 0;
        });

        // Projectiles (Shurikens or magic blasts)
        s.projectiles.forEach(p => {
            const src = s.entities.find(e => e.id === p.sourceId);
            
            if (p.isBeastBomb) {
                if (p.arcProgress && p.arcProgress < 1) {
                    const mult = p.scaleMultiplier || 1;
                    ctx.save();
                    // Ball
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 18 * mult, 0, Math.PI * 2);
                    ctx.fillStyle = '#000000';
                    ctx.fill();
                    ctx.strokeStyle = '#ef4444';
                    ctx.lineWidth = 3 * mult;
                    ctx.stroke();
                    
                    // Glow
                    const glow = ctx.createRadialGradient(p.x, p.y, 10 * mult, p.x, p.y, 30 * mult);
                    glow.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
                    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    ctx.fillStyle = glow;
                    ctx.fill();

                    // Tail trail
                    const trailCount = 8;
                    for (let i = 0; i < trailCount; i++) {
                        const trailT = p.arcProgress - (i * 0.02);
                        if (trailT < 0) continue;
                        const tx = p.startX! + (p.targetX! - p.startX!) * trailT;
                        const ty = p.startY! + (p.targetY! - p.startY!) * trailT + (-400 * Math.sin(trailT * Math.PI));
                        
                        ctx.beginPath();
                        ctx.arc(tx, ty, Math.max(1, (14 - i * 1.5) * mult), 0, Math.PI * 2);
                        ctx.fillStyle = i % 2 === 0 ? `rgba(0, 0, 0, ${0.6 - i * 0.05})` : `rgba(239, 68, 68, ${0.6 - i * 0.05})`;
                        ctx.fill();
                    }
                    ctx.restore();
                }
                return; // Skip normal projectile drawing
            }

            const isGiantNPC = src && !src.isPlayer && src.radius >= 40; // 40 = 2x base radius of 20

            if (p.isDebuffWave) {
                ctx.save();
                ctx.translate(p.x, p.y);
                const angle = Math.atan2(p.vy, p.vx);
                ctx.rotate(angle);

                const size = Math.max(10, p.baseSize || 20);
                const color = p.color || '#ef4444';

                // We draw a crescent ")" curving backward relative to forward direction (convex side leading)
                // Center of the arc is at (-size, 0), radius is size, sweep from -Math.PI/3 to Math.PI/3
                ctx.beginPath();
                ctx.arc(-size, 0, size, -Math.PI / 3, Math.PI / 3);

                // Glow style
                ctx.strokeStyle = color;
                ctx.lineWidth = Math.max(3, size * 0.15);
                ctx.lineCap = 'round';
                
                ctx.shadowBlur = 15;
                ctx.shadowColor = color;
                ctx.stroke();

                // Inner bright white/light core
                ctx.beginPath();
                ctx.arc(-size, 0, size, -Math.PI / 3.5, Math.PI / 3.5);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = Math.max(1, size * 0.05);
                ctx.stroke();

                // Tail trailing arc 1
                ctx.shadowBlur = 0;
                ctx.strokeStyle = color;
                ctx.globalAlpha = 0.4;
                ctx.lineWidth = Math.max(1.5, size * 0.08);
                ctx.beginPath();
                ctx.arc(-size - 15, 0, size * 0.8, -Math.PI / 4, Math.PI / 4);
                ctx.stroke();

                // Tail trailing arc 2
                ctx.beginPath();
                ctx.arc(-size - 30, 0, size * 0.6, -Math.PI / 5, Math.PI / 5);
                ctx.stroke();

                ctx.restore();
                return;
            }

            if (p.isExpandingCircle) {
                ctx.save();
                ctx.beginPath();
                const radius = Math.max(0, p.baseSize || 10);
                const innerRadius = Math.max(0, radius - 20);
                
                ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
                
                const gradient = ctx.createRadialGradient(p.x, p.y, innerRadius, p.x, p.y, radius);
                gradient.addColorStop(0, 'rgba(34, 197, 94, 0)');
                gradient.addColorStop(0.5, 'rgba(34, 197, 94, 0.2)'); // Pure green
                gradient.addColorStop(1, 'rgba(34, 197, 94, 0.8)');   // Green edge
                
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 15;
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#22c55e';
                ctx.stroke();

                // Draw the emoji at the center of the expanding circle
                if (p.emoji) {
                    ctx.font = '60px Inter, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.globalAlpha = Math.max(0, 1 - (radius / 2500)); // Fade out as it expands
                    ctx.fillText(p.emoji, p.x, p.y);
                }
                
                ctx.restore();
                return;
            }

            if (p.isArcWave || p.isUltimateStrike) {
                ctx.save();
                ctx.translate(p.x, p.y);
                const angle = Math.atan2(p.vy, p.vx);
                ctx.rotate(angle);
                
                const size = Math.max(0, (p.baseSize || 10) * 1.5); 
                const arcHalfAngle = (15 * Math.PI / 180) / 2;
                
                // WAVING LOGIC: Draw cascading 🌊 icons
                // Optimized spacing to prevent overlap and lag
                const iconSpacing = 45; 
                const arcLength = size * (arcHalfAngle * 2);
                const numWaveIcons = Math.min(8, Math.max(1, Math.ceil(arcLength / iconSpacing)));
                
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const fontSize = Math.min(50, 18 + size * 0.08); // Reverting this to original for general text
                const waveFontSize = 128; // Setting wave font size to exactly 128px for AoE waves
                ctx.font = `${fontSize}px Inter, sans-serif`;
                
                // Reduced shadow heavy operations for performance
                ctx.shadowBlur = 0; 

                for (let j = 0; j < numWaveIcons; j++) {
                    const stepPercent = numWaveIcons === 1 ? 0.5 : j / (numWaveIcons - 1);
                    const stepAngle = -arcHalfAngle + stepPercent * (arcHalfAngle * 2);
                    
                    const wx = Math.cos(stepAngle) * size - size/2;
                    const wy = Math.sin(stepAngle) * size;
                    
                    ctx.save();
                    ctx.translate(wx, wy);
                    ctx.rotate(stepAngle + Math.PI/2);
                    ctx.font = `${waveFontSize}px Inter, sans-serif`; // Setting wave font size
                    // Single glow effect instead of per-icon shadow
                    ctx.fillText('🌊', 0, 0);
                    ctx.restore();
                }

                ctx.restore();
                return;
            }

            if (p.isAuraFarmingExplosion) {
                ctx.save();
                ctx.translate(p.x, p.y);
                const maxLife = p.maxLife || 1000;
                const progress = 1 - (p.life / maxLife); 
                const alpha = Math.min(1, (p.life / maxLife) * 1.5); 
                const maxSize = (p as any).size || 100;
                
                // Exponential bloom
                const easeOutExpo = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
                const currentSize = maxSize * easeOutExpo;
                
                // Simple White-to-Blue Gradient as requested
                const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, currentSize);
                glow.addColorStop(0, `rgba(255, 255, 255, ${alpha})`); // Pure white core
                glow.addColorStop(0.4, `rgba(186, 230, 253, ${alpha * 0.9})`); // Soft blue transition
                glow.addColorStop(0.8, `rgba(14, 165, 233, ${alpha * 0.7})`); // Vibrant blue outer (Sky-500)
                glow.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Soft edge
                
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(0, 0, currentSize, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.restore();
                return;
            }

            if ((p as any).isHammerAttack) {
                const maxLife = p.maxLife || 600;
                const progress = 1 - (p.life / maxLife);
                const alpha = p.life / maxLife; 
                const strikeAngle = (p as any).hammerAngle || 0;

                // 1. Vẽ vùng hình quạt mờ lấp lánh màu vàng cam óng CỐ ĐỊNH TRƯỚC MẶT CASTER (không di chuyển theo búa)
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(strikeAngle);
                
                ctx.fillStyle = `rgba(245, 158, 11, ${alpha * 0.15})`;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                // Bán kính tác động 250px, góc mở rộng 120 độ (-Math.PI / 3 đến Math.PI / 3)
                ctx.arc(0, 0, 250, -Math.PI / 3, Math.PI / 3);
                ctx.closePath();
                ctx.fill();
                
                // Viền hình quạt để tăng tính trực quan
                ctx.strokeStyle = `rgba(245, 158, 11, ${alpha * 0.35})`;
                ctx.lineWidth = 2.5;
                ctx.stroke();
                
                // Vẽ vết nứt đất chấn động lấp lánh màu vàng cam óng ở điểm chạm búa (progress >= 0.2)
                if (progress >= 0.2) {
                    ctx.fillStyle = `rgba(251, 191, 36, ${alpha * 0.3})`;
                    ctx.beginPath();
                    ctx.arc(140, 0, 45, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Vẽ các tia chấn động nhỏ nứt đất rực rỡ như mẫu vẽ
                    ctx.strokeStyle = `rgba(245, 158, 11, ${alpha * 0.75})`;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(120, -12);
                    ctx.lineTo(145, 8);
                    ctx.lineTo(165, -8);
                    ctx.stroke();
                }
                ctx.restore();

                // 2. Vẽ hư ảnh Thần búa khổng lồ đập từ trên xuống
                ctx.save();
                ctx.translate(p.x, p.y);
                
                // Swing progresses overhead (-Math.PI / 2.5) to slam down (+Math.PI / 10)
                // Cú đập dứt khoát nhanh gọn trong nửa chu kỳ đầu, nửa sau giữ nguyên tư thế nện đất
                const swingProgress = Math.min(1, progress * 2.2); 
                const swingAngle = -Math.PI / 2.5 + (Math.PI / 2.5 + Math.PI / 10) * swingProgress;
                
                ctx.rotate(strikeAngle + swingAngle);
                
                // Hiệu ứng phát sáng trắng mờ xung quanh đầu búa (Glowing White Aura)
                ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
                ctx.shadowBlur = 18;
                
                // A. Vẽ cán búa (Handle) bằng gỗ sẫm màu
                ctx.fillStyle = '#7c2d12'; // Màu nâu gỗ gụ sẫm
                ctx.fillRect(0, -5, 130, 10); // Chiều dài cán 130px, độ dày 10px
                
                // B. Vẽ đầu búa (Hammerhead) khổng lồ xám bạc ánh kim
                // Khớp nối kim loại sẫm màu giữa cán và đầu búa
                ctx.fillStyle = '#334155';
                ctx.fillRect(126, -45, 4, 90);
                
                // Đầu búa kim loại sáng xám xanh dịu mát giống ảnh mẫu
                ctx.fillStyle = '#cbd5e1'; 
                ctx.strokeStyle = '#f8fafc';
                ctx.lineWidth = 3.5;
                
                const headW = 55;
                const headH = 90;
                ctx.beginPath();
                ctx.rect(130, -headH / 2, headW, headH);
                ctx.fill();
                ctx.stroke();
                
                // Vẽ dải màu xám sẫm chạy dọc chính giữa đầu búa đúng chuẩn mẫu thiết kế
                ctx.fillStyle = '#475569';
                ctx.fillRect(130 + 17, -headH / 2, 20, headH);
                
                // Mặt đập thép cường hóa ở rìa trước của đầu búa
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(130 + headW, -headH / 2 + 10, 6, headH - 20);
                
                ctx.restore();
                return;
            }

            if (p.emoji) {
                ctx.save();
                ctx.translate(p.x, p.y);
                const angle = Math.atan2(p.vy, p.vx);
                ctx.rotate(angle);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const fontSize = p.baseSize || (p.emoji === '🌊' ? 128 : (['⚡', '🔥', '❄️'].includes(p.emoji) ? 60 : 32));
                ctx.font = `${fontSize}px Inter, sans-serif`;
                ctx.globalAlpha = p.life < 500 ? (p.life / 500) : 1; 
                ctx.fillText(p.emoji, 0, 0);
                ctx.restore();
                return;
            }

            ctx.save();
            ctx.translate(p.x, p.y);
            const angle = Math.atan2(p.vy, p.vx);
            ctx.rotate(angle);

            const isNormalBullet = !isGiantNPC && !p.isHeal && !p.isLifesteal && !p.isManhKich && !p.isExpandingCircle && !p.isArcWave && !p.isUltimateStrike && !p.emoji;

            if (isNormalBullet) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';

                const baseSize = Math.max(5, p.baseSize || 10);
                
                // Draw 6 trailing, fading golden/orange comet segments extending backwards (-X direction)
                const tailLength = 6;
                for (let i = tailLength; i >= 1; i--) {
                    const tailX = -i * (baseSize * 1.6);
                    const alpha = 0.9 * (1 - i / (tailLength + 1));
                    const currentSize = baseSize * (1 - (i * 0.1));
                    
                    // Orange halo outer glow
                    const tailGrad = ctx.createRadialGradient(tailX, 0, 0, tailX, 0, currentSize * 2.8);
                    tailGrad.addColorStop(0, `rgba(251, 146, 60, ${alpha})`); // Orange-400
                    tailGrad.addColorStop(0.4, `rgba(249, 115, 22, ${alpha * 0.4})`); // Orange-500
                    tailGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    
                    ctx.fillStyle = tailGrad;
                    ctx.beginPath();
                    ctx.arc(tailX, 0, currentSize * 2.8, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Yellow glowing streak line in the tail
                    ctx.strokeStyle = `rgba(253, 224, 71, ${alpha * 0.85})`; // Yellow-300
                    ctx.lineWidth = currentSize * 0.9;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(tailX - baseSize * 0.8, 0);
                    ctx.lineTo(tailX + baseSize * 0.8, 0);
                    ctx.stroke();
                }

                // Main glow around the bullet head
                const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, baseSize * 4.0);
                glowGrad.addColorStop(0, 'rgba(255, 255, 255, 1)'); // Hot white core
                glowGrad.addColorStop(0.2, 'rgba(253, 224, 71, 0.9)'); // Golden-yellow
                glowGrad.addColorStop(0.6, 'rgba(249, 115, 22, 0.45)'); // Warm orange
                glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                
                ctx.fillStyle = glowGrad;
                ctx.beginPath();
                ctx.arc(0, 0, baseSize * 4.0, 0, Math.PI * 2);
                ctx.fill();

                // Sleek capsule bullet head with horizontal gradient pointing forward (+X direction)
                const headGrad = ctx.createLinearGradient(-baseSize * 1.5, 0, baseSize * 1.5, 0);
                headGrad.addColorStop(0, 'rgba(249, 115, 22, 1)'); // Back of the bullet is orange
                headGrad.addColorStop(0.4, 'rgba(253, 224, 71, 1)'); // Middle is bright yellow
                headGrad.addColorStop(1, '#ffffff'); // Tips are pure white
                
                ctx.fillStyle = headGrad;
                ctx.beginPath();
                ctx.ellipse(0, 0, baseSize * 1.9, baseSize * 0.9, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            } else {
                if (isGiantNPC && !p.isHeal && !p.isExpandingCircle && !p.isLifesteal) {
                    // Giant NPC attack is ">"
                    ctx.strokeStyle = p.color || '#ef4444';
                    ctx.lineWidth = 4;
                    ctx.lineJoin = 'round';
                    ctx.shadowBlur = 10; ctx.shadowColor = p.color || '#ef4444';
                    ctx.beginPath();
                    ctx.moveTo(-15 * 0.8, -15 * 0.8);
                    ctx.lineTo(15 * 0.8, 0);
                    ctx.lineTo(-15 * 0.8, 15 * 0.8);
                    ctx.stroke();
                } else {
                    // Head
                    if (p.isManhKich) {
                        const headSize = (p.baseSize || 40) * 1.2;
                        ctx.save();
                        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, headSize);
                        grad.addColorStop(0, '#ffffff');
                        grad.addColorStop(0.3, p.color === '#3b82f6' ? '#93c5fd' : '#fca5a5');
                        grad.addColorStop(1, p.color);
                        ctx.fillStyle = grad;
                        ctx.beginPath();
                        ctx.arc(0, 0, headSize, 0, Math.PI * 2);
                        ctx.fill();
                        
                        ctx.shadowBlur = 30;
                        ctx.shadowColor = p.color;
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(0, 0, headSize * 0.8, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.restore();
                    } else {
                        ctx.fillStyle = p.color;
                        ctx.beginPath();
                        ctx.arc(0, 0, Math.max(0, p.baseSize || 5), 0, Math.PI * 2);
                        ctx.fill();
                    }
                }

                // Tail
                const isLaser = p.isLaser;
                if (isLaser && p.isManhKich) {
                    // Special Kamehameha Visuals
                    const beamLength = 4000; // Full map beam or more
                    
                    const isAllyBeam = p.color === '#3b82f6';
                    const outerColor = isAllyBeam ? '#3b82f6' : '#ef4444';
                    const innerColor = isAllyBeam ? '#93c5fd' : '#fca5a5';
                    const shadowColor = isAllyBeam ? '#60a5fa' : '#f87171';

                    // Outer Glow
                    ctx.shadowBlur = 40;
                    ctx.shadowColor = shadowColor;
                    
                    // Outer
                    ctx.strokeStyle = outerColor;
                    ctx.lineWidth = p.baseSize || 40;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(beamLength, 0);
                    ctx.stroke();
                    
                    // Middle
                    ctx.strokeStyle = innerColor;
                    ctx.lineWidth = (p.baseSize || 40) * 0.6;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(beamLength, 0);
                    ctx.stroke();
                    
                    // White Core
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = (p.baseSize || 40) * 0.2;
                    ctx.shadowBlur = 15;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(beamLength, 0);
                    ctx.stroke();
                    
                    ctx.shadowBlur = 0;
                } else {
                    const tailLength = isLaser ? (p.baseSize || 30) * 3 : 120; // Đuôi kéo dài hơn đáng kể (120px)
                    const gradient = ctx.createLinearGradient(0, 0, -tailLength, 0);
                    gradient.addColorStop(0, p.color);
                    gradient.addColorStop(1, 'transparent');
                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = isLaser ? (p.baseSize || 10) * 0.4 : 6;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(-tailLength, 0);
                    ctx.stroke();
                }
            }

            ctx.restore();
        });
        
        // Pending Lasers buildup
        s.pendingLasers.forEach(l => {
            if (l.isManhKich) {
                // Kamehameha buildup animation
                const progress = l.timer / 100;
                const sizeBase = l.isSieuManhKich ? 30 : 15;
                const sizeGrow = l.isSieuManhKich ? 100 : 75;
                const size = sizeBase + progress * sizeGrow; // Growing sphere
                
                const sourceIsAlly = isAlly(l.sourceId);
                const outerColor = sourceIsAlly ? 'rgba(59, 130, 246, 0.6)' : 'rgba(239, 68, 68, 0.6)';
                const innerColorTop = sourceIsAlly ? '#93c5fd' : '#fca5a5';
                const innerColorBottom = sourceIsAlly ? '#3b82f6' : '#ef4444';

                ctx.save();
                ctx.translate(l.x, l.y);
                
                if (l.isSieuManhKich) {
                    // Show 5 parallel line guides during buildup
                    const ang = Math.atan2(l.ty - l.y, l.tx - l.x);
                    const perpAng = ang + Math.PI / 2;
                    const dashOffset = (s.totalTime / 20) % 20;
                    ctx.setLineDash([5, 5]);
                    ctx.lineDashOffset = -dashOffset;
                    ctx.strokeStyle = outerColor;
                    ctx.lineWidth = 1;
                    const offsets = [-140, -70, 0, 70, 140];
                    offsets.forEach(off => {
                         const ox = Math.cos(perpAng) * off;
                         const oy = Math.sin(perpAng) * off;
                         ctx.beginPath();
                         ctx.moveTo(ox, oy);
                         ctx.lineTo(ox + Math.cos(ang) * 4000, oy + Math.sin(ang) * 4000);
                         ctx.stroke();
                    });
                    ctx.setLineDash([]);
                }
                
                // Buildup sphere(s)
                const renderSphere = (ox: number, oy: number) => {
                    ctx.save();
                    ctx.translate(ox, oy);
                    
                    // Outer glow
                    ctx.beginPath();
                    const glow = ctx.createRadialGradient(0, 0, size * 0.5, 0, 0, size * 2.5);
                    glow.addColorStop(0, outerColor);
                    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    ctx.fillStyle = glow;
                    ctx.arc(0, 0, size * 2.5, 0, Math.PI * 2);
                    ctx.fill();

                    // Core sphere
                    ctx.beginPath();
                    const grad = ctx.createRadialGradient(0, 0, size * 0.3, 0, 0, size);
                    grad.addColorStop(0, '#ffffff');
                    grad.addColorStop(0.4, innerColorTop);
                    grad.addColorStop(1, innerColorBottom);
                    ctx.fillStyle = grad;
                    ctx.arc(0, 0, size, 0, Math.PI * 2);
                    ctx.fill();

                    // Electric sparks
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    const sparkCount = 6 + Math.floor(progress * 10);
                    for (let i = 0; i < sparkCount; i++) {
                        const angSpark = Math.random() * Math.PI * 2;
                        const r1 = size * (0.8 + Math.random() * 0.4);
                        const r2 = r1 + 10 + Math.random() * 20;
                        ctx.beginPath();
                        ctx.moveTo(Math.cos(angSpark) * r1, Math.sin(angSpark) * r1);
                        ctx.lineTo(Math.cos(angSpark) * r2, Math.sin(angSpark) * r2);
                        ctx.stroke();
                    }
                    ctx.restore();
                };

                if (l.isSieuManhKich) {
                    const ang = Math.atan2(l.ty - l.y, l.tx - l.x);
                    const perpAng = ang + Math.PI / 2;
                    const offsets = [-140, -70, 0, 70, 140];
                    offsets.forEach(off => {
                        renderSphere(Math.cos(perpAng) * off, Math.sin(perpAng) * off);
                    });
                } else {
                    renderSphere(0, 0);
                }

                ctx.restore();
            } else {
                ctx.strokeStyle = '#facc15';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(l.x, l.y);
                ctx.lineTo(l.tx, l.ty);
                ctx.stroke();
            }
        });

        // VFX
        s.vfx.forEach(v => {
            let opacity = Math.max(0, v.life / v.maxLife);
            
            if (v.isImage && slashImageRef.current && slashImageRef.current.complete && slashImageRef.current.naturalWidth > 0) {
                ctx.save();
                ctx.globalAlpha = opacity;
                ctx.globalCompositeOperation = 'screen';
                ctx.translate(v.x, v.y);
                ctx.rotate(v.rotation || 0);
                const size = (v.scale || 1) * 192;
                if (v.isEnemySlash) {
                    ctx.filter = 'hue-rotate(160deg) saturate(200%)';
                }
                ctx.drawImage(slashImageRef.current, -size/2, -size/2, size, size);
                ctx.restore();
                return;
            }

            if (v.isAfterimage) {
                ctx.save();
                ctx.globalAlpha = opacity * 0.5;
                ctx.translate(v.x, v.y);
                if (v.facingLeft) ctx.scale(-1, 1);
                
                const sc = (v.radius || 20) / 20;
                const wobble = v.wobble || 0;
                
                let colorHead = v.entityType === 'player' ? '#fcd5ce' : (v.entityType === 'ally' ? '#86efac' : '#fca5a5');
                let colorBody = v.entityType === 'player' ? '#e2e8f0' : (v.entityType === 'ally' ? '#22c55e' : '#991b1b');
                let colorOutline = v.entityType === 'player' ? '#fbbf24' : '#111';

                if (v.isBoss) {
                    colorHead = '#111';
                    colorBody = '#7f1d1d';
                    colorOutline = '#ef4444';
                }

                // Body
                ctx.fillStyle = colorBody;
                ctx.strokeStyle = colorOutline;
                ctx.lineWidth = 1.5 * sc;
                ctx.beginPath();
                ctx.arc(0, wobble + 8 * sc, Math.max(0, (v.radius || 20) * 0.8), Math.PI, 0);
                ctx.lineTo(Math.max(0, (v.radius || 20) * 0.8), wobble + (v.radius || 20));
                ctx.lineTo(-Math.max(0, (v.radius || 20) * 0.8), wobble + (v.radius || 20));
                ctx.closePath();
                ctx.fill(); ctx.stroke();
                
                // Head
                ctx.fillStyle = colorHead;
                ctx.beginPath();
                ctx.arc(0, wobble - 6 * sc, Math.max(0, (v.radius || 20) * 0.6), 0, Math.PI * 2);
                ctx.fill(); ctx.stroke();
                
                ctx.restore();
                return;
            }

            if (v.text === '💥') {
                opacity = (Math.floor(v.life / 50) % 2 === 0) ? 1.0 : 0.2;
            }
            ctx.globalAlpha = opacity;
            ctx.fillStyle = v.color;
            
            // Scaled font sizes for specific skills
            let fontSize = 24;
            if (v.text === '💥') fontSize = 48;
            else if (v.text === '🌋') fontSize = 120; // 5x original 24px
            else if (v.text === '🌪️') fontSize = 144; // 6x original 24px
            
            ctx.font = `900 ${fontSize}px Inter, sans-serif`; 
            ctx.textAlign = 'center';
            ctx.shadowColor = 'black'; ctx.shadowBlur = 4;
            ctx.fillText(v.text, v.x, v.y);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1.0;
        });

        // Mushroom Explosions
        s.projectiles.forEach(p => {
            if (p.isBeastBomb && p.arcProgress && p.arcProgress >= 1) {
                const lifePct = p.life / 1000;
                if (lifePct <= 0) return;

                ctx.save();
                ctx.translate(p.targetX!, p.targetY!);
                
                // Scaling with life and scaleMultiplier
                const scale = (1 + (1 - lifePct) * 0.5) * (p.scaleMultiplier || 1);
                ctx.scale(scale, scale);

                // Mushroom cloud bottom ring
                ctx.beginPath();
                ctx.ellipse(0, 0, 180, 50, 0, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(239, 68, 68, ${0.3 * lifePct})`;
                ctx.fill();

                // Core column
                const grad = ctx.createLinearGradient(0, 0, 0, -250);
                grad.addColorStop(0, `rgba(239, 68, 68, ${0.8 * lifePct})`);
                grad.addColorStop(0.5, `rgba(0, 0, 0, ${0.9 * lifePct})`);
                grad.addColorStop(1, `rgba(255, 255, 255, ${0.5 * lifePct})`);

                ctx.beginPath();
                ctx.moveTo(-50, 0);
                ctx.quadraticCurveTo(0, -100, -120, -250);
                ctx.lineTo(120, -250);
                ctx.quadraticCurveTo(0, -100, 50, 0);
                ctx.fillStyle = grad;
                ctx.fill();

                // Mushroom top (Head)
                ctx.beginPath();
                ctx.arc(0, -280, 250, Math.PI, 0);
                ctx.fillStyle = `rgba(239, 68, 68, ${0.2 * lifePct})`;
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(0, -280, 200, Math.PI, 0);
                ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * lifePct})`;
                ctx.fill();

                // Bright center
                ctx.beginPath();
                ctx.arc(0, -150, 100 * lifePct, 0, Math.PI * 2);
                const flashGrad = ctx.createRadialGradient(0, -150, 0, 0, -150, 100);
                flashGrad.addColorStop(0, `rgba(255, 255, 255, ${lifePct})`);
                flashGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = flashGrad;
                ctx.fill();

                ctx.restore();
            }
        });

        // Final Screen Flash
        if (s.screenFlashTimer > 0) {
            ctx.restore(); // Exit camera space to draw flash on full screen
            ctx.save();
            ctx.scale(resScale, resScale);
            ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * (s.screenFlashTimer / 300)})`;
            ctx.fillRect(0, 0, screenW/resScale, screenH/resScale);
        }

        ctx.restore();
    };

    const gameLoop = (time: number) => {
        if (!state.current.running) return;
        const dt = time - state.current.lastTime;
        state.current.lastTime = time;
        if (dt < 100) {
            if (!state.current.paused) {
                updatePhysics(dt);
            }
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) draw(ctx);
            }
        }
        requestAnimationFrame(gameLoop);
    };

    // --- Input Handlers ---
    // Drag camera state when player is dead or not available
    const isDraggingCam = useRef(false);
    const lastDragPos = useRef({ x: 0, y: 0 });

    const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const player = state.current.entities.find(ent => ent.isPlayer);
        if (!player || player.isDead) {
            isDraggingCam.current = true;
            lastDragPos.current = { x: e.clientX, y: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
        }
    };

    const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (isDraggingCam.current) {
            const dx = e.clientX - lastDragPos.current.x;
            const dy = e.clientY - lastDragPos.current.y;
            const zoom = 0.35;
            state.current.cameraOffset.x -= dx / zoom;
            state.current.cameraOffset.y -= dy / zoom;
            lastDragPos.current = { x: e.clientX, y: e.clientY };
            
            if (!state.current.running || state.current.paused) {
                if (canvasRef.current) {
                    const ctx = canvasRef.current.getContext('2d');
                    if (ctx) draw(ctx);
                }
            }
        }
    };

    const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (isDraggingCam.current) {
            isDraggingCam.current = false;
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    };

    const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
        if (joystickBaseRef.current) {
            const rect = joystickBaseRef.current.getBoundingClientRect();
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
            
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            let dx = clientX - centerX;
            let dy = clientY - centerY;
            
            const dist = Math.hypot(dx, dy);
            if (dist > 0) { dx /= dist; dy /= dist; }
            
            setStickPos({ x: dx * 30, y: dy * 30 });
            state.current.joystick = { dx, dy };
        }
    };
    
    const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (state.current.joystick.dx !== 0 || state.current.joystick.dy !== 0) {
            handleTouchStart(e);
        }
    };
    
    const handleTouchEnd = () => {
        setStickPos({ x: 0, y: 0 });
        state.current.joystick = { dx: 0, dy: 0 };
    };

    // Keep React state for player HP in sync occasionally for the UI overlay
    // Use an interval instead of putting it in the game loop to save performance
    const [uiHp, setUiHp] = useState(0);
    const [uiMaxHp, setUiMaxHp] = useState(1);
    const [kills, setKills] = useState(0);
    const [deaths, setDeaths] = useState(0);
    
    // Skill cooldowns (React state for quick UI)
    const availableSkills = useMemo(() => {
        const skills = [...(knowledgeBase.playerSkills || [])];
        const hasChemChem = skills.some(s => s.name === "Chém Chém" || s.name?.toUpperCase().includes("CHÉM CHÉM"));
        if (!hasChemChem) {
            skills.push({
                id: "fallback-chemchem-default",
                name: "Chém Chém",
                description: "Lướt 300 khoảng cách, chém 2 lần liên tiếp.",
                skillType: "Linh Kỹ" as any,
                baseDamage: 30,
                healingAmount: 0,
                damageMultiplier: 1,
                healingMultiplier: 0,
                manaCost: 10,
                cooldown: 0,
                detailedEffect: "Lướt 300 khoảng cách, chém liên hoàn 2 lần lên mục tiêu.",
                level: 1,
                proficiency: 0,
                maxProficiency: 100
            });
        }
        return skills;
    }, [knowledgeBase.playerSkills]);

    const [gcdUi, setGcdUi] = useState(0);
    const [selectedSkill1, setSelectedSkill1] = useState<Skill | null>(availableSkills[0] || null);
    const [selectedSkill2, setSelectedSkill2] = useState<Skill | null>(availableSkills.length > 1 ? availableSkills[1] : null);
    
    // Target locking state
    const [lockedTargetId, setLockedTargetId] = useState<string | null>(null);
    const [isEnemyListExpanded, setIsEnemyListExpanded] = useState(false);
    
    const [skill1Cd, setSkill1Cd] = useState(0);
    const [skill2Cd, setSkill2Cd] = useState(0);
    const [shieldCd, setShieldCd] = useState(0);
    const [attackCooldownUi, setAttackCooldownUi] = useState(false);

    const [isSkillSelectModalOpen, setIsSkillSelectModalOpen] = useState<{slot: 1|2} | null>(null);
    const [isPaused, setIsPaused] = useState(false);
    const [selectedSwapAllyId, setSelectedSwapAllyId] = useState<string | null>(null);
    const [rewardModalData, setRewardModalData] = useState<{ options: { id: string, label: string, desc: string }[] } | null>(null);

    const handleSelectReward = (rewardId: string) => {
        const stats = knowledgeBase.playerStats;
        if (!stats.permanentBonuses) {
            stats.permanentBonuses = {
                speedMult: 0,
                critChanceAdd: 0,
                shieldDurationMult: 0,
                shieldCdMult: 0,
                damageReductionAdd: 0,
                attackPowerMult: 0,
                maxHpMult: 0,
                attackSpeedMult: 0
            };
        }
        const b = stats.permanentBonuses;

        switch (rewardId) {
            case 'speed': b.speedMult = (b.speedMult || 0) + 0.01; break;
            case 'crit': b.critChanceAdd = (b.critChanceAdd || 0) + 0.02; break;
            case 'shield_dur': b.shieldDurationMult = (b.shieldDurationMult || 0) + 0.02; break;
            case 'shield_cd': b.shieldCdMult = (b.shieldCdMult || 0) + 0.01; break;
            case 'dmg_red': b.damageReductionAdd = (b.damageReductionAdd || 0) + 0.01; break;
            case 'atk': b.attackPowerMult = (b.attackPowerMult || 0) + 0.01; break;
            case 'hp': b.maxHpMult = (b.maxHpMult || 0) + 0.01; break;
            case 'atk_spd': b.attackSpeedMult = (b.attackSpeedMult || 0) + 0.01; break;
        }

        setKnowledgeBase({ ...knowledgeBase, playerStats: stats });
        setRewardModalData(null);
        
        // After selecting reward, check if there are still living enemies
        const livingEnemies = state.current.entities.filter(e => !e.isAlly && !e.isDead && !e.isObstacle);
        if (livingEnemies.length === 0) {
            // All enemies dead, end combat
            state.current.running = false;
            setCombatEnded('victory');
            setLootBoxStatus('closed');
        } else {
            // Still enemies left, resume combat
            state.current.paused = false;
        }
    };

    // Pause while selecting skill
    useEffect(() => {
        if (isSkillSelectModalOpen) {
            state.current.paused = true;
        } else if (!isPaused) {
            state.current.paused = false;
        }
    }, [isSkillSelectModalOpen, isPaused]);
    const [inspectingEntity, setInspectingEntity] = useState<RTEntity | null>(null);
    const [inspectingItem, setInspectingItem] = useState<Item | null>(null);
    const [lootBoxStatus, setLootBoxStatus] = useState<'hidden' | 'closed' | 'opening' | 'opened'>('hidden');
    const [lootBoxItems, setLootBoxItems] = useState<Item[]>([]);
    const [hasQuestPlaceholder, setHasQuestPlaceholder] = useState<boolean>(false);

    const useShield = () => {
        const p = state.current.entities.find(e => e.isPlayer);
        if (!p || p.isDead || shieldCd > 0) return;
        p.shieldTimer = 800; // 0.8s as requested
        p.shieldCd = 2000;  // 2s as requested
        setShieldCd(2000);
    };

    const useSkill = (skillIndex: 1 | 2) => {
        const p = state.current.entities.find(e => e.isPlayer);
        if (!p || p.isDead) return;
        
        const skill = skillIndex === 1 ? selectedSkill1 : selectedSkill2;
        if (!skill) return;

        const cdState = skillIndex === 1 ? skill1Cd : skill2Cd;
        if (cdState > 0) return;

        const totalDt = getSkillCooldownMs(skill);
        if (skillIndex === 1) setSkill1Cd(totalDt);
        else setSkill2Cd(totalDt);

        handleSkillLogic(p, skill);
    };

    // Keyboard WASD handlers
    useEffect(() => {
        const keys = { w: false, a: false, s: false, d: false };

        const updateJoystickFromKeys = () => {
            let dx = 0;
            let dy = 0;
            if (keys.a) dx -= 1;
            if (keys.d) dx += 1;
            if (keys.w) dy -= 1;
            if (keys.s) dy += 1;

            const dist = Math.hypot(dx, dy);
            if (dist > 0) {
                dx /= dist;
                dy /= dist;
            }
            
            // Allow WASD to override or supplement joystick.
            // If dragging joystick, touch events might override this until WASD is updated again.
            state.current.joystick = { dx, dy };
        };

        const onKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (['w', 'a', 's', 'd'].includes(key)) {
                keys[key as keyof typeof keys] = true;
                updateJoystickFromKeys();
            } else if (key === 'z') {
                state.current.allyStance = 'defense';
                setAllyStance('defense');
                const p = state.current.entities.find(ent => ent.isPlayer);
                if (p) spawnVfx("🛡️ TẬP HỢP PHÒNG THỦ!", p.x, p.y - 60, '#38bdf8');
            } else if (key === 'x') {
                state.current.allyStance = 'attack';
                setAllyStance('attack');
                const p = state.current.entities.find(ent => ent.isPlayer);
                if (p) spawnVfx("⚔️ TỔNG LỰC TIẾN CÔNG!", p.x, p.y - 60, '#f59e0b');
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (['w', 'a', 's', 'd'].includes(key)) {
                keys[key as keyof typeof keys] = false;
                updateJoystickFromKeys();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    useEffect(() => {
        let lastRealTime = performance.now();
        const interval = setInterval(() => {
            const now = performance.now();
            const tick = now - lastRealTime;
            lastRealTime = now;
            
            const p = state.current.entities.find(e => e.isPlayer);
            if (p) {
                setUiHp(p.hp);
                setUiMaxHp(p.maxHp);
                setGcdUi(p.globalCooldown);
            }
            setKills(state.current.entities.filter(e => !e.isAlly && e.isDead).length);
            setDeaths(state.current.entities.filter(e => e.isAlly && e.isDead).length);
            
            if (state.current.lockedTargetId) {
                const lockedTarget = state.current.entities.find(e => e.id === state.current.lockedTargetId);
                if (!lockedTarget || lockedTarget.isDead) {
                    state.current.lockedTargetId = null;
                    setLockedTargetId(null);
                }
            }

            setSkill1Cd(prev => Math.max(0, prev - tick));
            setSkill2Cd(prev => Math.max(0, prev - tick));
            setShieldCd(prev => Math.max(0, prev - tick));
        }, 100);
        return () => clearInterval(interval);
    }, []);

    // Combat End Logic
    useEffect(() => {
        if (combatEnded === 'victory') {
            // Bao gồm tất cả kẻ địch còn lại trên sân (đã chết hoặc còn sống khi boss chết)
            const def = state.current.entities
                .filter(e => !e.isAlly && !e.isObstacle && !e.isSummoned)
                .map(e => ({ ...e.combatant, id: e.id } as DefeatedEntity));
            setDefeatedList(def);
            
            // Initialize default dispositions to 'release' for all defeated enemies
            const initialDisps: CombatDispositionMap = {};
            def.forEach(d => {
                const entityId = d.id;
                if (entityId) {
                    initialDisps[entityId] = 'release';
                }
            });
            setDispositions(initialDisps);
            
            if (def.length > 0) {
                setIsDispositionModalOpen(true);
            } else {
                const finalAlliesStatus = state.current.entities
                    .filter(e => e.isAlly && !e.isPlayer && !e.isObstacle)
                    .map(e => ({
                        id: e.id,
                        hp: e.hp <= 0 || e.isDead ? 0 : e.hp,
                        mp: e.combatant?.linhLuc || 0
                    }));

                const lastHits: Record<string, { sourceId: string, sourceName: string }> = {};
                state.current.entities.forEach(e => {
                    if (e.lastHitBy) {
                        lastHits[e.id] = {
                            sourceId: e.lastHitBy.id,
                            sourceName: e.lastHitBy.name
                        };
                    }
                });

                restoreOriginalEnemySkills();
                onCombatEnd({ 
                    outcome: 'victory', 
                    finalPlayerState: getMutableStats(state.current.entities.find(e => e.isPlayer)?.combatant) as PlayerStats, 
                    dispositions: {}, 
                    summary: 'Bạn đã chiến thắng', 
                    opponentIds: knowledgeBase.pendingCombat?.opponentIds || [],
                    storyContext: currentPageMessagesLog,
                    finalAlliesStatus,
                    lastHits
                });
            }
        } else if (combatEnded === 'defeat') {
            setIsDefeatModalOpen(true);
        }
    }, [combatEnded]);

    const handleDispositionRefConfirm = (dispositionsMap: CombatDispositionMap) => {
        setIsDispositionModalOpen(false);
        setTimeout(() => {
            const playerEntity = state.current.entities.find(e => e.isPlayer);
            
            // Populate defaults for all defeated entities that don't have a disposition
            const defeatedEntities = state.current.entities.filter(e => !e.isPlayer && !e.isAlly && !e.isObstacle && !e.isSummoned);
            const fullDispositions = { ...dispositionsMap };
            defeatedEntities.forEach((entity, idx) => {
                const eId = entity.id || `enemy_${idx}`;
                if (!fullDispositions[eId]) {
                    fullDispositions[eId] = 'release';
                }
            });

            const finalAlliesStatus = state.current.entities
                .filter(e => e.isAlly && !e.isPlayer && !e.isObstacle)
                .map(e => ({
                    id: e.id,
                    hp: e.hp <= 0 || e.isDead ? 0 : e.hp,
                    mp: e.combatant?.linhLuc || 0
                }));

            // Include Loot Box results in the summary and potentially a new flag
            let lootSummary = "";
            let updatedInventory = [...(knowledgeBase.inventory || [])];
            if (lootBoxStatus === 'opened') {
                if (lootBoxItems.length > 0) {
                    lootSummary = `\n\nBạn đã nhận được: ${lootBoxItems.map(i => i.name).join(', ')}.`;
                    updatedInventory = [...updatedInventory, ...lootBoxItems];
                }
                if (hasQuestPlaceholder) {
                    lootSummary += "\nBạn cũng tìm thấy một ?? Vật phẩm nhiệm vụ ?? cần làm rõ sau.";
                }
            }

            // Extract loot from executed enemies (disposition = 'kill')
            const enemyLootResult = extractLootFromDefeatedEntities(defeatedEntities, fullDispositions, knowledgeBase);
            if (enemyLootResult.lootedItems.length > 0) {
                updatedInventory = [...updatedInventory, ...enemyLootResult.lootedItems];
                lootSummary += enemyLootResult.lootSummaryText;
            }

            const lastHits: Record<string, { sourceId: string, sourceName: string }> = {};
            state.current.entities.forEach(e => {
                if (e.lastHitBy) {
                    // Normalize ID to match KnowledgeBase (remove enemy_index_ prefix)
                    const normalizedId = e.id.replace(/^enemy_\d+_/, '');
                    lastHits[normalizedId] = {
                        sourceId: e.lastHitBy.id,
                        sourceName: e.lastHitBy.name
                    };
                }
            });

            // Calculate MVP
            const allies = state.current.entities.filter(ent => ent.isAlly);
            const mvp = allies.reduce((prev, current) => {
                const currentKills = current.killCount || 0;
                const prevKills = prev.killCount || 0;
                if (currentKills > prevKills) return current;
                if (currentKills === prevKills) {
                    return (current.totalDamageDealt || 0) > (prev.totalDamageDealt || 0) ? current : prev;
                }
                return prev;
            }, allies[0]);

            const mvpDetails = mvp ? {
                id: mvp.id,
                name: mvp.combatant.name,
                damage: Math.floor(mvp.totalDamageDealt || 0),
                kills: mvp.killCount || 0
            } : undefined;

            restoreOriginalEnemySkills();
            onCombatEnd({ 
                outcome: 'victory', 
                finalPlayerState: {
                    ...(getMutableStats(playerEntity?.combatant) as PlayerStats),
                    inventory: updatedInventory
                }, 
                finalInventory: updatedInventory,
                dispositions: fullDispositions,
                summary: 'Bạn đã chiến thắng trận đấu và quyết định số phận kẻ bại trận.' + lootSummary,
                opponentIds: knowledgeBase.pendingCombat?.opponentIds || [],
                storyContext: currentPageMessagesLog,
                finalAlliesStatus,
                lastHits,
                mvpDetails,
                systemLogMessages: enemyLootResult.systemLogMessages
            } as any);
        }, 1000);
    };

    const handleDefeatChoice = (choice: 'suicide' | 'beg' | 'flee') => {
        setIsDefeatModalOpen(false);
        const mappedChoice: 'suicide' | 'beg' | 'run' = choice === 'flee' ? 'run' : choice;
        const outcome = determineDefeatOutcome(mappedChoice);

        const playerEntity = state.current.entities.find(e => e.isPlayer);
        
        let choiceText = '';
        let resultText = '';
        if (mappedChoice === 'suicide') {
            choiceText = 'Tự Sát (Bảo Toàn Khí Tiết)';
            resultText = outcome === 'reincarnate' 
                ? 'Tự sát thành công -> Luân Hồi Chuyển Kiếp (Thân xác tự bạo giải thoát, kích hoạt vận mệnh kế thừa)' 
                : 'Tự sát thất bại -> Trở thành tù binh (Kẻ địch nhanh tay bế mạch cản trở, bắt sống làm tù binh)';
        } else if (mappedChoice === 'beg') {
            choiceText = 'Cầu Xin (Tha Cho Cái Mạng Chó)';
            resultText = outcome === 'released'
                ? 'Cầu xin thành công -> Được tha mạng (Kẻ địch khinh bỉ bỏ qua, tha cho mạng sống đầu hàng rơm rác)'
                : 'Cầu xin thất bại -> Trở thành tù binh (Kẻ địch khinh nhờn chế giễu, trói chặt lôi đi làm tù binh)';
        } else {
            choiceText = 'Cố Gắng Bỏ Chạy (Nhất Đao Đoạt Lộ)';
            resultText = outcome === 'escaped'
                ? 'Bỏ chạy thành công -> Trốn thoát (Thi triển huyết độn chi thuật, thành công tẩu thoát lách qua vòng vây)'
                : 'Bỏ chạy thất bại -> Trở thành tù binh (Kẻ địch đón đầu phi kích phế khí hải bắt sống tại chỗ)';
        }

        const playerName = knowledgeBase.worldConfig?.playerName || 'Người chơi';
        const summaryText = `${playerName} đã bị đánh bại. ${playerName} tuyển chọn biện pháp sinh tồn chi lộ: "${choiceText}". An bài số mệnh hạ sinh kết cục: "${resultText}".`;

        const finalStats = getMutableStats(playerEntity?.combatant) as PlayerStats;

        const payload: CombatEndPayload = {
            outcome: 'defeat',
            summary: summaryText,
            lastCombatTurns: state.current.combatLogs.slice(0, 20),
            finalPlayerState: finalStats,
            dispositions: {},
            opponentIds: knowledgeBase.pendingCombat?.opponentIds || [],
            storyContext: currentPageMessagesLog,
            specificDefeatOutcome: outcome
        };

        setTimeout(() => {
            restoreOriginalEnemySkills();
            handleCombatEndSpecificOutcome(outcome, payload);
        }, 3000);
    };

    const handleOpenLootBox = () => {
        if (lootBoxStatus !== 'closed') return;
        setLootBoxStatus('opening');
        
        // Simulate animation delay
        setTimeout(() => {
            const items: Item[] = [];
            const deadEnemiesCount = state.current.entities.filter(e => !e.isAlly && e.isDead && !e.isObstacle).length;
            
            // [THIÊN ĐẠO SYNC] Tính toán tiền thưởng dựa trên số kẻ địch bị hạ gục
            const genre = knowledgeBase.worldConfig?.genre || "Tu Tiên (Mặc định)";
            const isSciFi = genre.includes("Khoa Huyễn") || genre.includes("Đô Thị") || genre.includes("Võng Du");
            const currencyName = isSciFi ? "Credit" : "Linh Thạch";
            
            // Công thức: Cảnh giới * số lượng kẻ địch * (200-500)
            const playerRealm = knowledgeBase.playerStats.realm || 'Luyện Khí';
            const realmIndex = knowledgeBase.realmProgressionList.indexOf(playerRealm) || 1;
            const baseAmount = (realmIndex + 1) * 200;
            const randomBonus = Math.floor(Math.random() * 300);
            const totalCurrency = (baseAmount + randomBonus) * Math.max(1, deadEnemiesCount);

            if (totalCurrency > 0) {
                items.push({
                    id: `currency_${Date.now()}`,
                    name: `${formatNumberDot(totalCurrency)} ${currencyName}`,
                    type: 'Miscellaneous' as any,
                    category: 'Miscellaneous' as any,
                    description: `Số tiền thu được từ việc quét sạch ${deadEnemiesCount} kẻ địch.`,
                    quantity: totalCurrency,
                    rarity: 'Quý Báu' as any,
                    value: totalCurrency,
                    itemRealm: playerRealm
                } as any);
            }

            const count = Math.random() > 0.5 ? 2 : 1;
            
            const playerLevel = knowledgeBase.playerStats.level || 1;
            
            const rarityPool = ['Phổ Thông', 'Hiếm', 'Quý Báu', 'Cực Phẩm'];
            const typePool = ['Vũ khí', 'Áo', 'Mũ', 'Trang sức', 'Pháp bảo'];

            // Naming pools for internal generation (to get correct stats)
            const weaponNames = ['Kiếm', 'Đao', 'Thương', 'Cung', 'Trùy', 'Quạt', 'Sáo'];
            const bodyNames = ['Bào', 'Giáp', 'Y', 'Phục', 'Khải'];
            const headNames = ['Quan', 'Mão', 'Tiêu', 'Đỉnh', 'Khăn'];
            const accessoryNames = ['Bội', 'Nhẫn', 'Chuyền', 'Khuyên', 'Lắc'];
            const artifactNames = ['Châu', 'Đài', 'Tháp', 'Gương', 'Ấn', 'Bình', 'Chuông'];

            const rarityPrefixes: Record<string, string[]> = {
                'Phổ Thông': ['Thanh Đồng', 'Hắc Thiết', 'Mộc', 'Thô sơ'],
                'Hiếm': ['Linh Thạch', 'Bạch Ngân', 'Lam Ngọc', 'Tinh Anh'],
                'Quý Báu': ['Huyền Thiết', 'Hoàng Kim', 'Thiên Lam', 'Tử Tinh'],
                'Cực Phẩm': ['Thần Long', 'Cửu Thiên', 'Đế Vương', 'Thánh Quang']
            };
            
            for (let i = 0; i < count; i++) {
                const rarity = rarityPool[Math.floor(Math.random() * rarityPool.length)];
                const type = typePool[Math.floor(Math.random() * typePool.length)];
                
                let baseName = '';
                if (type === 'Vũ khí') baseName = weaponNames[Math.floor(Math.random() * weaponNames.length)];
                else if (type === 'Áo') baseName = bodyNames[Math.floor(Math.random() * bodyNames.length)];
                else if (type === 'Mũ') baseName = headNames[Math.floor(Math.random() * headNames.length)];
                else if (type === 'Trang sức') baseName = accessoryNames[Math.floor(Math.random() * accessoryNames.length)];
                else if (type === 'Pháp bảo') baseName = artifactNames[Math.floor(Math.random() * artifactNames.length)];
                else baseName = 'Bảo Vật';

                const prefixes = rarityPrefixes[rarity] || ['Bí Ẩn'];
                const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
                const finalName = `${prefix} ${baseName}`;
                
                const newItem = generateEquipment(finalName, playerLevel.toString(), rarity, type, [], playerRealm);
                
                // Add a hidden hint for the UI
                const hint = type === 'Vũ khí' ? "Một kiện Vũ khí tỏa ra sát khí lạnh lẽo" :
                             type === 'Pháp bảo' ? "Một món Pháp bảo mang theo linh lực dao động bất thường" :
                             `Một món ${type} dường như ẩn chứa sức mạnh thần bí`;

                items.push({
                    ...newItem,
                    id: `loot_${Date.now()}_${i}`,
                    description: `${newItem.description || ''}\n\n[Gợi ý]: ${hint}`
                } as any);
            }
            
            setLootBoxItems(items);
            setHasQuestPlaceholder(Math.random() < 0.5);
            setLootBoxStatus('opened');
        }, 1200);
    };

    useEffect(() => {
        // Prevent scrolling on mobile/web during combat
        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';
        
        return () => {
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
        };
    }, []);

    const hpPct = uiMaxHp > 0 ? Math.max(0, Math.min(100, (uiHp / uiMaxHp) * 100)) : 0;

    return (
        <div className="fixed inset-0 bg-gray-900 overflow-hidden select-none touch-none">
            <canvas 
                ref={canvasRef} 
                width={windowSize.width * (graphicsConfig.resolutionScale || 1.0)} 
                height={windowSize.height * (graphicsConfig.resolutionScale || 1.0)}
                className="block w-full h-full touch-none"
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerCancel={handleCanvasPointerUp}
            />

            {/* Lớp Canvas hiệu ứng tự do từ Prompt Studio */}
            <DynamicCanvasEffect screenName="combat" />

            {/* Top Right: Enemy List & Target Lock */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 max-h-[70%] pointer-events-auto z-20">
                <div className="bg-black/60 backdrop-blur-md border border-gray-700/50 rounded-lg p-3 w-44 shadow-2xl flex flex-col">
                    <h3 
                        className="text-gray-400 text-[10px] uppercase tracking-widest font-bold flex items-center justify-between cursor-pointer active:text-gray-200"
                        onPointerDown={(e) => { e.stopPropagation(); setIsEnemyListExpanded(!isEnemyListExpanded); }}
                    >
                        <div className="flex items-center gap-2">
                            <span>Danh Sách Địch</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        </div>
                        <span className="text-gray-500">{isEnemyListExpanded ? '▼' : '▶'}</span>
                    </h3>
                    {isEnemyListExpanded && (
                        <div className="flex flex-col gap-2 mt-3 overflow-y-auto scrollbar-hide">
                            {state.current.entities.filter(e => !e.isAlly && !e.isDead && !e.isObstacle && !e.isQueued).length === 0 ? (
                                <div className="text-gray-600 text-xs py-3 text-center italic">Đã diệt sạch...</div>
                            ) : (
                                state.current.entities.filter(e => !e.isAlly && !e.isDead && !e.isObstacle && !e.isQueued).map(e => (
                                    <button
                                        key={e.id}
                                        onPointerDown={(ev) => {
                                            ev.stopPropagation();
                                            const newLock = e.id === lockedTargetId ? null : e.id;
                                            setLockedTargetId(newLock);
                                            state.current.lockedTargetId = newLock;
                                        }}
                                        className={`group relative flex flex-col gap-1.5 p-2 rounded-md transition-all border text-left flex-shrink-0 ${
                                            lockedTargetId === e.id 
                                                ? 'bg-red-500/20 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.25)]' 
                                                : 'bg-gray-800/40 border-gray-700 hover:border-gray-500 hover:bg-gray-800/60'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2 overflow-hidden">
                                            <span className={`text-[10px] font-bold truncate ${lockedTargetId === e.id ? 'text-red-400' : 'text-gray-300'}`}>
                                                {e.combatant.name}
                                            </span>
                                            {lockedTargetId === e.id && (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-red-500 text-[8px] font-black animate-pulse">LOCKED</span>
                                                    <span className="text-red-500">🎯</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="w-full h-1 bg-gray-950 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full transition-all duration-300 ${lockedTargetId === e.id ? 'bg-red-500' : 'bg-red-500/60'}`}
                                                style={{ width: `${e.maxHp > 0 ? (e.hp / e.maxHp) * 100 : 0}%` }}
                                            />
                                        </div>
                                        {lockedTargetId === e.id && (
                                            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-red-500 rounded-full" />
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Top UI */}
            <div className="absolute top-4 left-0 w-full flex justify-between px-4 items-start pointer-events-none z-10">
                <Button variant="secondary" size="sm" onClick={() => { 
                    state.current.running = false; 
                    restoreOriginalEnemySkills();
                    onCombatEnd({ 
                        outcome: 'escaped', 
                        finalPlayerState: getMutableStats(state.current.entities.find(e => e.isPlayer)?.combatant) as PlayerStats, 
                        dispositions: {}, 
                        summary: 'Bạn đã tẩu thoát', 
                        opponentIds: knowledgeBase.pendingCombat?.opponentIds || [],
                        storyContext: currentPageMessagesLog
                    }); 
                }} className="pointer-events-auto bg-gray-800/80 hover:bg-gray-700 font-bold border-gray-600">
                    Tẩu
                </Button>
                <div className="bg-gray-800/80 px-6 py-2 rounded-full text-white font-bold flex gap-6 text-sm border border-gray-600 shadow-lg">
                    <span className="flex items-center gap-2">💀 {kills}</span>
                    <span className="flex items-center gap-2 text-red-400">☠️ {deaths}</span>
                </div>
                <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={() => { 
                        state.current.paused = !state.current.paused; 
                        setIsPaused(state.current.paused); 
                    }} 
                    className="pointer-events-auto bg-blue-900/80 hover:bg-blue-800 font-bold border-blue-600 uppercase tracking-widest px-8"
                >
                    {isPaused ? 'Tiếp' : 'Dừng'}
                </Button>
                <div className="w-16">
                    {/* Placeholder for symmetry or future logout */}
                </div>
            </div>

            {/* Bottom Bar: HP */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-72 text-center pointer-events-none z-10">
                <div className="flex justify-between items-end mb-1 px-1">
                    <div className="text-white text-[10px] font-bold bg-black/40 px-1.5 py-0.5 rounded border border-white/10 flex items-center gap-1">
                        ⚔️ <span className="text-orange-400">{formatNumberDot(Math.floor(knowledgeBase.playerStats.sucTanCong))}</span>
                    </div>
                    <div className="text-white text-sm font-bold tracking-wide drop-shadow-md">Thể lực {formatNumberDot(Math.floor(uiHp))}/{formatNumberDot(uiMaxHp)}</div>
                    <div className="text-white text-[10px] font-bold bg-black/40 px-1.5 py-0.5 rounded border border-white/10 flex items-center gap-1">
                        🛡️ <span className="text-blue-400">{formatNumberDot(Math.floor(knowledgeBase.playerStats.phongNgu || 0))}</span>
                    </div>
                </div>
                <div className="w-full bg-gray-800/80 h-4 rounded-sm border-2 border-gray-900 overflow-hidden shadow-lg p-0.5">
                    <div className="bg-gradient-to-b from-red-400 to-red-600 h-full transition-all duration-100 ease-linear rounded-sm" style={{ width: `${hpPct}%` }}></div>
                </div>
            </div>

            {/* Bottom Left: Joystick - Optimized for Mobile Corner */}
            <div 
                className="absolute bottom-6 left-6 w-32 h-32 bg-white/5 rounded-full border-2 border-white/10 flex items-center justify-center z-10 touch-none select-none backdrop-blur-[2px]"
                ref={joystickBaseRef}
                onPointerDown={handleTouchStart}
                onPointerMove={handleTouchMove}
                onPointerUp={handleTouchEnd}
                onPointerLeave={handleTouchEnd}
            >
                <div 
                    className="w-14 h-14 bg-white/30 rounded-full shadow-inner pointer-events-none transition-transform duration-75 border border-white/20"
                    style={{ transform: `translate(${stickPos.x}px, ${stickPos.y}px)` }}
                />
            </div>

            {/* Right Side: Tactical Ally Commands (Nút tròn nhỏ luân chuyển ⚔️ Tấn Công / 🚩 Phòng Thủ) */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-auto z-20 select-none">
                <button 
                    id="btn-combat-stance-toggle"
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        const nextStance = allyStance === 'attack' ? 'defense' : 'attack';
                        state.current.allyStance = nextStance;
                        setAllyStance(nextStance);
                        const p = state.current.entities.find(ent => ent.isPlayer);
                        if (p) {
                            if (nextStance === 'defense') {
                                spawnVfx("🚩 TẬP HỢP PHÒNG THỦ!", p.x, p.y - 60, '#38bdf8');
                            } else {
                                spawnVfx("⚔️ TỔNG LỰC TIẾN CÔNG!", p.x, p.y - 60, '#f59e0b');
                            }
                        }
                    }}
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all shadow-xl backdrop-blur-md cursor-pointer active:scale-90 ${
                        allyStance === 'attack'
                            ? 'bg-gradient-to-br from-amber-600/90 to-red-600/90 border-amber-400 text-amber-50 shadow-[0_0_16px_rgba(245,158,11,0.6)] ring-2 ring-amber-400/40'
                            : 'bg-gradient-to-br from-sky-600/90 to-blue-600/90 border-sky-400 text-sky-50 shadow-[0_0_16px_rgba(56,189,248,0.6)] ring-2 ring-sky-400/40'
                    }`}
                    title={allyStance === 'attack' ? "Đang TẤN CÔNG (Bấm để chuyển sang 🚩 Phòng thủ) [Phím X/Z]" : "Đang PHÒNG THỦ (Bấm để chuyển sang ⚔️ Tấn công) [Phím X/Z]"}
                >
                    <span className="text-2xl drop-shadow select-none">
                        {allyStance === 'attack' ? '⚔️' : '🚩'}
                    </span>
                </button>
            </div>

            {/* Bottom Right: Actions - Optimized for Mobile Thumb Reach */}
            <div className="absolute bottom-6 right-6 flex items-end gap-4 pointer-events-auto z-10 select-none">
                <div className="flex flex-col gap-4 mb-16">
                    <div className="relative">
                        <button 
                            className={`w-16 h-16 rounded-full bg-gray-900/40 text-gray-100 font-bold text-[9px] sm:text-[10px] border-2 shadow-lg transition-all relative overflow-hidden flex items-center justify-center text-center px-1 leading-tight backdrop-blur-[4px] ${skill1Cd > 0 || gcdUi > 0 ? 'border-gray-700 opacity-60' : 'border-yellow-600/50 active:bg-gray-700 active:scale-90 active:border-yellow-400'}`}
                            onPointerDown={(e) => { e.stopPropagation(); if (gcdUi <= 0) useSkill(1); }}
                            onContextMenu={(e) => { e.preventDefault(); setIsSkillSelectModalOpen({slot: 1}); }}
                        >
                            <span className="relative z-10 line-clamp-2 drop-shadow-md">{selectedSkill1 ? selectedSkill1.name : "Trống"}</span>
                            {skill1Cd > 0 && <div className="absolute bottom-0 left-0 w-full bg-black/60 pointer-events-none" style={{ height: `${(skill1Cd / 10000) * 100}%` }}></div>}
                            {skill1Cd > 0 && <div className="absolute inset-0 flex items-center justify-center font-bold text-white z-20 text-xs drop-shadow-md">{(skill1Cd/1000).toFixed(1)}</div>}
                            {gcdUi > 0 && skill1Cd <= 0 && <div className="absolute inset-0 bg-yellow-500/20 rounded-full flex items-center justify-center z-20"><div className="w-12 h-12 border-2 border-yellow-500/50 border-t-yellow-500 rounded-full animate-spin"></div></div>}
                        </button>
                        <div onClick={(e) => { e.stopPropagation(); setIsSkillSelectModalOpen({slot: 1}); }} onPointerDown={(e) => e.stopPropagation()} className="absolute -top-1 -right-1 bg-gray-800 rounded-full w-6 h-6 flex items-center justify-center border border-gray-600 text-[10px] cursor-pointer hover:bg-gray-700 shadow-md">🔄</div>
                    </div>
                    
                    <div className="relative">
                        <button 
                            className={`w-16 h-16 rounded-full bg-gray-900/40 text-gray-100 font-bold text-[9px] sm:text-[10px] border-2 shadow-lg transition-all relative overflow-hidden flex items-center justify-center text-center px-1 leading-tight backdrop-blur-[4px] ${skill2Cd > 0 || gcdUi > 0 ? 'border-gray-700 opacity-60' : 'border-blue-600/50 active:bg-gray-700 active:scale-90 active:border-blue-400'}`}
                            onPointerDown={(e) => { e.stopPropagation(); if (gcdUi <= 0) useSkill(2); }}
                            onContextMenu={(e) => { e.preventDefault(); setIsSkillSelectModalOpen({slot: 2}); }}
                        >
                            <span className="relative z-10 line-clamp-2 drop-shadow-md">{selectedSkill2 ? selectedSkill2.name : "Trống"}</span>
                            {skill2Cd > 0 && <div className="absolute bottom-0 left-0 w-full bg-black/60 pointer-events-none" style={{ height: `${(skill2Cd / 10000) * 100}%` }}></div>}
                            {skill2Cd > 0 && <div className="absolute inset-0 flex items-center justify-center font-bold text-white z-20 text-xs drop-shadow-md">{(skill2Cd/1000).toFixed(1)}</div>}
                            {gcdUi > 0 && skill2Cd <= 0 && <div className="absolute inset-0 bg-blue-500/20 rounded-full flex items-center justify-center z-20"><div className="w-12 h-12 border-2 border-blue-500/50 border-t-blue-500 rounded-full animate-spin"></div></div>}
                        </button>
                        <div onClick={(e) => { e.stopPropagation(); setIsSkillSelectModalOpen({slot: 2}); }} onPointerDown={(e) => e.stopPropagation()} className="absolute -top-1 -right-1 bg-gray-800 rounded-full w-6 h-6 flex items-center justify-center border border-gray-600 text-[10px] cursor-pointer hover:bg-gray-700 shadow-md">🔄</div>
                    </div>
                </div>
                
                <div className="flex flex-col gap-4">
                    <button 
                        className={`w-20 h-20 rounded-full bg-blue-900/40 text-white font-bold border-4 active:scale-90 active:bg-blue-800 transition-all shadow-xl flex items-center justify-center text-3xl relative overflow-hidden backdrop-blur-[4px] ${shieldCd > 0 ? 'opacity-50 border-gray-700' : 'border-blue-500/60'}`}
                        onPointerDown={(e) => { e.stopPropagation(); useShield(); }}
                    >
                        🛡️
                        {shieldCd > 0 && <div className="absolute bottom-0 left-0 w-full bg-black/60 pointer-events-none" style={{ height: `${(shieldCd / 2000) * 100}%` }}></div>}
                        {shieldCd > 0 && <div className="absolute inset-0 flex items-center justify-center font-bold text-white z-20 text-sm drop-shadow-md">{(shieldCd/1000).toFixed(1)}</div>}
                    </button>
                    
                    <button 
                        className={`w-28 h-28 rounded-full bg-gray-900/60 text-white font-bold border-4 active:scale-90 active:bg-gray-800 transition-all shadow-2xl flex items-center justify-center text-5xl backdrop-blur-[6px] ${attackCooldownUi ? 'opacity-40 pointer-events-none grayscale' : 'border-gray-600/80'}`}
                        onPointerDown={(e) => {
                            e.stopPropagation();
                            const p = state.current.entities.find(e => e.isPlayer);
                            if (p) {
                                p.attackCooldown = 0; // force basic attack immediately
                                setAttackCooldownUi(true);
                                setTimeout(() => setAttackCooldownUi(false), 500);
                            }
                        }}
                    >
                        🗡️
                    </button>
                </div>
            </div>

            {/* Victory Reward Modal */}
            {rewardModalData && (
                <Modal isOpen={true} onClose={() => {}} title="KHOẢNG KHẮC NGỘ ĐẠO - PHẦN THƯỞNG CHIẾN THẮNG">
                    <div className="p-4 space-y-4 max-w-sm mx-auto text-center">
                        <h3 className="text-2xl font-black text-yellow-500 uppercase tracking-tighter">BÚT PHÁ TIỀM NĂNG!</h3>
                        <p className="text-xs text-gray-300 leading-relaxed italic">
                            Cảm nhận được luồng khí tức mạnh mẽ từ kẻ thù ngã xuống, linh căn của bạn bất ngờ rung động. Hãy chọn 1 phần thưởng để dung hợp vĩnh viễn:
                        </p>
                        
                        <div className="flex flex-col gap-3 mt-4">
                            {rewardModalData.options.map((opt) => (
                                <button 
                                    key={opt.id}
                                    onClick={() => handleSelectReward(opt.id)}
                                    className="w-full p-4 bg-gray-900/60 border-2 border-yellow-700/50 hover:bg-yellow-900/40 hover:border-yellow-500 rounded-xl transition-all group shadow-lg hover:shadow-yellow-500/20"
                                >
                                    <div className="text-yellow-400 font-black text-sm uppercase group-hover:scale-110 transition-transform mb-1 flex items-center justify-center gap-2">
                                        ✨ {opt.label} ✨
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-medium group-hover:text-gray-200">{opt.desc}</div>
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2">* Các phần thưởng này sẽ tồn tại vĩnh viễn và có thể cộng dồn.</p>
                    </div>
                </Modal>
            )}

            {/* Disposition Modal */}
            {isDispositionModalOpen && !rewardModalData && (
                <Modal isOpen={isDispositionModalOpen} onClose={() => handleDispositionRefConfirm(dispositions)} title="KẾT QUẢ TRẬN ĐẤU - CHIẾN THẮNG">
                    <div className="p-4 space-y-4 text-center max-h-[75vh] overflow-y-auto">
                        <h3 className="text-2xl font-bold text-green-400">CHIẾN THẮNG!</h3>
                        
                        {/* Loot Box Section */}
                        <div className="bg-gray-900/40 p-4 rounded-xl border border-gray-700/50 shadow-inner my-4">
                            <h4 className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.2em] mb-4 text-center">Phần Thưởng Chiến Thắng</h4>
                            
                            <div className="flex flex-col items-center justify-center min-h-[160px]">
                                <AnimatePresence mode="wait">
                                    {lootBoxStatus === 'closed' && (
                                        <motion.div 
                                            key="closed"
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 1.2, opacity: 0 }}
                                            className="flex flex-col items-center gap-4 cursor-pointer group"
                                            onClick={handleOpenLootBox}
                                        >
                                            <motion.div 
                                                animate={{ 
                                                    rotate: [0, -5, 5, -5, 5, 0],
                                                    scale: [1, 1.05, 1, 1.05, 1]
                                                }}
                                                transition={{ 
                                                    duration: 2, 
                                                    repeat: Infinity,
                                                    ease: "easeInOut" 
                                                }}
                                                className="text-7xl drop-shadow-[0_0_15px_rgba(234,179,8,0.4)] group-hover:drop-shadow-[0_0_25px_rgba(234,179,8,0.7)] transition-all"
                                            >
                                                🎁
                                            </motion.div>
                                            <div className="text-xs font-bold text-yellow-200 animate-pulse uppercase tracking-widest bg-yellow-950/30 px-4 py-1 rounded-full border border-yellow-500/20">
                                                Chạm để mở quà
                                            </div>
                                        </motion.div>
                                    )}

                                    {lootBoxStatus === 'opening' && (
                                        <motion.div 
                                            key="opening"
                                            initial={{ scale: 1 }}
                                            animate={{ 
                                                scale: [1, 1.5, 0],
                                                rotate: [0, 10, -10, 10, -10, 0],
                                                filter: ["brightness(1)", "brightness(3)", "brightness(5)"]
                                            }}
                                            className="text-8xl"
                                        >
                                            ✨
                                        </motion.div>
                                    )}

                                    {lootBoxStatus === 'opened' && (
                                        <motion.div 
                                            key="opened"
                                            initial={{ y: 20, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            className="w-full space-y-3"
                                        >
                                            <div className="flex flex-col gap-2">
                                                {lootBoxItems.map((item, i) => {
                                                    const hintMatch = item.description?.match(/\[Gợi ý\]: (.*)$/);
                                                    const hint = hintMatch ? hintMatch[1] : "Một món đồ ẩn chứa linh khí thần bí";

                                                    return (
                                                        <motion.div 
                                                            key={item.id}
                                                            initial={{ x: -20, opacity: 0 }}
                                                            animate={{ x: 0, opacity: 1 }}
                                                            transition={{ delay: i * 0.2 }}
                                                            className="flex flex-col bg-gray-800/80 border border-gray-600 rounded-lg p-3 hover:border-yellow-500/50 transition-colors text-left"
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-xl">⚔️</span>
                                                                    <button 
                                                                        onClick={() => setInspectingItem(item)}
                                                                        className="text-sm font-black text-white hover:text-yellow-400 tracking-wider transition-colors"
                                                                    >
                                                                        [ VẬT PHẨM BÍ ẨN ]
                                                                    </button>
                                                                </div>
                                                                <div className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                                                                    item.rarity?.includes('Thần Thoại') ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                                                                    item.rarity?.includes('Cực Phẩm') ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                                                    item.rarity?.includes('Quý Báu') ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                                    'bg-gray-700/50 text-gray-400 border border-gray-600/30'
                                                                }`}>
                                                                    {item.rarity}
                                                                </div>
                                                            </div>
                                                            <div className="text-[10px] text-gray-400 italic mt-1 ml-8">
                                                                ({hint})
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                                
                                                {hasQuestPlaceholder && (
                                                    <motion.div 
                                                        initial={{ scale: 0.9, opacity: 0 }}
                                                        animate={{ scale: 1, opacity: 1 }}
                                                        transition={{ delay: 0.5 }}
                                                        className="flex flex-col bg-indigo-950/30 border border-indigo-500/30 rounded-lg p-3 text-left"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xl">📜</span>
                                                            <div className="text-sm font-bold text-indigo-300">
                                                                ?? Vật phẩm nhiệm vụ ??
                                                            </div>
                                                        </div>
                                                        <div className="text-[10px] text-indigo-400/70 italic mt-1 ml-8">
                                                            (Cơ duyên liên quan đến hành trình hiện tại)
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-gray-500 italic mt-2 animate-bounce">Bạn đã thu nhận tất cả vật phẩm!</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        <p className="text-xs text-gray-300">Đối thủ đã bị gục ngã. Hãy quyết định số phận của từng kẻ bại trận:</p>
                        
                        <div className="space-y-3 text-left mt-2">
                            {defeatedList.filter(e => (e as any).isObstacle !== true && (e as any).isSummoned !== true).map((entity, idx) => {
                                const entityId = entity.id || `enemy_${idx}`;
                                const currentDisposition = dispositions[entityId] || 'release';
                                
                                return (
                                    <div key={entityId} className="bg-gray-800 p-3 rounded-lg border border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                                        <div className="font-semibold text-white text-sm">
                                            {entity.name}
                                        </div>
                                        <div className="flex gap-1.5 flex-wrap">
                                            <button 
                                                onClick={() => setDispositions(prev => ({ ...prev, [entityId]: 'kill' }))}
                                                className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${currentDisposition === 'kill' ? 'bg-red-600 text-white shadow-md' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                                            >
                                                ☠️ Kết Liễu
                                            </button>
                                            <button 
                                                onClick={() => setDispositions(prev => ({ ...prev, [entityId]: 'capture' }))}
                                                className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${currentDisposition === 'capture' ? 'bg-yellow-600 text-white shadow-md' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                                            >
                                                🕸️ Bắt Giữ
                                            </button>
                                            <button 
                                                onClick={() => setDispositions(prev => ({ ...prev, [entityId]: 'release' }))}
                                                className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${currentDisposition === 'release' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                                            >
                                                🕊️ Thả Đi
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        {(() => {
                            const allies = state.current.entities.filter(ent => ent.isAlly);
                            const mvp = allies.reduce((prev, current) => {
                                const currentKills = current.killCount || 0;
                                const prevKills = prev.killCount || 0;
                                if (currentKills > prevKills) return current;
                                if (currentKills === prevKills) {
                                    return (current.totalDamageDealt || 0) > (prev.totalDamageDealt || 0) ? current : prev;
                                }
                                return prev;
                            }, allies[0]);

                            if (!mvp) return null;

                            return (
                                <motion.div 
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="bg-gradient-to-r from-yellow-900/40 via-yellow-600/20 to-yellow-900/40 p-4 rounded-xl border border-yellow-500/30 shadow-lg mt-6"
                                >
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <span className="text-xl">🏆</span>
                                        <h4 className="text-xs font-black text-yellow-400 uppercase tracking-[0.3em]">Nhân Vật MVP Của Trận Đấu</h4>
                                        <span className="text-xl">🏆</span>
                                    </div>
                                    <div className="flex items-center justify-between px-4">
                                        <div className="text-left">
                                            <div className="text-sm font-bold text-white uppercase">{mvp.combatant.name}</div>
                                            <div className="text-[10px] text-yellow-500/70">Kẻ chinh phục dũng mãnh nhất</div>
                                        </div>
                                        <div className="flex gap-4 text-right">
                                            <div>
                                                <div className="text-[10px] text-gray-400 uppercase">Kills</div>
                                                <div className="text-sm font-black text-white">{mvp.killCount || 0}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-gray-400 uppercase">Sát thương</div>
                                                <div className="text-sm font-black text-white">{formatNumberDot(Math.floor(mvp.totalDamageDealt || 0))}</div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })()}

                        <Button variant="primary" className="w-full mt-4 bg-blue-600 hover:bg-blue-500 font-bold uppercase tracking-wider text-xs py-3" onClick={() => handleDispositionRefConfirm(dispositions)}>
                            Xác nhận & Tiếp Tục
                        </Button>
                    </div>
                </Modal>
            )}

            {/* Defeat Choice Modal */}
            {isDefeatModalOpen && (
                <Modal isOpen={isDefeatModalOpen} onClose={() => {}} title="KẾT QUẢ TRẬN ĐẤU - CHIẾN BẠI">
                    <div className="p-4 space-y-4 text-center max-w-sm mx-auto">
                        <h3 className="text-3xl font-extrabold text-red-500 animate-pulse uppercase tracking-wider">CHIẾN BẠI!</h3>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            Thân thể rã rời, linh lực cạn kiệt. Bạn đã bị đánh bại bởi thế lực thù địch! Hãy chọn con đường tiếp theo của bản thân:
                        </p>
                        
                        <div className="flex flex-col gap-3 mt-4">
                            <button 
                                onClick={() => handleDefeatChoice('suicide')}
                                className="w-full py-3 bg-red-950/80 border-2 border-red-700 hover:bg-red-900 text-red-150 font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-red-900/40 text-sm"
                            >
                                ⚔️ Tự Sát (Bảo Toàn Khí Tiết)
                            </button>
                            <button 
                                onClick={() => handleDefeatChoice('beg')}
                                className="w-full py-3 bg-yellow-950/80 border-2 border-yellow-700 hover:bg-yellow-900 text-yellow-100 font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-yellow-900/40 text-sm"
                            >
                                🙇 Cầu Xin (Tha Cho Cái Mạng Chó)
                            </button>
                            <button 
                                onClick={() => handleDefeatChoice('flee')}
                                className="w-full py-3 bg-blue-950/80 border-2 border-blue-700 hover:bg-blue-900 text-blue-100 font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-blue-900/40 text-sm"
                            >
                                🏃 Cố Gắng Bỏ Chạy (Nhất Đao Đoạt Lộ)
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Skill Select Modal */}
            {isSkillSelectModalOpen && (
                <Modal isOpen={true} onClose={() => setIsSkillSelectModalOpen(null)} title={`Chọn kỹ năng cho ô ${isSkillSelectModalOpen.slot}`}>
                    <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                        {availableSkills.map((skill, idx) => (
                            <button 
                                key={idx} 
                                className="w-full p-3 bg-gray-800 border border-gray-600 rounded-md text-left hover:bg-gray-700 flex justify-between items-start gap-2"
                                onClick={() => {
                                    if (isSkillSelectModalOpen.slot === 1) setSelectedSkill1(skill);
                                    else setSelectedSkill2(skill);
                                    setIsSkillSelectModalOpen(null);
                                }}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-white text-sm break-words whitespace-normal">{skill.name}</div>
                                    <div className="text-xs text-gray-400 break-words whitespace-normal leading-relaxed mt-1">{getSkillDescriptionWithCore(skill)}</div>
                                </div>
                                <div className="text-xs text-gray-400 whitespace-nowrap ml-2 bg-gray-900 px-2 py-1 rounded flex-shrink-0">Hồi: {getSkillCooldownSeconds(skill)}s</div>
                            </button>
                        ))}
                    </div>
                </Modal>
            )}

            {/* Character List Modal (Visible when Paused) */}
            {isPaused && !inspectingEntity && (
                <Modal isOpen={true} onClose={() => { state.current.paused = false; setIsPaused(false); }} title="Sơ đồ chiến đấu">
                    <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-sm font-bold text-blue-400 uppercase tracking-tighter">
                                    Phe ta ({state.current.entities.filter(e => e.isAlly && !e.isDead && !e.isObstacle && !e.isQueued && !e.isRetreatingToReserve && !e.isSummoned).length})
                                    {state.current.entities.filter(e => e.isAlly && !e.isDead && e.isQueued && !e.isSummoned).length > 0 && (
                                        <span className="text-xs text-gray-500 lowercase font-normal ml-1"> (+{state.current.entities.filter(e => e.isAlly && !e.isDead && e.isQueued && !e.isSummoned).length} dự bị)</span>
                                    )}
                                </h4>
                                {selectedSwapAllyId && (
                                    <button 
                                        onClick={() => setSelectedSwapAllyId(null)}
                                        className="text-[10px] bg-gray-800 hover:bg-gray-700 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40"
                                    >
                                        ✕ Hủy chọn đổi
                                    </button>
                                )}
                            </div>
                            {selectedSwapAllyId && (
                                <div className="text-[11px] bg-amber-950/40 border border-amber-500/50 text-amber-200 px-2.5 py-1 rounded mb-2 animate-pulse flex items-center justify-between">
                                    <span>💡 Bấm nút <b>"⚔️ Đổi vào"</b> ở NPC dự bị để hoán đổi vị trí!</span>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                                {state.current.entities.filter(e => e.isAlly && !e.isObstacle && !e.isSummoned).map(e => {
                                    const allies = state.current.entities.filter(ent => ent.isAlly && !ent.isObstacle && !ent.isSummoned);
                                    const maxKills = Math.max(...allies.map(a => a.killCount || 0));
                                    const maxDamage = Math.max(...allies.map(a => a.totalDamageDealt || 0));
                                    const isSlayer = maxKills > 0 && e.killCount === maxKills;
                                    const isMvp = maxDamage > 0 && e.totalDamageDealt === maxDamage;
                                    const isSelectedForSwap = selectedSwapAllyId === e.id;
                                    const canSwapOut = !e.isPlayer && !e.isDead && !e.isQueued && !e.isRetreatingToReserve;
                                    const canSwapIn = e.isQueued && !e.isDead;

                                    return (
                                        <div 
                                            key={e.id}
                                            onClick={() => setInspectingEntity(e)}
                                            className={`p-3 rounded border text-left flex items-center justify-between transition-all cursor-pointer relative ${
                                                e.isDead 
                                                    ? 'opacity-40 border-gray-800 bg-gray-900' 
                                                    : e.isRetreatingToReserve
                                                        ? 'border-amber-500/60 bg-amber-950/20 text-amber-300 animate-pulse'
                                                        : isSelectedForSwap
                                                            ? 'border-amber-400 bg-amber-950/40 ring-1 ring-amber-400'
                                                            : e.isQueued
                                                                ? 'border-gray-700/60 bg-gray-800/10 hover:bg-gray-800/25 border-dashed text-gray-400'
                                                                : 'border-blue-600/50 bg-blue-900/20 hover:bg-blue-800/40'
                                            }`}
                                        >
                                            <div className="flex-1 min-w-0 pr-1">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <div className="font-bold text-white text-xs truncate">{e.combatant.name} {e.isPlayer ? '(Bạn)' : ''}</div>
                                                    {isSlayer && <span className="text-[7px] bg-red-600 text-white px-1 py-0.5 rounded font-black tracking-tighter shadow-sm animate-pulse whitespace-nowrap">🔥 SLAYER</span>}
                                                    {isMvp && <span className="text-[7px] bg-yellow-500 text-black px-1 py-0.5 rounded font-black tracking-tighter shadow-sm whitespace-nowrap">⭐ MVP</span>}
                                                </div>
                                                <div className="text-[10px] text-gray-400 flex items-center gap-1.5 flex-wrap">
                                                    {e.isRetreatingToReserve ? (
                                                        <span className="text-amber-400 font-semibold">ĐANG RÚT LUI...</span>
                                                    ) : e.isQueued ? (
                                                        <span>DỰ BỊ</span>
                                                    ) : (
                                                        <span>{e.hp > 0 ? `HP: ${Math.floor(e.hp)}` : 'GỤC NGÃ'}</span>
                                                    )}
                                                    {(!e.isDead && !e.isQueued && !e.isRetreatingToReserve) && (
                                                        <span className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-tighter ${e.attackType === 'ranged' ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40' : 'bg-orange-500/30 text-orange-300 border border-orange-500/40'}`}>
                                                            {e.attackType === 'ranged' ? 'Tầm xa' : 'Cận chiến'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                <div className="text-lg">{e.isPlayer ? '👤' : (e.isQueued ? '⏳' : '🛡️')}</div>
                                                {canSwapOut && (
                                                    <button
                                                        type="button"
                                                        onClick={(evt) => {
                                                            evt.stopPropagation();
                                                            if (isSelectedForSwap) {
                                                                setSelectedSwapAllyId(null);
                                                            } else {
                                                                setSelectedSwapAllyId(e.id);
                                                            }
                                                        }}
                                                        className={`text-[9px] px-2 py-0.5 rounded font-bold border transition-all ${
                                                            isSelectedForSwap
                                                                ? 'bg-amber-500 text-black border-amber-300'
                                                                : 'bg-indigo-950/80 hover:bg-indigo-800 text-indigo-200 border-indigo-500/50'
                                                        }`}
                                                        title="Chọn NPC này để lùi về dự bị"
                                                    >
                                                        {isSelectedForSwap ? '✓ Đang chọn' : '🔄 Đổi ra'}
                                                    </button>
                                                )}
                                                {canSwapIn && (
                                                    <button
                                                        type="button"
                                                        onClick={(evt) => {
                                                            evt.stopPropagation();
                                                            let activeOutId = selectedSwapAllyId;
                                                            if (!activeOutId) {
                                                                // Tự động tìm đồng minh đang chiến đấu (không phải người chơi) có HP thấp nhất để đổi ra
                                                                const activeAllies = state.current.entities.filter(ent => ent.isAlly && !ent.isPlayer && !ent.isDead && !ent.isObstacle && !ent.isQueued && !ent.isRetreatingToReserve);
                                                                if (activeAllies.length > 0) {
                                                                    activeAllies.sort((a, b) => a.hp - b.hp);
                                                                    activeOutId = activeAllies[0].id;
                                                                }
                                                            }
                                                            if (activeOutId) {
                                                                const success = performAllySwap(state.current, activeOutId, e.id, spawnVfx);
                                                                if (success) {
                                                                    state.current.paused = false;
                                                                    setIsPaused(false);
                                                                    setSelectedSwapAllyId(null);
                                                                }
                                                            } else {
                                                                // Nếu không có đồng minh nào để đổi ra (hoặc số lượng active < maxLimit), trực tiếp cho dự bị vào sân
                                                                e.isQueued = false;
                                                                e.isEnteringBattle = true;
                                                                e.x = 20;
                                                                e.y = (state.current.height || 1080) / 2;
                                                                spawnVfx("XUẤT TRẬN!", e.x + 30, e.y - 20, '#3b82f6');
                                                                state.current.paused = false;
                                                                setIsPaused(false);
                                                            }
                                                        }}
                                                        className="text-[9px] px-2 py-0.5 rounded font-bold border bg-emerald-950/80 hover:bg-emerald-800 text-emerald-200 border-emerald-500/50 transition-all"
                                                        title="Đưa NPC dự bị này vào sân tham chiến"
                                                    >
                                                        ⚔️ Đổi vào
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>


                        <div>
                            <h4 className="text-sm font-bold text-red-400 mb-2 uppercase tracking-tighter">
                                Kẻ địch ({state.current.entities.filter(e => !e.isAlly && !e.isDead && !e.isObstacle && !e.isQueued && !e.isSummoned).length})
                                {state.current.entities.filter(e => !e.isAlly && !e.isDead && e.isQueued && !e.isSummoned).length > 0 && (
                                    <span className="text-xs text-gray-500 lowercase font-normal ml-1"> (+{state.current.entities.filter(e => !e.isAlly && !e.isDead && e.isQueued && !e.isSummoned).length} dự bị)</span>
                                )}
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                {state.current.entities.filter(e => !e.isAlly && !e.isObstacle && !e.isSummoned).map(e => (
                                    <button 
                                        key={e.id}
                                        onClick={() => setInspectingEntity(e)}
                                        className={`p-3 rounded border text-left flex items-center justify-between transition-all ${
                                            e.isDead 
                                                ? 'opacity-40 border-gray-800 bg-gray-900' 
                                                : e.isQueued
                                                    ? 'border-gray-700/60 bg-gray-800/10 hover:bg-gray-800/25 border-dashed text-gray-400'
                                                    : 'border-red-600/50 bg-red-900/20 hover:bg-red-800/40'
                                        }`}
                                    >
                                        <div>
                                            <div className="font-bold text-white text-xs text-wrap">{e.combatant.name}</div>
                                            <div className="text-[10px] text-gray-400 flex items-center gap-2">
                                                {e.isQueued ? 'DỰ BỊ' : (e.hp > 0 ? `HP: ${Math.floor(e.hp)}` : 'HẠ GỤC')}
                                                {(!e.isDead && !e.isQueued) && (
                                                    <span className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-tighter ${e.attackType === 'ranged' ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40' : 'bg-orange-500/30 text-orange-300 border border-orange-500/40'}`}>
                                                        {e.attackType === 'ranged' ? 'Tầm xa' : 'Cận chiến'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-xl">{e.isQueued ? '⏳' : '👺'}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="border-t border-gray-700 pt-4 mt-6">
                            <h4 className="text-sm font-bold text-green-400 mb-4 uppercase tracking-tighter">Thiết Lập Nhân Vật (Bạn)</h4>
                            <div className="flex items-center justify-between bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                <span className="text-xs font-medium text-gray-300">Loại tấn công</span>
                                <div className="flex bg-gray-900 rounded-lg p-1">
                                    <button 
                                        className={`px-3 py-1 text-xs rounded-md transition-colors ${state.current.entities.find(e => e.isPlayer)?.attackType !== 'ranged' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                        onClick={() => {
                                            const p = state.current.entities.find(e => e.isPlayer);
                                            if (p) p.attackType = 'melee';
                                            // Force re-render if needed, but state.current is ref. We can trigger a dummy state update.
                                            setForceRender(r => r + 1);
                                        }}
                                    >
                                        Cận chiến
                                    </button>
                                    <button 
                                        className={`px-3 py-1 text-xs rounded-md transition-colors ${state.current.entities.find(e => e.isPlayer)?.attackType === 'ranged' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                        onClick={() => {
                                            const p = state.current.entities.find(e => e.isPlayer);
                                            if (p) p.attackType = 'ranged';
                                            setForceRender(r => r + 1);
                                        }}
                                    >
                                        Tầm xa
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-700 pt-4 mt-6">
                            <h4 className="text-sm font-bold text-indigo-400 mb-4 uppercase tracking-tighter">Thiết Lập Đồ Hoạ Chiến Đấu</h4>
                            <div className="space-y-4">
                                <div className="flex flex-col gap-2">
                                  <label className="text-xs font-medium text-gray-300">Độ phân giải render (Mờ / Nét)</label>
                                  <div className="flex items-center gap-4">
                                      <span className="text-[10px] text-gray-400">Giảm (Mờ)</span>
                                      <input
                                          type="range"
                                          name="resolutionScale"
                                          min="0.1"
                                          max="2.0"
                                          step="0.1"
                                          value={graphicsConfig.resolutionScale}
                                          onChange={handleGraphicsConfigChange}
                                          className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                      />
                                      <span className="text-[10px] text-gray-400">Tăng (Nét)</span>
                                  </div>
                                  <div className="text-right text-[10px] text-indigo-400">{graphicsConfig.resolutionScale.toFixed(1)}x</div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="modalEnableVfx"
                                        name="enableVfx"
                                        checked={graphicsConfig.enableVfx}
                                        onChange={handleGraphicsConfigChange}
                                        className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 focus:ring-2"
                                    />
                                    <label htmlFor="modalEnableVfx" className="text-xs font-medium text-gray-300">Bật hiệu ứng hình ảnh (VFX)</label>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="modalEnableDamageNumbers"
                                        name="enableDamageNumbers"
                                        checked={graphicsConfig.enableDamageNumbers}
                                        onChange={handleGraphicsConfigChange}
                                        className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 focus:ring-2"
                                    />
                                    <label htmlFor="modalEnableDamageNumbers" className="text-xs font-medium text-gray-300">Hiển thị sát thương (Damage Numbers)</label>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-medium text-gray-300">Số lượng tối đa mỗi phe</label>
                                    <div className="flex items-center gap-4">
                                        <span className="text-[10px] text-gray-400">3</span>
                                        <input
                                            type="range"
                                            name="maxUnitsPerSide"
                                            min="3"
                                            max="6"
                                            step="1"
                                            value={graphicsConfig.maxUnitsPerSide || 4}
                                            onChange={handleGraphicsConfigChange}
                                            className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                        />
                                        <span className="text-[10px] text-gray-400">6</span>
                                    </div>
                                    <div className="text-right text-[10px] text-indigo-400">{graphicsConfig.maxUnitsPerSide || 4}</div>
                                </div>
                            </div>
                        </div>

                        <Button 
                            variant="primary" 
                            className="w-full mt-4" 
                            onClick={() => { state.current.paused = false; setIsPaused(false); }}
                        >
                            Tiếp tục chiến đấu
                        </Button>
                    </div>
                </Modal>
            )}

            {/* Character Detail Modal */}
            {inspectingEntity && (
                <Modal isOpen={true} onClose={() => setInspectingEntity(null)} title={`Thông tin: ${inspectingEntity.combatant.name}`}>
                    <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
                        {/* Stats Section */}
                        {(() => {
                            const combatant = inspectingEntity.combatant as any;
                            const stats = getMutableStats(combatant) || combatant.stats || {};
                            const equipped = inspectingEntity.isPlayer 
                                ? knowledgeBase.equippedItems 
                                : (combatant.equippedItems || (combatant.stats && combatant.stats.equippedItems));
                            const inventory = inspectingEntity.isPlayer 
                                ? (knowledgeBase.inventory || [])
                                : (combatant.inventory || (combatant.stats && combatant.stats.inventory) || []);
                            
                            const hpExplanation = getHpFormulaExplanation(stats as PlayerStats, equipped, inventory, knowledgeBase);

                            return (
                                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                                    <h4 className="text-xs font-bold text-yellow-500 mb-2 uppercase">Chỉ số chiến đấu</h4>
                                    <div className="grid grid-cols-2 gap-y-2 text-xs">
                                        <div className="text-gray-400">Đại cảnh:</div> 
                                        <div className="text-white font-semibold">{combatant.realm || "Không rõ"}</div>
                                        
                                        <div className="text-gray-400">Sinh lực:</div> 
                                        <div className="text-white font-mono text-red-400 font-bold">
                                            <div>{formatNumberDot(Math.floor(inspectingEntity.hp))} / {formatNumberDot(inspectingEntity.maxHp)}</div>
                                            <div className="text-[10px] text-gray-300 font-normal mt-1 font-sans">
                                                <span className="text-red-300 font-bold font-mono">Công thức:</span> {formatNumberDot(hpExplanation.formulaText)}
                                            </div>
                                            <div className="text-[9px] text-gray-400 font-normal mt-0.5 leading-snug font-sans italic">
                                                {formatNumberDot(hpExplanation.breakdownText)}
                                            </div>
                                        </div>
                                        
                                        <div className="text-gray-400">Sát thương:</div> 
                                        <div className="text-orange-400 font-bold">
                                            {formatNumberDot(combatant.sucTanCong || combatant.stats?.sucTanCong || 0)}
                                        </div>
                                        
                                        <div className="text-gray-400">Phòng ngự:</div> 
                                        <div className="text-blue-400 font-bold">
                                            {formatNumberDot(combatant.phongNgu || combatant.stats?.phongNgu || 0)}
                                        </div>

                                         {(inspectingEntity.isAlly || inspectingEntity.isPlayer) && (
                                             <>
                                                 <div className="text-gray-400">Vai trò:</div>
                                                 <div className="flex bg-gray-900 rounded-lg p-0.5 scale-90 origin-left">
                                                     <button 
                                                         className={`px-3 py-1 text-[10px] rounded-md transition-colors ${inspectingEntity.attackType !== 'ranged' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                                         onClick={() => {
                                                             inspectingEntity.attackType = 'melee';
                                                             setForceRender(r => r + 1);
                                                         }}
                                                     >
                                                         Cận chiến
                                                     </button>
                                                     <button 
                                                         className={`px-3 py-1 text-[10px] rounded-md transition-colors ${inspectingEntity.attackType === 'ranged' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                                         onClick={() => {
                                                             inspectingEntity.attackType = 'ranged';
                                                             setForceRender(r => r + 1);
                                                         }}
                                                     >
                                                         Tầm xa
                                                     </button>
                                                 </div>
                                             </>
                                         )}

                                        {!combatant.isPlayer && combatant.tuChat && (
                                            <>
                                                <div className="text-gray-400">Tư chất:</div>
                                                <div className="text-purple-400 font-bold">{combatant.tuChat}</div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Equipment */}
                        {(() => {
                            const combatant = inspectingEntity.combatant as any;
                            // For player, equipment is in knowledgeBase root
                            const equipped = inspectingEntity.isPlayer 
                                ? knowledgeBase.equippedItems 
                                : (combatant.equippedItems || (combatant.stats && combatant.stats.equippedItems));
                            
                            if (!equipped) return null;
                            
                            // Map to items
                            const inv = inspectingEntity.isPlayer 
                                ? (knowledgeBase.inventory || [])
                                : (combatant.inventory || (combatant.stats && combatant.stats.inventory) || []);
                                
                            const items = Object.entries(equipped)
                                .map(([slot, itemId]) => {
                                    if (!itemId) return null;
                                    const item = inv.find((i: any) => i.id === itemId);
                                    return { slot, item };
                                })
                                .filter(e => e && e.item) as { slot: string, item: Item }[];

                            if (items.length === 0) return null;

                            return (
                                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                                    <h4 className="text-xs font-bold text-blue-400 mb-2 uppercase">Trang bị hiện có</h4>
                                    <div className="grid grid-cols-1 gap-1">
                                        {items.map(({ slot, item }) => (
                                            <button 
                                                key={slot} 
                                                className="text-[11px] text-gray-300 flex items-center justify-between gap-2 bg-black/20 p-2 rounded hover:bg-gray-700/50 transition-colors border border-transparent hover:border-gray-500"
                                                onClick={() => setInspectingItem(item)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-blue-500">◆</span>
                                                    <span>{item.name}</span>
                                                </div>
                                                <div className="text-[10px] text-gray-500 uppercase">{slot}</div>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[9px] text-gray-500 mt-2 italic text-center">* Nhấn vào trang bị để xem chi tiết</p>
                                </div>
                            );
                        })()}

                        {/* Skills */}
                        {(((inspectingEntity.combatant as any).playerSkills || (inspectingEntity.combatant as any).skills) && 
                          ((inspectingEntity.combatant as any).playerSkills || (inspectingEntity.combatant as any).skills).length > 0) && (
                            <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                                <h4 className="text-xs font-bold text-green-400 mb-2 uppercase">Kỹ năng kịch hoạt</h4>
                                <div className="space-y-2">
                                    {((inspectingEntity.combatant as any).playerSkills || (inspectingEntity.combatant as any).skills).map((s: Skill, i: number) => (
                                        <div key={i} className="text-[10px] bg-black/30 p-2 rounded">
                                            <div className="text-white font-bold mb-0.5 break-words whitespace-normal">{s.name}</div>
                                            <div className="text-gray-400 italic break-words whitespace-normal leading-relaxed">{getSkillDescriptionWithCore(s)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <Button variant="secondary" className="w-full" onClick={() => setInspectingEntity(null)}>Quay lại</Button>
                    </div>
                </Modal>
            )}
            {/* Item Detail Modal */}
            {inspectingItem && (
                <Modal isOpen={true} onClose={() => setInspectingItem(null)} title={inspectingItem.name}>
                    <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                        <div className="bg-gray-900/60 p-4 rounded-lg border border-gray-700">
                            <p className="text-sm italic text-gray-300 mb-4">{inspectingItem.description}</p>
                            
                            <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                                <div className="text-gray-500 uppercase">Phẩm phẩm:</div>
                                <div className={`font-bold ${
                                    inspectingItem.rarity?.includes('Thần Thoại') ? 'text-orange-400' :
                                    inspectingItem.rarity?.includes('Cực Phẩm') ? 'text-purple-400' :
                                    inspectingItem.rarity?.includes('Quý Báu') ? 'text-blue-400' :
                                    inspectingItem.rarity?.includes('Hiếm') ? 'text-green-400' : 'text-gray-300'
                                }`}>{inspectingItem.rarity}</div>
                                
                                <div className="text-gray-500 uppercase">Loại:</div>
                                <div className="text-white">{inspectingItem.category === 'Equipment' ? 'Trang bị' : inspectingItem.category}</div>
                                
                                {inspectingItem.itemRealm && (
                                    <>
                                        <div className="text-gray-500 uppercase">Cảnh giới:</div>
                                        <div className="text-white">{inspectingItem.itemRealm}</div>
                                    </>
                                )}
                            </div>

                            {inspectingItem.category === 'Equipment' && (
                                <div className="space-y-3 pt-3 border-t border-gray-700">
                                    <div className="text-xs font-bold text-blue-400 uppercase tracking-widest">Chỉ số cơ bản</div>
                                    {(() => {
                                        // Attempt to parse stat bonuses
                                        let stats: Record<string, number> = {};
                                        if ((inspectingItem as any).statBonuses) {
                                            stats = (inspectingItem as any).statBonuses;
                                        } else if ((inspectingItem as any).statBonusesJSON) {
                                            try { stats = JSON.parse((inspectingItem as any).statBonusesJSON); } catch(e) {}
                                        }

                                        if (Object.keys(stats).length === 0) return <p className="text-[10px] text-gray-500 italic">Không có chỉ số cơ bản</p>;

                                        return (
                                            <div className="grid grid-cols-1 gap-1">
                                                {Object.entries(stats).map(([stat, val]) => (
                                                    <div key={stat} className="flex justify-between items-center text-xs bg-black/20 p-1.5 rounded">
                                                        <span className="text-gray-400">{stat === 'sucTanCong' ? 'Tấn công' : stat === 'phongNgu' ? 'Phòng ngự' : stat === 'maxSinhLuc' ? 'Máu' : stat === 'maxLinhLuc' ? 'Linh lực' : stat}</span>
                                                        <span className="text-green-400 font-bold font-mono">+{formatNumberDot(val as number)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}

                                    {/* Display hidden stats if any */}
                                    {(() => {
                                        let bonusPercentageStats: Record<string, number> = {};
                                        if ((inspectingItem as any).bonusPercentageStats) {
                                            bonusPercentageStats = (inspectingItem as any).bonusPercentageStats;
                                        } else if ((inspectingItem as any).bonusPercentageStatsJSON) {
                                            try { bonusPercentageStats = JSON.parse((inspectingItem as any).bonusPercentageStatsJSON); } catch(e) {}
                                        }

                                        if (!bonusPercentageStats || Object.keys(bonusPercentageStats).length === 0) return null;

                                        return (
                                            <div className="space-y-2 pt-2 border-t border-gray-700/50">
                                                <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Chỉ số tăng % ẩn</div>
                                                <div className="grid grid-cols-1 gap-1">
                                                    {Object.entries(bonusPercentageStats).map(([stat, val]) => {
                                                        const label = stat === 'sucTanCong' ? 'Sức tấn công ẩn' : stat === 'maxSinhLuc' ? 'Sinh lực tối đa ẩn' : stat === 'maxLinhLuc' ? 'Linh lực tối đa ẩn' : stat === 'phongNgu' ? 'Phòng ngự ẩn' : stat;
                                                        return (
                                                            <div key={stat} className="flex justify-between items-center text-xs bg-black/20 p-1.5 rounded border border-emerald-500/20">
                                                                <span className="text-emerald-300">{label}</span>
                                                                <span className="text-emerald-400 font-bold font-mono">+{formatNumberDot(val as number)}%</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className="text-xs font-bold text-orange-400 uppercase tracking-widest pt-2">Hiệu ứng bị động</div>
                                    {(() => {
                                        let passives: string[] = [];
                                        if ((inspectingItem as any).uniqueEffects) {
                                            passives = (inspectingItem as any).uniqueEffects;
                                        } else if ((inspectingItem as any).uniqueEffectsList) {
                                            passives = (inspectingItem as any).uniqueEffectsList.split(';').filter(Boolean);
                                        }

                                        if (passives.length === 0) return <p className="text-[10px] text-gray-500 italic">Không có hiệu ứng đặc biệt</p>;

                                        return (
                                            <div className="space-y-1">
                                                {passives.map((p, i) => (
                                                    <div key={i} className="text-[10px] text-gray-300 flex items-start gap-1">
                                                        <span className="text-orange-500">•</span>
                                                        <span>{p}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                        <Button variant="secondary" className="w-full font-bold uppercase tracking-widest text-[10px]" onClick={() => setInspectingItem(null)}>Đóng</Button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
