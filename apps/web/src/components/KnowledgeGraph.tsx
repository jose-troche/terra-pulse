import type { EventDetailResponse } from "@terra-pulse/earth-domain";

interface KnowledgeGraphProps {
  graph: EventDetailResponse["graph"];
}

export function KnowledgeGraph({ graph }: KnowledgeGraphProps) {
  const nodes = graph.nodes.slice(0, 7);
  return (
    <div className="knowledge-graph" aria-label="Event relationship graph">
      <svg viewBox="0 0 360 190" role="img">
        <title>Event relationships</title>
        {graph.edges.slice(0, 7).map((edge, index) => {
          const sourceIndex = Math.max(
            0,
            nodes.findIndex((node) => node.id === edge.from)
          );
          const targetIndex = Math.max(
            0,
            nodes.findIndex((node) => node.id === edge.to)
          );
          const source = nodePosition(sourceIndex, nodes.length);
          const target = nodePosition(targetIndex, nodes.length);
          return (
            <g key={`${edge.from}-${edge.to}-${index}`}>
              <line
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                className={`graph-edge graph-${edge.classification}`}
              />
            </g>
          );
        })}
        {nodes.map((node, index) => {
          const position = nodePosition(index, nodes.length);
          return (
            <g key={node.id} transform={`translate(${position.x} ${position.y})`}>
              <circle
                r={node.kind === "event" ? 20 : 13}
                className={`graph-node graph-node-${node.kind}`}
              />
              <text y={node.kind === "event" ? 34 : 28} textAnchor="middle">
                {truncate(node.label, node.kind === "event" ? 24 : 18)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="graph-legend">
        <span><i className="evidence-observed" /> Observed</span>
        <span><i className="evidence-computed" /> Computed</span>
      </div>
    </div>
  );
}

function nodePosition(index: number, total: number): { x: number; y: number } {
  if (index === 0) return { x: 180, y: 92 };
  const angle = ((index - 1) / Math.max(1, total - 1)) * Math.PI * 2 - Math.PI / 2;
  return {
    x: 180 + Math.cos(angle) * 120,
    y: 92 + Math.sin(angle) * 65
  };
}

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}
