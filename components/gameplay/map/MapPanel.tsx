
import React, { useState, useRef, WheelEvent, useEffect, useCallback, useMemo } from 'react';
import { KnowledgeBase, GameLocation, GameScreen, Region, LocationConnection, FindLocationParams } from '../../../types';
import InteractiveMap from './InteractiveMap';
import Button from '../../../components/ui/Button';
import { VIETNAMESE } from '../../../constants';
import { MAP_COLORS, MAP_SIZES, MAP_CONFIG } from './mapConstants';
import Modal from '../../../components/ui/Modal';
import * as GameTemplates from '../../../templates';
import * as LocationIcons from './mapIcons';
import FindLocationModal from './FindLocationModal'; 
import { useGame } from '../../../hooks/useGame';
import InputField from '../../ui/InputField';
import { applyAutoLayout } from '../../../utils/tagProcessors/locationTagProcessor';
import { PROMPT_FUNCTIONS } from '../../../prompts';
import { callGeminiAPI } from '../../../services/geminiService';
import { getTaskModel, getCurrentlyUsedKeyDisplay } from '../../../services/apiService';

interface MapPanelProps {
  knowledgeBase: KnowledgeBase;
  setCurrentScreen: (screen: GameScreen) => void;
}

const LegendItem: React.FC<{ color?: string; icon?: React.ReactNode; label: string }> = ({ color, icon, label }) => (
  <div className="flex items-center space-x-2">
    {icon ? (
        <span style={{ width: MAP_SIZES.LEGEND_ITEM_SIZE, height: MAP_SIZES.LEGEND_ITEM_SIZE }} className="inline-block flex-shrink-0">
            {icon}
        </span>
    ) : (
      <span
        style={{ backgroundColor: color, width: MAP_SIZES.LEGEND_ITEM_SIZE, height: MAP_SIZES.LEGEND_ITEM_SIZE }}
        className="inline-block rounded-full border border-gray-600 flex-shrink-0"
      ></span>
    )}
    <span className="text-xs text-gray-300">{label}</span>
  </div>
);

const MapPanel: React.FC<MapPanelProps> = ({
  knowledgeBase,
  setCurrentScreen,
}) => {
  const game = useGame();
  const [selectedLocationDetails, setSelectedLocationDetails] = useState<GameLocation | null>(null);
  const [isReorganizing, setIsReorganizing] = useState(false);
  const [reorganizeTime, setReorganizeTime] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isReorganizing) {
      setReorganizeTime(0);
      interval = setInterval(() => {
        setReorganizeTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isReorganizing]);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [locationHistory, setLocationHistory] = useState<GameLocation[]>([]);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [isFindModalOpen, setIsFindModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLocationListOpen, setIsLocationListOpen] = useState(true);

  const [viewMatrix, setViewMatrix] = useState({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });
  const svgRef = useRef<SVGSVGElement | null>(null);
  
  const [interaction, setInteraction] = useState<{
    type: 'pan' | 'drag';
    targetId?: string;
    startX: number;
    startY: number;
    initialNodeX?: number;
    initialNodeY?: number;
    initialTranslateX?: number;
    initialTranslateY?: number;
  } | null>(null);

  // Unified coordinate getter for both mouse and touch events
  const getCoords = (e: React.MouseEvent<Element, MouseEvent> | React.TouchEvent<Element>): { x: number, y: number } => {
    if ('touches' in e && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
  };

  const handleInteractionStart = useCallback((
    e: React.MouseEvent<SVGSVGElement | SVGGElement> | React.TouchEvent<SVGSVGElement | SVGGElement>, 
    type: 'pan' | 'drag', 
    locationId?: string
  ) => {
    if (type === 'drag' && (!isEditMode || !locationId)) return;
    
    if (type === 'drag') {
        e.stopPropagation();
    }

    const { x, y } = getCoords(e as any);

    if (type === 'drag' && locationId) {
        const targetLocation = knowledgeBase.discoveredLocations.find(l => l.id === locationId);
        if (!targetLocation) return;
        setInteraction({
            type: 'drag',
            targetId: locationId,
            startX: x,
            startY: y,
            initialNodeX: targetLocation.mapX || 0,
            initialNodeY: targetLocation.mapY || 0
        });
    } else { // type is 'pan'
        setInteraction({
            type: 'pan',
            startX: x,
            startY: y,
            initialTranslateX: viewMatrix.translateX,
            initialTranslateY: viewMatrix.translateY
        });
    }

    if (svgRef.current) svgRef.current.style.cursor = 'grabbing';
  }, [isEditMode, knowledgeBase.discoveredLocations, viewMatrix.translateX, viewMatrix.translateY]);

  const handleInteractionMove = useCallback((e: globalThis.MouseEvent | globalThis.TouchEvent) => {
    if (!interaction) return;
    
    const getMoveCoords = (ev: globalThis.MouseEvent | globalThis.TouchEvent): { x: number; y: number } | null => {
        if (ev instanceof MouseEvent) return { x: ev.clientX, y: ev.clientY };
        if (ev instanceof TouchEvent && ev.touches && ev.touches.length > 0) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
        return null;
    };
    
    const coords = getMoveCoords(e);
    if (!coords) return;

    if (e.cancelable) e.preventDefault();

    requestAnimationFrame(() => {
        if (!interaction) return;

        const dx = coords.x - interaction.startX;
        const dy = coords.y - interaction.startY;
        
        if (interaction.type === 'pan' && interaction.initialTranslateX !== undefined && interaction.initialTranslateY !== undefined) {
            setViewMatrix(prev => ({
                ...prev,
                translateX: interaction.initialTranslateX! + dx,
                translateY: interaction.initialTranslateY! + dy,
            }));
        } else if (interaction.type === 'drag' && interaction.targetId && interaction.initialNodeX !== undefined && interaction.initialNodeY !== undefined) {
            const svgDx = dx / viewMatrix.scale;
            const svgDy = dy / viewMatrix.scale;
            
            const newX = interaction.initialNodeX + svgDx;
            const newY = interaction.initialNodeY + svgDy;
    
            game.updateLocationCoordinates(interaction.targetId, newX, newY);
        }
    });
  }, [interaction, viewMatrix.scale, game]);

  const handleInteractionEnd = useCallback(() => {
    setInteraction(null);
    if (svgRef.current) svgRef.current.style.cursor = isEditMode ? 'default' : 'grab';
  }, [isEditMode]);

  useEffect(() => {
    if (interaction) {
      window.addEventListener('mousemove', handleInteractionMove);
      window.addEventListener('touchmove', handleInteractionMove, { passive: false });
      window.addEventListener('mouseup', handleInteractionEnd);
      window.addEventListener('touchend', handleInteractionEnd);
      window.addEventListener('touchcancel', handleInteractionEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleInteractionMove);
      window.removeEventListener('touchmove', handleInteractionMove);
      window.removeEventListener('mouseup', handleInteractionEnd);
      window.removeEventListener('touchend', handleInteractionEnd);
      window.removeEventListener('touchcancel', handleInteractionEnd);
    }
  }, [interaction, handleInteractionMove, handleInteractionEnd]);


  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!svgRef.current) return;
    const scaleAmount = 0.1;
    const newScale = e.deltaY > 0 ? viewMatrix.scale * (1 - scaleAmount) : viewMatrix.scale * (1 + scaleAmount);
    const clampedScale = Math.max(0.2, Math.min(newScale, 5));
    
    const svgPoint = svgRef.current.createSVGPoint();
    svgPoint.x = e.clientX;
    svgPoint.y = e.clientY;
    
    const pointInSvg = svgPoint.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
    
    const newTranslateX = pointInSvg.x - (pointInSvg.x - viewMatrix.translateX) * (clampedScale / viewMatrix.scale);
    const newTranslateY = pointInSvg.y - (pointInSvg.y - viewMatrix.translateY) * (clampedScale / viewMatrix.scale);

    setViewMatrix({
        scale: clampedScale,
        translateX: newTranslateX,
        translateY: newTranslateY,
    });
  };

  const zoom = (factor: number) => {
    const newScale = Math.max(0.2, Math.min(viewMatrix.scale * factor, 5));
    const centerX = MAP_SIZES.SVG_VIEWBOX_WIDTH / 2;
    const centerY = MAP_SIZES.SVG_VIEWBOX_HEIGHT / 2;
    const newTranslateX = centerX - (centerX - viewMatrix.translateX) * (newScale / viewMatrix.scale);
    const newTranslateY = centerY - (centerY - viewMatrix.translateY) * (newScale / viewMatrix.scale);
    setViewMatrix({ scale: newScale, translateX: newTranslateX, translateY: newTranslateY });
  };

  const resetView = () => setViewMatrix({ scale: 1, translateX: 0, translateY: 0 });

  const handleLocationClick = (locationId: string) => {
    const location = knowledgeBase.discoveredLocations.find(loc => loc.id === locationId);
    if (location) {
      setLocationHistory([location]);
      setSelectedLocationDetails(location);
      setIsLocationModalOpen(true);
    }
  };
  
  const handleSubLocationClick = (subLocation: GameLocation) => {
    setLocationHistory(prev => [...prev, subLocation]);
    setSelectedLocationDetails(subLocation);
  };

  const handleModalBack = () => {
    const newHistory = [...locationHistory];
    newHistory.pop();
    if (newHistory.length > 0) {
      setLocationHistory(newHistory);
      setSelectedLocationDetails(newHistory[newHistory.length - 1]);
    }
  };

  const handleCloseModal = () => {
    setIsLocationModalOpen(false);
    setSelectedLocationDetails(null);
    setLocationHistory([]);
  };

  const handleStartSearch = (params: FindLocationParams) => {
    game.handleFindLocation(params);
    setIsFindModalOpen(false);
  };

  const handleTravelRequest = (locationId: string) => {
    if (game.isLoadingApi || locationId === knowledgeBase.currentLocationId) return;
    const targetLocation = knowledgeBase.discoveredLocations.find(l => l.id === locationId);
    if (targetLocation) {
        game.handleTravelToLocation(locationId);
    }
  };
  
  const currentLocation = knowledgeBase.discoveredLocations.find(loc => loc.id === knowledgeBase.currentLocationId);
  const getRegionName = useCallback((regionId?: string): string | undefined => {
    if (!regionId) return undefined;
    return knowledgeBase.discoveredRegions.find(r => r.id === regionId)?.name;
  }, [knowledgeBase.discoveredRegions]);

  const transformString = `translate(${viewMatrix.translateX} ${viewMatrix.translateY}) scale(${viewMatrix.scale})`;
  const viewBox = `0 0 ${MAP_SIZES.SVG_VIEWBOX_WIDTH} ${MAP_SIZES.SVG_VIEWBOX_HEIGHT}`;

  const iconLegendData = [
    { icon: <LocationIcons.PlayerIcon className="text-white"/>, label: VIETNAMESE.legendCurrentLocation },
    { icon: <LocationIcons.VillageIcon className="text-white"/>, label: VIETNAMESE.locationType_VILLAGE },
    { icon: <LocationIcons.TownIcon className="text-white"/>, label: VIETNAMESE.locationType_TOWN },
    { icon: <LocationIcons.CityIcon className="text-white"/>, label: VIETNAMESE.locationType_CITY },
    { icon: <LocationIcons.CapitalIcon className="text-white"/>, label: VIETNAMESE.locationType_CAPITAL },
    { icon: <LocationIcons.SectIcon className="text-white"/>, label: VIETNAMESE.locationType_SECT_CLAN },
    { icon: <LocationIcons.ShopIcon className="text-white"/>, label: VIETNAMESE.locationType_SHOP },
    { icon: <LocationIcons.InnIcon className="text-white"/>, label: VIETNAMESE.locationType_INN },
    { icon: <LocationIcons.ForestIcon className="text-white"/>, label: VIETNAMESE.locationType_FOREST },
    { icon: <LocationIcons.MountainIcon className="text-white"/>, label: VIETNAMESE.locationType_MOUNTAIN },
    { icon: <LocationIcons.CaveIcon className="text-white"/>, label: VIETNAMESE.locationType_CAVE },
    { icon: <LocationIcons.DungeonIcon className="text-white"/>, label: VIETNAMESE.locationType_DUNGEON },
    { icon: <LocationIcons.RuinIcon className="text-white"/>, label: VIETNAMESE.locationType_RUIN },
    { icon: <LocationIcons.WaterIcon className="text-white"/>, label: VIETNAMESE.locationType_RIVER_LAKE },
    { icon: <LocationIcons.LandmarkIcon className="text-white"/>, label: VIETNAMESE.locationType_LANDMARK },
    { icon: <LocationIcons.DefaultIcon className="text-white"/>, label: VIETNAMESE.locationType_DEFAULT },
  ];

  const colorLegendData = [
      { color: MAP_COLORS.CURRENT_LOCATION_NODE, label: VIETNAMESE.legendCurrentLocation },
      { color: MAP_COLORS.SAFE_ZONE_NODE, label: VIETNAMESE.legendSafeZoneNode },
      { color: MAP_COLORS.DANGER_ZONE_NODE, label: VIETNAMESE.safetyStatusDanger },
      { color: MAP_COLORS.DISCOVERED_LOCATION_NODE, label: VIETNAMESE.legendDiscoveredLocationNode },
      { color: MAP_COLORS.UNDISCOVERED_HINT_NODE, label: VIETNAMESE.legendUnvisitedLocation },
      { color: MAP_COLORS.PATH_DISCOVERED, label: VIETNAMESE.legendPathDiscovered },
  ];

  const subLocationsForSelected = selectedLocationDetails 
    ? knowledgeBase.discoveredLocations.filter(loc => loc.parentLocationId === selectedLocationDetails?.id)
    : [];
    
  const handleLocationSelect = (location: GameLocation) => {
      if (location.mapX === undefined || location.mapY === undefined) {
          handleLocationClick(location.id); // Fallback to modal if no coords
          return;
      }

      const newScale = 1.5; // Zoom in to a fixed level
      
      const viewBoxWidth = MAP_SIZES.SVG_VIEWBOX_WIDTH;
      const viewBoxHeight = MAP_SIZES.SVG_VIEWBOX_HEIGHT;
      
      // We want the target coordinates to be at the center of the viewport
      const newTranslateX = (viewBoxWidth / 2) - (location.mapX * newScale);
      const newTranslateY = (viewBoxHeight / 2) - (location.mapY * newScale);

      setViewMatrix({
          scale: newScale,
          translateX: newTranslateX,
          translateY: newTranslateY,
      });
  };
  
  const filteredLocations = useMemo(() => {
    return knowledgeBase.discoveredLocations.filter(loc => 
        loc.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !loc.parentLocationId &&
        !Object.values(GameTemplates.SubLocationType).includes(loc.locationType as any)
    );
  }, [knowledgeBase.discoveredLocations, searchTerm]);

  const groupedLocations = useMemo(() => {
      const groups: Record<string, GameLocation[]> = {};
      filteredLocations.forEach(loc => {
          const regionName = getRegionName(loc.regionId) || 'Thế giới';
          if (!groups[regionName]) {
              groups[regionName] = [];
          }
          groups[regionName].push(loc);
      });
      // Sort locations within each group alphabetically
      for (const region in groups) {
          groups[region].sort((a,b) => a.name.localeCompare(b.name));
      }
      return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)); // Sort groups by region name
  }, [filteredLocations, getRegionName]);

  const [showSvgMap, setShowSvgMap] = useState(true);

  const layoutedKb = useMemo(() => {
    if (isEditMode) {
      return knowledgeBase;
    }
    try {
      return applyAutoLayout(knowledgeBase);
    } catch (e) {
      console.error("Failed to apply auto layout on map view:", e);
      return knowledgeBase;
    }
  }, [knowledgeBase, isEditMode]);

  const layoutedLocations = layoutedKb.discoveredLocations;

  const estimatedTravelDays = useMemo(() => {
    if (!currentLocation || !selectedLocationDetails) return null;
    if (selectedLocationDetails.id === currentLocation.id) return 0;
    
    let distance = 150; // Khoảng cách mặc định nếu không có tọa độ
    if (currentLocation.mapX !== undefined && currentLocation.mapY !== undefined && 
        selectedLocationDetails.mapX !== undefined && selectedLocationDetails.mapY !== undefined) {
      distance = Math.round(Math.sqrt(
        Math.pow(selectedLocationDetails.mapX - currentLocation.mapX, 2) + 
        Math.pow(selectedLocationDetails.mapY - currentLocation.mapY, 2)
      ));
    }
    
    const baseSpeed = 50;
    const speedMult = knowledgeBase.playerStats.permanentBonuses?.speedMult || 1;
    const levelBonus = 1 + (knowledgeBase.playerStats.level || 0) * 0.1; // Tăng 10% tốc độ di chuyển mỗi cấp
    const finalSpeed = baseSpeed * speedMult * levelBonus;
    return Math.max(1, Math.min(15, Math.round(distance / finalSpeed)));
  }, [currentLocation, selectedLocationDetails, knowledgeBase.playerStats]);

  return (
    <>
    <div className="min-h-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      {/* Header - Simple and clean */}
      <header className="p-3 bg-gray-900 border-b border-gray-800 flex justify-between items-center z-30">
        <h1 className="text-xl font-bold text-teal-400 flex items-center gap-2 uppercase tracking-wide">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
          Khám Phá / Bản Đồ
        </h1>
        <div className="flex gap-2">
            <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowSvgMap(!showSvgMap)}
                className="text-xs border-cyan-700 text-cyan-400"
            >
                {showSvgMap ? 'Dạng Danh Sách' : 'Dạng Bản Đồ'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setCurrentScreen(GameScreen.Gameplay)} className="text-xs">
                {VIETNAMESE.goBackButton}
            </Button>
        </div>
      </header>

      <div className="flex-grow flex flex-col max-w-4xl mx-auto w-full overflow-hidden relative">
        {showSvgMap ? (
            /* SVG Map View (Hidden by default now) */
            <div className="flex-grow bg-gray-900 overflow-hidden relative">
                 <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-gray-900/80 px-4 py-1.5 rounded-full z-20 pointer-events-none text-xs border border-amber-500/30">
                    Vị trí hiện tại: <strong className="text-amber-400">{currentLocation?.name}</strong>
                </div>
                <svg
                    ref={svgRef}
                    width="100%"
                    height="100%"
                    viewBox={viewBox}
                    className="rounded-md"
                    onMouseDown={(e) => handleInteractionStart(e, 'pan')}
                    onTouchStart={(e) => handleInteractionStart(e, 'pan')}
                    onWheel={onWheel}
                    style={{ cursor: isEditMode ? 'default' : 'grab' }}
                >
                    <rect width={MAP_SIZES.SVG_VIEWBOX_WIDTH} height={MAP_SIZES.SVG_VIEWBOX_HEIGHT} fill={MAP_COLORS.MAP_BACKGROUND} />
                    <InteractiveMap
                        locations={layoutedLocations}
                        currentLocationId={currentLocation?.id || null}
                        onLocationClick={handleLocationClick}
                        transform={transformString}
                        isEditMode={isEditMode}
                        onNodeMouseDown={(e, id) => handleInteractionStart(e, 'drag', id)}
                        onNodeTouchStart={(e, id) => handleInteractionStart(e, 'drag', id)}
                        currentScale={viewMatrix.scale}
                        lastMovementPath={knowledgeBase.lastMovementPath}
                    />
                </svg>
                
                {/* Visual controls for map only */}
                <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                    <Button onClick={() => zoom(1.2)} size="sm" variant="secondary" className="!w-10 !h-10 !p-0 bg-gray-800/80 border-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </Button>
                    <Button onClick={() => zoom(1/1.2)} size="sm" variant="secondary" className="!w-10 !h-10 !p-0 bg-gray-800/80 border-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                    </Button>
                    <Button onClick={() => setIsEditMode(!isEditMode)} size="sm" variant={isEditMode ? "primary" : "secondary"} className="text-xs">
                        {isEditMode ? 'Lưu' : 'Sửa'}
                    </Button>
                    <Button 
                        onClick={async () => {
                            const playerAction = "vẽ lại bản đồ";
                            const knowledgeBase = layoutedKb;
                            const prompt = PROMPT_FUNCTIONS.reorganizeMap(knowledgeBase.discoveredLocations, knowledgeBase);
                            
                            setIsReorganizing(true);
                            try {
                                // BẮT BUỘC dùng category 'economy' như người dùng yêu cầu
                                const res = await callGeminiAPI(prompt, undefined, 'economy'); 
                                if (res.text.includes('[LOCATION_REPARENT')) {
                                    // Process the tags via game.handleProcessDebugTags
                                    await game.handleProcessDebugTags("Bản đồ đang được quy hoạch lại theo ý muốn của Thiên Đạo...", res.text);
                                    game.showNotification("Quy hoạch bản đồ thành công!", "success");
                                } else {
                                    game.showNotification("AI đánh giá bản đồ hiện tại đã tối ưu.", "info");
                                }
                            } catch (e: any) {
                                console.error("Reorganization failed", e);
                                game.showNotification("Quy hoạch bản đồ thất bại: " + (e.message || e), "error");
                            } finally {
                                setIsReorganizing(false);
                            }
                        }} 
                        size="sm" 
                        variant="secondary" 
                        className="text-xs border-teal-700 text-teal-400"
                        disabled={isReorganizing}
                    >
                        {isReorganizing ? "Đang quy hoạch..." : "Vẽ lại bản đồ"}
                    </Button>
                </div>

                {/* Loading overlay hiển thị thông tin chi tiết mô hình và nguồn */}
                {isReorganizing && (
                    <div className="absolute inset-0 bg-gray-950/85 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-center">
                        <div className="bg-gray-900 border border-teal-500/30 rounded-xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center gap-4">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-full border-4 border-teal-500/20 border-t-teal-400 animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center text-teal-400 font-bold font-mono text-xs">
                                    AI
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Đang quy hoạch bản đồ...</h3>
                                <p className="text-xs text-gray-400">Thiên Đạo đang tính toán cấu trúc không gian tối ưu</p>
                            </div>

                            <div className="w-full bg-gray-950/80 border border-gray-800 rounded-lg p-3 text-left space-y-2 font-mono text-[10px]">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">MÔ HÌNH:</span>
                                    <span className="text-teal-400 font-bold">{getTaskModel('economy')}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">NGUỒN KEY:</span>
                                    <span className="text-amber-400 font-bold">{getCurrentlyUsedKeyDisplay()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">THỜI GIAN CHẠY:</span>
                                    <span className="text-white bg-gray-800 px-1.5 py-0.5 rounded font-bold tabular-nums">{reorganizeTime}s</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        ) : (
            /* Mockup-style List View */
            <div className="flex-grow flex flex-col overflow-y-auto custom-scrollbar bg-gray-900 border-x border-gray-800">
                {/* Location Image */}
                <div className="w-full aspect-video bg-gray-800 relative overflow-hidden flex-shrink-0">
                    {currentLocation?.avatarUrl ? (
                        <img 
                            src={currentLocation.avatarUrl} 
                            alt={currentLocation.name} 
                            className="w-full h-full object-cover opacity-80"
                            referrerPolicy="no-referrer"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600 flex-col gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <span className="text-sm font-medium tracking-widest uppercase opacity-40">Hình Ảnh Khu Vực</span>
                        </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none" />
                </div>

                {/* You are here status */}
                <div className="p-4 bg-gray-900 border-b border-gray-800 flex items-center gap-3">
                    <div className="bg-amber-500/20 p-2 rounded-lg border border-amber-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                    </div>
                    <div>
                        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-tighter">BẠN ĐANG Ở</span>
                        <h2 className="text-lg font-bold text-amber-400 leading-tight uppercase">{currentLocation?.name || "Chưa xác định"}</h2>
                    </div>
                </div>

                {/* Major Locations List */}
                <div className="p-4 flex-grow flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-teal-500 uppercase tracking-widest border-l-4 border-teal-500 pl-3">
                            Danh Sách Địa Điểm Chính
                        </h3>
                        {/* Inline Search */}
                        <div className="w-40 relative group">
                            <input 
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Tìm..."
                                className="w-full bg-gray-800 border border-gray-700 rounded-md py-1 px-2 text-xs focus:outline-none focus:border-teal-500 transition-colors"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1.5 text-gray-500 hover:text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <div className="space-y-6">
                        {groupedLocations.length > 0 ? (
                            groupedLocations.map(([regionName, locations]) => (
                                <div key={regionName} className="relative">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-xs font-bold text-gray-600 uppercase tracking-widest whitespace-nowrap">{regionName}</span>
                                        <div className="h-px bg-gray-800 flex-grow" />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {locations.map(loc => {
                                            const isCurrent = loc.id === knowledgeBase.currentLocationId;
                                            const isSafe = isCurrent ? knowledgeBase.currentLocationSafetyOverride !== 'danger' : loc.isSafeZone !== false;
                                            
                                            return (
                                                <div 
                                                    key={loc.id} 
                                                    className={`group relative border rounded-lg transition-all duration-300 ${
                                                        isCurrent 
                                                            ? 'border-amber-500/50 bg-amber-500/10 shadow-[inset_0_0_10px_rgba(245,158,11,0.1)]' 
                                                            : isSafe 
                                                                ? 'border-green-900/40 bg-green-900/10 hover:border-green-500/50 hover:bg-green-500/5' 
                                                                : 'border-red-900/20 bg-red-900/5 hover:border-red-500/40 hover:bg-red-500/5'
                                                    }`}
                                                >
                                                    <button 
                                                        onClick={() => handleTravelRequest(loc.id)}
                                                        className="w-full text-left p-3 flex items-center justify-between"
                                                        disabled={game.isLoadingApi || isCurrent}
                                                    >
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <span className={`text-sm ${
                                                                isCurrent 
                                                                    ? 'text-amber-400 font-bold' 
                                                                    : isSafe 
                                                                        ? 'text-green-500/70 group-hover:text-green-400' 
                                                                        : 'text-red-500/60 group-hover:text-red-400'
                                                            }`}>
                                                                {isCurrent ? '●' : '○'}
                                                            </span>
                                                            <span className={`text-sm font-medium truncate uppercase ${
                                                                isCurrent 
                                                                    ? 'text-amber-300' 
                                                                    : isSafe 
                                                                        ? 'text-gray-100 group-hover:text-green-100' 
                                                                        : 'text-gray-300 group-hover:text-red-100'
                                                            }`}>
                                                                {loc.name}
                                                            </span>
                                                        </div>
                                                        {!isCurrent && (
                                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isSafe ? 'text-green-500' : 'text-red-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                                </svg>
                                                            </div>
                                                        )}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-12 flex flex-col items-center opacity-30">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <p className="italic text-sm">Không tìm thấy địa điểm chủ trì...</p>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Footer Spacer */}
                <div className="h-20 flex-shrink-0" />
            </div>
        )}
      </div>

      {/* Floating Travel/Info Status if traveling */}
      {game.isLoadingApi && (
          <div className="fixed bottom-2 left-1/2 -translate-x-1/2 w-64 bg-teal-600 text-white px-4 py-2 rounded-lg shadow-2xl z-50 flex items-center justify-center gap-3 animate-bounce">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold uppercase tracking-widest">Đang di chuyển...</span>
          </div>
      )}
    </div>
    
       {selectedLocationDetails && (
        <Modal
          isOpen={isLocationModalOpen}
          onClose={handleCloseModal}
          title={`Chi Tiết: ${selectedLocationDetails.name}`}
        >
          <div className="space-y-2 text-sm">
            <p><strong className="text-indigo-300">Tên:</strong> {selectedLocationDetails.name}</p>
            {selectedLocationDetails.locationType && <p><strong className="text-indigo-300">Loại:</strong> {selectedLocationDetails.locationType}</p>}
            {(selectedLocationDetails.mapX !== undefined && selectedLocationDetails.mapY !== undefined) && (
              <p><strong className="text-indigo-300">Tọa độ:</strong> ({selectedLocationDetails.mapX}, {selectedLocationDetails.mapY})</p>
            )}
            {selectedLocationDetails.description && <p><strong className="text-indigo-300">Mô tả:</strong> {selectedLocationDetails.description}</p>}
            {selectedLocationDetails.regionId && (
                <p><strong className="text-indigo-300">{VIETNAMESE.regionLabel || "Vùng"}:</strong> {getRegionName(selectedLocationDetails.regionId) || selectedLocationDetails.regionId}</p>
            )}
            <p><strong className="text-indigo-300">An toàn:</strong> {selectedLocationDetails.id === knowledgeBase.currentLocationId ? (knowledgeBase.currentLocationSafetyOverride === 'danger' ? "Không (Tình huống nguy hiểm)" : "Có (An toàn)") : (selectedLocationDetails.isSafeZone !== false ? "Có" : "Không")}</p>
            {selectedLocationDetails.parentLocationId === undefined && (
              <p><strong className="text-indigo-300">{VIETNAMESE.locationStatusLabel}:</strong> <span className={selectedLocationDetails.visited ? 'text-green-400 font-semibold' : 'text-gray-400'}>{selectedLocationDetails.visited ? VIETNAMESE.locationStatusVisited : VIETNAMESE.locationStatusUnvisited}</span></p>
            )}
            
            {estimatedTravelDays !== null && estimatedTravelDays > 0 && (
              <p><strong className="text-indigo-300">Thời gian di chuyển:</strong> {estimatedTravelDays} ngày (Khoảng cách thực tế giữa các tọa độ)</p>
            )}
            
            {subLocationsForSelected.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-600">
                    <strong className="text-indigo-300">Khu Vực Phụ:</strong>
                    <ul className="list-disc list-inside pl-4 mt-1 space-y-1">
                        {subLocationsForSelected.map(subLoc => (
                            <li key={subLoc.id}>
                                <button onClick={() => handleSubLocationClick(subLoc)} className="text-cyan-400 hover:text-cyan-300 underline">
                                    {subLoc.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
          </div>

          {/* Travel action and navigation buttons */}
          <div className="mt-6 pt-4 border-t border-gray-700 flex justify-between items-center gap-2">
            <div>
               {locationHistory.length > 1 && (
                 <Button onClick={handleModalBack} variant="secondary">
                    &larr; Quay lại {locationHistory[locationHistory.length - 2].name}
                 </Button>
               )}
            </div>
            {selectedLocationDetails.id !== currentLocation?.id && selectedLocationDetails.parentLocationId === undefined && (
              <Button 
                onClick={() => {
                  handleTravelRequest(selectedLocationDetails.id);
                  handleCloseModal();
                }}
                variant="primary"
                className="bg-teal-600 hover:bg-teal-500 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2"
                disabled={game.isLoadingApi}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                Di Chuyển Đến Đây
              </Button>
            )}
          </div>
        </Modal>
      )}

    {isFindModalOpen && (
        <FindLocationModal
            isOpen={isFindModalOpen}
            onClose={() => setIsFindModalOpen(false)}
            onSearch={handleStartSearch}
            isLoading={game.isLoadingApi}
        />
    )}
    </>
  );
};

export default MapPanel;
