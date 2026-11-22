import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { MapNode } from './MapNode';

export const MapOverlay: React.FC = () => {
  const locations = useGameStore((state) => state.map.locations);
  const connections = useGameStore((state) => state.map.connections);
  const playerLocation = useGameStore((state) => state.character.currentLocation);

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg className="absolute inset-0 w-full h-full">
        {connections.map((conn) => {
          const loc1 = locations.find((l) => l.id === conn.source);
          const loc2 = locations.find((l) => l.id === conn.target);
          if (!loc1 || !loc2) return null;
          return (
            <line
              key={`${conn.source}-${conn.target}`}
              x1={loc1.coordinates.x}
              y1={loc1.coordinates.y}
              x2={loc2.coordinates.x}
              y2={loc2.coordinates.y}
              stroke="rgba(255, 255, 255, 0.3)"
              strokeWidth="2"
            />
          );
        })}
      </svg>
      {locations.map((loc) => (
        <MapNode key={loc.id} location={loc} isCurrent={false} />
      ))}
      <div 
        className="absolute w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"
        style={{ left: playerLocation.coordinates.x, top: playerLocation.coordinates.y }}
      />
    </div>
  );
};
