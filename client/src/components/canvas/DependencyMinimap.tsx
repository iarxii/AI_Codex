import React, { useMemo } from 'react';
import type { Artifact } from '../../types/chat';

interface DependencyMinimapProps {
  artifacts: Artifact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface NodePos {
  id: string;
  title: string;
  x: number;
  y: number;
  type: Artifact['type'];
}

const DependencyMinimap: React.FC<DependencyMinimapProps> = ({ artifacts, selectedId, onSelect }) => {
  // Only show if there are dependencies to visualize
  const hasAnyDeps = artifacts.some(a => a.dependencies && a.dependencies.length > 0);

  const { nodes, edges } = useMemo(() => {
    const WIDTH = 400;
    const HEIGHT = 80;
    const PADDING = 40;

    // Position nodes in a horizontal line
    const count = artifacts.length;
    const spacing = count > 1 ? (WIDTH - PADDING * 2) / (count - 1) : 0;

    const nodePositions: NodePos[] = artifacts.map((art, i) => ({
      id: art.id,
      title: art.title,
      x: count === 1 ? WIDTH / 2 : PADDING + i * spacing,
      y: HEIGHT / 2,
      type: art.type,
    }));

    const nodeMap = new Map(nodePositions.map(n => [n.id, n]));

    const edgeList: { from: NodePos; to: NodePos }[] = [];
    for (const art of artifacts) {
      if (!art.dependencies) continue;
      const fromNode = nodeMap.get(art.id);
      if (!fromNode) continue;
      for (const depId of art.dependencies) {
        const toNode = nodeMap.get(depId);
        if (toNode) {
          edgeList.push({ from: fromNode, to: toNode });
        }
      }
    }

    return { nodes: nodePositions, edges: edgeList };
  }, [artifacts]);

  if (!hasAnyDeps || artifacts.length < 2) return null;

  const typeColor = (type: Artifact['type']) => {
    switch (type) {
      case 'code': return '#3b82f6';
      case 'docs': return '#f97316';
      case 'research': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  return (
    <div className="w-full h-[100px] rounded-xl border border-black/[0.05] bg-black/[0.01] overflow-hidden relative">
      <div className="absolute top-2 left-3 text-[7px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-50">
        Dependencies
      </div>
      <svg viewBox="0 0 400 80" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {/* Edges */}
        {edges.map((edge, i) => (
          <path
            key={`edge-${i}`}
            d={`M ${edge.from.x} ${edge.from.y} C ${(edge.from.x + edge.to.x) / 2} ${edge.from.y - 20}, ${(edge.from.x + edge.to.x) / 2} ${edge.to.y - 20}, ${edge.to.x} ${edge.to.y}`}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeDasharray="4 2"
            opacity="0.4"
          />
        ))}

        {/* Nodes */}
        {nodes.map(node => {
          const isSelected = node.id === selectedId;
          return (
            <g
              key={node.id}
              onClick={() => onSelect(node.id)}
              className="cursor-pointer"
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={isSelected ? 8 : 6}
                fill={isSelected ? typeColor(node.type) : 'white'}
                stroke={typeColor(node.type)}
                strokeWidth={isSelected ? 2.5 : 1.5}
                className="transition-all"
              />
              <text
                x={node.x}
                y={node.y + 18}
                textAnchor="middle"
                className="text-[6px] font-bold uppercase"
                fill="var(--text-muted)"
              >
                {node.title.length > 12 ? node.title.slice(0, 10) + '…' : node.title}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default DependencyMinimap;
