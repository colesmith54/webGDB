// src/components/GraphVisualizer.tsx

import React, { useMemo, useRef, useState, useCallback } from "react";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { Variable } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GNode {
  id: string;
  fields: Array<{ name: string; display: string; edgeTo?: string }>;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface GEdge {
  id: string;
  fromNode: string;
  fromField: number;
  toNode: string;
}

interface Graph {
  nodes: Map<string, GNode>;
  edges: GEdge[];
  rootId: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const NODE_W = 160;
const FIELD_H = 22;
const HEADER_H = 24;
const H_GAP = 60;
const V_GAP = 80;

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayPrimitive(val: any): string {
  if (val === null || val === undefined) return "null";
  if (typeof val === "string") return `"${val}"`;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val !== "object") return String(val);
  const t = val.type;
  if (t === "number") return String(val.value);
  if (t === "char") return `'${val.value}'`;
  if (t === "string") return `"${val.value}"`;
  if (t === "pointer") return val.address === "0x0" ? "nullptr" : val.address;
  if (t === "std::vector") return `vector[${val.length}]`;
  if (t === "std::list") return `list[${val.value?.length ?? 0}]`;
  if (t === "std::map" || t === "std::unordered_map") return `${t.split("::")[1]}[${val.size}]`;
  if (t === "std::set" || t === "std::unordered_set") return `${t.split("::")[1]}[${val.size}]`;
  if (t === "std::pair") return "pair(…)";
  if (t === "std::tuple") return "tuple(…)";
  return "{…}";
}

// ── Graph Builder ─────────────────────────────────────────────────────────────

const VIRTUAL_ROOT = "__stack_var__";

function buildGraph(rootValue: any, varName: string): Graph {
  const nodes = new Map<string, GNode>();
  const edges: GEdge[] = [];

  function processFields(struct: any, nodeId: string): GNode["fields"] {
    const fields: GNode["fields"] = [];
    if (!struct || typeof struct !== "object") return fields;

    for (const [key, val] of Object.entries(struct)) {
      const anyVal = val as any;
      if (
        anyVal &&
        typeof anyVal === "object" &&
        anyVal.type === "pointer" &&
        anyVal.address !== "0x0"
      ) {
        const childId = processPointer(anyVal);
        if (childId) {
          fields.push({ name: key, display: anyVal.address, edgeTo: childId });
          edges.push({
            id: `${nodeId}-${key}`,
            fromNode: nodeId,
            fromField: fields.length - 1,
            toNode: childId,
          });
        } else {
          fields.push({
            name: key,
            display: anyVal.circular ? `⟲ ${anyVal.address}` : "nullptr",
          });
        }
      } else {
        fields.push({ name: key, display: displayPrimitive(anyVal) });
      }
    }
    return fields;
  }

  function processPointer(ptrVal: any): string | null {
    if (!ptrVal || ptrVal.type !== "pointer") return null;
    if (ptrVal.address === "0x0") return null;
    if (!ptrVal.dereferenced) return null;

    const id = ptrVal.address;
    if (nodes.has(id)) return id;

    const node: GNode = { id, fields: [], x: 0, y: 0, w: NODE_W, h: 0 };
    nodes.set(id, node); // register before recursing to handle cycles

    node.fields = processFields(ptrVal.dereferenced, id);
    node.h = HEADER_H + Math.max(node.fields.length, 1) * FIELD_H + 6;
    return id;
  }

  let rootId: string | null = null;

  if (rootValue?.type === "pointer") {
    rootId = processPointer(rootValue);
  } else if (rootValue && typeof rootValue === "object" && !rootValue.type) {
    // Direct composite struct variable — create a virtual root node
    const hasExpandedPtrs = Object.values(rootValue).some(
      (v: any) =>
        v?.type === "pointer" && v.address !== "0x0" && v.dereferenced
    );
    if (hasExpandedPtrs) {
      const node: GNode = {
        id: VIRTUAL_ROOT,
        fields: [],
        x: 0,
        y: 0,
        w: NODE_W,
        h: 0,
      };
      nodes.set(VIRTUAL_ROOT, node);
      node.fields = processFields(rootValue, VIRTUAL_ROOT);
      node.h = HEADER_H + Math.max(node.fields.length, 1) * FIELD_H + 6;
      rootId = VIRTUAL_ROOT;
    }
  }

  return { nodes, edges, rootId };
}

// ── Layout ────────────────────────────────────────────────────────────────────

function layoutGraph(graph: Graph): void {
  const { nodes, edges, rootId } = graph;
  if (!rootId || nodes.size === 0) return;

  const children = new Map<string, string[]>();
  for (const e of edges) {
    if (!children.has(e.fromNode)) children.set(e.fromNode, []);
    children.get(e.fromNode)!.push(e.toNode);
  }

  // Detect nodes with multiple incoming edges (shared nodes); layout only once
  const inDegree = new Map<string, number>();
  for (const [, cs] of children) {
    for (const c of cs) {
      inDegree.set(c, (inDegree.get(c) ?? 0) + 1);
    }
  }

  const subtreeW = new Map<string, number>();
  const visited = new Set<string>();

  function calcWidth(id: string): number {
    if (visited.has(id)) return NODE_W;
    visited.add(id);
    const kids = children.get(id) ?? [];
    if (kids.length === 0) {
      subtreeW.set(id, NODE_W);
      return NODE_W;
    }
    const total = kids.reduce((s, k) => s + calcWidth(k) + H_GAP, -H_GAP);
    const w = Math.max(NODE_W, total);
    subtreeW.set(id, w);
    return w;
  }
  calcWidth(rootId);

  const placed = new Set<string>();
  function place(id: string, cx: number, y: number): void {
    if (placed.has(id)) return;
    placed.add(id);
    const node = nodes.get(id)!;
    node.x = cx - NODE_W / 2;
    node.y = y;

    const kids = children.get(id) ?? [];
    if (kids.length === 0) return;

    const totalKidW = kids.reduce((s, k) => s + (subtreeW.get(k) ?? NODE_W) + H_GAP, -H_GAP);
    let kx = cx - totalKidW / 2;
    for (const kid of kids) {
      const kw = subtreeW.get(kid) ?? NODE_W;
      place(kid, kx + kw / 2, y + node.h + V_GAP);
      kx += kw + H_GAP;
    }
  }
  place(rootId, 0, 0);
}

// ── SVG Rendering ─────────────────────────────────────────────────────────────

function computeViewBox(nodes: Map<string, GNode>): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} {
  if (nodes.size === 0) return { minX: 0, minY: 0, width: 400, height: 200 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes.values()) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w);
    maxY = Math.max(maxY, n.y + n.h);
  }
  const pad = 30;
  return {
    minX: minX - pad,
    minY: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

function edgePath(
  fromNode: GNode,
  fromField: number,
  toNode: GNode
): string {
  const sx = fromNode.x + fromNode.w;
  const sy = fromNode.y + HEADER_H + fromField * FIELD_H + FIELD_H / 2;
  const tx = toNode.x + toNode.w / 2;
  const ty = toNode.y;

  const dx = tx - sx;
  const dy = ty - sy;
  const cx1 = sx + Math.max(40, Math.abs(dx) * 0.5);
  const cy1 = sy;
  const cx2 = tx - Math.max(20, Math.abs(dx) * 0.3);
  const cy2 = ty - Math.abs(dy) * 0.3;

  return `M ${sx} ${sy} C ${cx1} ${cy1} ${cx2} ${cy2} ${tx} ${ty}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface GraphVisualizerProps {
  variable: Variable;
  onClose: () => void;
}

const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ variable, onClose }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Pan state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((z) => Math.min(3, Math.max(0.2, z * delta)));
  }, []);

  const graph = useMemo(() => {
    const g = buildGraph(variable.value, variable.name);
    layoutGraph(g);
    return g;
  }, [variable]);

  const { nodes, edges, rootId } = graph;
  const vb = useMemo(() => computeViewBox(nodes), [nodes]);

  const isEmpty = nodes.size === 0;

  const shortAddr = (addr: string) =>
    addr.length > 10 ? addr.slice(0, 6) + "…" + addr.slice(-4) : addr;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex flex-col"
        style={{ width: "80vw", height: "80vh", maxWidth: 1200, maxHeight: 800 }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 flex-shrink-0">
          <div>
            <span className="text-white font-semibold font-mono">{variable.name}</span>
            <span className="text-gray-400 text-sm ml-2">pointer graph</span>
            {rootId && (
              <span className="text-gray-500 text-xs ml-2">{nodes.size} node{nodes.size !== 1 ? "s" : ""}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-xs">scroll = zoom · drag = pan</span>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SVG Canvas */}
        <div
          className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
        >
          {isEmpty ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              No expandable pointer structure found.
            </div>
          ) : (
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              style={{ userSelect: "none" }}
            >
              <defs>
                <marker
                  id="arrow"
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#60a5fa" />
                </marker>
              </defs>

              <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                {/* Offset so (0,0) is visible centre */}
                <g transform={`translate(${-vb.minX + 30},${-vb.minY + 30})`}>

                  {/* Edges */}
                  {edges.map((edge) => {
                    const fn = nodes.get(edge.fromNode);
                    const tn = nodes.get(edge.toNode);
                    if (!fn || !tn) return null;
                    return (
                      <path
                        key={edge.id}
                        d={edgePath(fn, edge.fromField, tn)}
                        fill="none"
                        stroke="#60a5fa"
                        strokeWidth="1.5"
                        markerEnd="url(#arrow)"
                      />
                    );
                  })}

                  {/* Nodes */}
                  {[...nodes.values()].map((node) => {
                    const isRoot = node.id === rootId;
                    return (
                      <g key={node.id} transform={`translate(${node.x},${node.y})`}>
                        {/* Node background */}
                        <rect
                          width={node.w}
                          height={node.h}
                          rx={5}
                          fill={isRoot ? "#1e3a5f" : "#1e293b"}
                          stroke={isRoot ? "#3b82f6" : "#475569"}
                          strokeWidth="1.5"
                        />

                        {/* Address header */}
                        <rect
                          width={node.w}
                          height={HEADER_H}
                          rx={5}
                          fill={isRoot ? "#2563eb33" : "#33415533"}
                        />
                        <rect y={HEADER_H - 4} width={node.w} height={4} fill={isRoot ? "#2563eb33" : "#33415533"} />
                        <text
                          x={node.w / 2}
                          y={HEADER_H / 2 + 5}
                          textAnchor="middle"
                          fill={isRoot ? "#93c5fd" : "#94a3b8"}
                          fontSize={10}
                          fontFamily="monospace"
                        >
                          {node.id === VIRTUAL_ROOT ? variable.name : shortAddr(node.id)}
                        </text>

                        {/* Field separator */}
                        <line
                          x1={0}
                          y1={HEADER_H}
                          x2={node.w}
                          y2={HEADER_H}
                          stroke={isRoot ? "#3b82f6" : "#475569"}
                          strokeWidth="0.5"
                        />

                        {/* Fields */}
                        {node.fields.map((field, i) => {
                          const fy = HEADER_H + i * FIELD_H;
                          const hasEdge = !!field.edgeTo;
                          return (
                            <g key={field.name}>
                              {i > 0 && (
                                <line
                                  x1={4}
                                  y1={fy}
                                  x2={node.w - 4}
                                  y2={fy}
                                  stroke="#334155"
                                  strokeWidth="0.5"
                                />
                              )}
                              <text
                                x={6}
                                y={fy + FIELD_H / 2 + 5}
                                fill="#c084fc"
                                fontSize={11}
                                fontFamily="monospace"
                              >
                                {field.name}
                              </text>
                              <text
                                x={node.w - 6}
                                y={fy + FIELD_H / 2 + 5}
                                textAnchor="end"
                                fill={hasEdge ? "#60a5fa" : "#94a3b8"}
                                fontSize={10}
                                fontFamily="monospace"
                              >
                                {hasEdge ? "→" : field.display}
                              </text>
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}
                </g>
              </g>
            </svg>
          )}
        </div>
      </div>
    </div>
  );
};

export function hasVisualizablePointer(value: any): boolean {
  if (!value || typeof value !== "object") return false;
  // Direct pointer variable
  if (value.type === "pointer" && value.dereferenced) return true;
  // Composite struct with at least one expanded pointer field (no known type = plain struct)
  if (!value.type) {
    return Object.values(value).some(
      (v: any) => v?.type === "pointer" && v.address !== "0x0" && v.dereferenced
    );
  }
  return false;
}

export default GraphVisualizer;
