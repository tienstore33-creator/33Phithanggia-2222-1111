
import React from 'react';
import { GameLocation } from '../../../types';
import { MAP_COLORS, MAP_SIZES } from './mapConstants';
import * as LocationIcons from './mapIcons';
import * as GameTemplates from '../../../templates';

interface InteractiveMapProps {
  locations: GameLocation[];
  currentLocationId: string | null;
  onLocationClick: (locationId: string) => void;
  transform: string;
  isEditMode: boolean;
  onNodeMouseDown: (event: React.MouseEvent<SVGGElement>, locationId: string) => void;
  onNodeTouchStart: (event: React.TouchEvent<SVGGElement>, locationId: string) => void;
  currentScale: number; // Added to adjust stroke width dynamically
  lastMovementPath?: { fromId: string; toId: string; timestamp: number } | null;
}

// Define the props interface for the icon components locally, as it is not exported from mapIcons.tsx
interface IconProps {
  width?: number | string;
  height?: number | string;
  className?: string;
  stroke?: string;
  strokeWidth?: number;
}

const getLocationIconComponent = (location: GameLocation): React.FC<IconProps> => {
    switch(location.locationType) {
        // Standard Locations
        case GameTemplates.LocationType.VILLAGE: return LocationIcons.VillageIcon;
        case GameTemplates.LocationType.TOWN: return LocationIcons.TownIcon;
        case GameTemplates.LocationType.CITY: return LocationIcons.CityIcon;
        case GameTemplates.LocationType.CAPITAL: return LocationIcons.CapitalIcon;
        case GameTemplates.LocationType.FOREST: return LocationIcons.ForestIcon;
        case GameTemplates.LocationType.MOUNTAIN: return LocationIcons.MountainIcon;
        case GameTemplates.LocationType.CAVE: return LocationIcons.CaveIcon;
        case GameTemplates.LocationType.DUNGEON: return LocationIcons.DungeonIcon;
        case GameTemplates.LocationType.RUIN: return LocationIcons.RuinIcon;
        case GameTemplates.LocationType.SECT_CLAN: return LocationIcons.SectIcon;
        case GameTemplates.SubLocationType.INN: return LocationIcons.InnIcon;
        case GameTemplates.LocationType.RIVER_LAKE: return LocationIcons.WaterIcon;
        case GameTemplates.LocationType.LANDMARK: return LocationIcons.LandmarkIcon;

        // Economy Locations
        case GameTemplates.EconomyLocationType.SHOP: return LocationIcons.ShopIcon;
        case GameTemplates.EconomyLocationType.MARKETPLACE: return LocationIcons.ShopIcon; // Reuse shop icon for marketplace
        case GameTemplates.EconomyLocationType.SHOPPING_CENTER: return LocationIcons.CityIcon; // Reuse city icon for shopping center
        case GameTemplates.EconomyLocationType.AUCTION_HOUSE: return LocationIcons.CapitalIcon; // Reuse capital icon for auction house
        
        case GameTemplates.LocationType.DEFAULT:
        default:
            // Fallback to circle for default or unspecified type
            return LocationIcons.DefaultIcon;
    }
}


const InteractiveMap: React.FC<InteractiveMapProps> = ({
  locations,
  currentLocationId,
  onLocationClick,
  transform,
  isEditMode,
  onNodeMouseDown,
  onNodeTouchStart,
  currentScale,
  lastMovementPath,
}) => {
  const topLevelLocations = locations.filter(loc => 
      !loc.parentLocationId && 
      !Object.values(GameTemplates.SubLocationType).includes(loc.locationType as any)
  );

  return (
    <g transform={transform}>
      {/* Define the arrowhead marker */}
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#14b8a6" />
        </marker>
      </defs>

      {/* Render only the last movement path as an arrow if it exists */}
      {lastMovementPath && (() => {
          const fromLoc = locations.find(l => l.id === lastMovementPath.fromId);
          const toLoc = locations.find(l => l.id === lastMovementPath.toId);
          
          if (!fromLoc || !toLoc || fromLoc.mapX === undefined || fromLoc.mapY === undefined || toLoc.mapX === undefined || toLoc.mapY === undefined) return null;
          
          // Only show if it's a movement between top-level locations or relevant ones
          return (
            <line
              x1={fromLoc.mapX}
              y1={fromLoc.mapY}
              x2={toLoc.mapX}
              y2={toLoc.mapY}
              stroke="#14b8a6"
              strokeWidth={2 / currentScale}
              markerEnd="url(#arrowhead)"
              className="animate-pulse opacity-70"
              style={{ pointerEvents: 'none' }}
            />
          );
      })()}

      {/* Render Location Nodes */}
      {topLevelLocations.map(loc => {
        const isCurrent = loc.id === currentLocationId;
        const nodeSize = isCurrent ? MAP_SIZES.NODE_RADIUS_CURRENT * 2 : MAP_SIZES.NODE_RADIUS_DEFAULT * 2;
        
        let nodeColor: string;
        if (isCurrent) {
            nodeColor = MAP_COLORS.CURRENT_LOCATION_NODE;
        } else if (loc.visited) {
            nodeColor = loc.isSafeZone ? MAP_COLORS.SAFE_ZONE_NODE : MAP_COLORS.DANGER_ZONE_NODE;
        } else {
            nodeColor = MAP_COLORS.UNDISCOVERED_HINT_NODE; // Known but not visited
        }

        // Fallback coordinates if not provided
        const x = loc.mapX ?? MAP_SIZES.SVG_VIEWBOX_WIDTH / 2;
        const y = loc.mapY ?? MAP_SIZES.SVG_VIEWBOX_HEIGHT / 2;

        const IconComponent = getLocationIconComponent(loc);

        return (
          <g
            key={loc.id}
            transform={`translate(${x}, ${y})`}
            onClick={() => !isEditMode && onLocationClick(loc.id)}
            className={`group ${isEditMode ? 'cursor-move' : 'cursor-pointer'}`}
            aria-label={`Địa điểm: ${loc.name}`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !isEditMode && onLocationClick(loc.id)}
            onMouseDown={(e) => onNodeMouseDown(e, loc.id)}
            onTouchStart={(e) => onNodeTouchStart(e, loc.id)}
          >
             <g transform={`translate(-${nodeSize / 2}, -${nodeSize / 2})`} style={{ color: nodeColor }}>
                <IconComponent
                    width={nodeSize}
                    height={nodeSize}
                    className="transition-all group-hover:stroke-indigo-400 group-hover:stroke-[2px] group-focus:ring-2 group-focus:ring-indigo-300"
                    stroke={MAP_COLORS.NODE_STROKE_COLOR}
                    strokeWidth={MAP_SIZES.NODE_STROKE_WIDTH}
                />
             </g>
            <text
              x={MAP_SIZES.NODE_TEXT_OFFSET_X / currentScale} // Adjust offset by scale
              y={MAP_SIZES.NODE_TEXT_OFFSET_Y / currentScale}
              fontSize={MAP_SIZES.NODE_FONT_SIZE}
              fill={MAP_COLORS.NODE_TEXT_COLOR}
              className="pointer-events-none select-none transition-all group-hover:font-semibold"
              style={{ 
                  textShadow: '1px 1px 2px black',
                  // Reduced base font size from 60 to 20 (1/3)
                  fontSize: `${20 / currentScale}px` 
              }}
            >
              {loc.name}
            </text>
          </g>
        );
      })}
    </g>
  );
};

export default InteractiveMap;
