// src/components/ContainerVisualizer.tsx

import React, { useMemo, useRef, useState, useCallback } from "react";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { Variable } from "../types";

// ── Format helper ──────────────────────────────────────────────────────────────

function fmt(v: any, lim = 9): string {
  if (v == null) return "∅";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  if (typeof v === "string") return v.length > lim ? `"${v.slice(0, lim)}…"` : `"${v}"`;
  if (typeof v !== "object") return String(v);
  const t = v.type;
  if (t === "number") return String(v.value);
  if (t === "char") return `'${v.value}'`;
  if (t === "string") { const s = String(v.value); return s.length > lim ? `"${s.slice(0, lim)}…"` : `"${s}"`; }
  if (t === "pointer") return v.address === "0x0" ? "null" : "ptr";
  if (t === "std::pair") return `(${fmt(v.first, 4)}, ${fmt(v.second, 4)})`;
  if (t) return t.replace("std::", "").replace(/<.*>/, "");
  const ks = Object.keys(v);
  if (!ks.length) return "{}";
  return ks.length <= 2 ? `{${ks.map(k => `${k}:${fmt(v[k], 3)}`).join(", ")}}` : `{…${ks.length}}`;
}

function unwrap(v: any): any[] {
  if (!v) return [];
  if (Array.isArray(v.value)) return v.value;
  if (v.wrapped) return unwrap(v.wrapped);
  return [];
}

// ── Colour tokens ──────────────────────────────────────────────────────────────

const BG = "#1e293b";
const BG2 = "#0f172a";
const STR = "#475569";
const ACC = "#3b82f6";
const ACCT = "#60a5fa";
const GRN = "#22c55e";
const ORG = "#f97316";
const TXT = "#e2e8f0";
const MUT = "#64748b";
const DIM = "#334155";

// ── Shared SVG primitives ──────────────────────────────────────────────────────

const Rect: React.FC<{
  x: number; y: number; w: number; h: number;
  fill?: string; stroke?: string; rx?: number;
}> = ({ x, y, w, h, fill = BG, stroke = STR, rx = 4 }) => (
  <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} stroke={stroke} strokeWidth={1.5} />
);

const Label: React.FC<{
  x: number; y: number; text: string;
  anchor?: string; fill?: string; size?: number; bold?: boolean; mono?: boolean;
}> = ({ x, y, text, anchor = "middle", fill = TXT, size = 12, bold = false, mono = true }) => (
  <text
    x={x} y={y}
    textAnchor={anchor as any}
    dominantBaseline="central"
    fill={fill}
    fontSize={size}
    fontFamily={mono ? "monospace" : "sans-serif"}
    fontWeight={bold ? "700" : "400"}
  >{text}</text>
);

function arrowDefs(id: string) {
  return (
    <defs>
      <marker id={id} markerWidth="7" markerHeight="6" refX="6" refY="3" orient="auto">
        <polygon points="0 0, 7 3, 0 6" fill={ACCT} />
      </marker>
    </defs>
  );
}

// ── Tree-layout engine ─────────────────────────────────────────────────────────

interface TNode { lbl: string; sub?: string; ch: TNode[]; x: number; y: number; }

const TW = 82, TH = 44, TGH = 18, TGV = 56;

function treeW(n: TNode): number {
  return n.ch.length === 0
    ? TW
    : Math.max(TW, n.ch.reduce((s, c) => s + treeW(c) + TGH, -TGH));
}

function treePlace(n: TNode, cx: number, y: number) {
  n.x = cx - TW / 2; n.y = y;
  if (!n.ch.length) return;
  const tot = n.ch.reduce((s, c) => s + treeW(c) + TGH, -TGH);
  let sx = cx - tot / 2;
  for (const c of n.ch) { const w = treeW(c); treePlace(c, sx + w / 2, y + TH + TGV); sx += w + TGH; }
}

function treeNodes(n: TNode): TNode[] { return [n, ...n.ch.flatMap(treeNodes)]; }
function treeEdges(n: TNode): [TNode, TNode][] {
  return [...n.ch.map(c => [n, c] as [TNode, TNode]), ...n.ch.flatMap(treeEdges)];
}
function treeViewBox(root: TNode, pad = 24) {
  const ns = treeNodes(root);
  const x0 = Math.min(...ns.map(n => n.x)) - pad;
  const y0 = Math.min(...ns.map(n => n.y)) - pad;
  const x1 = Math.max(...ns.map(n => n.x + TW)) + pad;
  const y1 = Math.max(...ns.map(n => n.y + TH)) + pad;
  return `${x0} ${y0} ${x1 - x0} ${y1 - y0}`;
}

function buildHeapTree(items: any[]): TNode | null {
  if (!items.length) return null;
  function b(i: number): TNode {
    const L = 2 * i + 1 < items.length ? b(2 * i + 1) : null;
    const R = 2 * i + 2 < items.length ? b(2 * i + 2) : null;
    return { lbl: fmt(items[i]), ch: [L, R].filter(Boolean) as TNode[], x: 0, y: 0 };
  }
  return b(0);
}

function buildBSTTree(items: Array<{ lbl: string; sub?: string }>): TNode | null {
  if (!items.length) return null;
  const m = Math.floor(items.length / 2);
  return {
    lbl: items[m].lbl,
    sub: items[m].sub,
    ch: [buildBSTTree(items.slice(0, m)), buildBSTTree(items.slice(m + 1))].filter(Boolean) as TNode[],
    x: 0, y: 0,
  };
}

// ── TreeSVG — shared for heap and BST ─────────────────────────────────────────

const TreeSVG: React.FC<{
  root: TNode;
  title: string;
  accent?: string;
}> = ({ root, title, accent = ACC }) => {
  treePlace(root, 0, 0);
  const vb = treeViewBox(root);
  const nodes = treeNodes(root);
  const edges = treeEdges(root);

  function curvePath(p: TNode, c: TNode) {
    const sx = p.x + TW / 2, sy = p.y + TH;
    const tx = c.x + TW / 2, ty = c.y;
    return `M ${sx} ${sy} C ${sx} ${(sy + ty) / 2}, ${tx} ${(sy + ty) / 2}, ${tx} ${ty}`;
  }

  return (
    <svg viewBox={vb} width="100%" height="100%" style={{ minHeight: 120 }}>
      {arrowDefs("ta")}
      {edges.map(([p, c], i) => (
        <path key={i} d={curvePath(p, c)} fill="none" stroke={ACCT} strokeWidth={1.5} markerEnd="url(#ta)" />
      ))}
      {nodes.map((n, i) => {
        const isRoot = n === root;
        return (
          <g key={i}>
            <Rect x={n.x} y={n.y} w={TW} h={TH} fill={isRoot ? "#1e3a5f" : BG} stroke={isRoot ? accent : STR} />
            <Label x={n.x + TW / 2} y={n.y + (n.sub ? TH * 0.38 : TH / 2)} text={n.lbl} bold={isRoot} />
            {n.sub && <Label x={n.x + TW / 2} y={n.y + TH * 0.7} text={n.sub} fill={MUT} size={10} />}
          </g>
        );
      })}
      <Label x={nodes[0].x + TW / 2} y={nodes[0].y - 12} text={title} fill={MUT} size={10} mono={false} />
    </svg>
  );
};

// ── LinkedListSVG ─────────────────────────────────────────────────────────────

const LinkedListSVG: React.FC<{ items: any[]; doubly?: boolean }> = ({ items, doubly = false }) => {
  const BW = 82, BH = 44, AG = 48, NW = 40, PAD = 20;
  const W = PAD + NW + AG + items.length * (BW + AG) + NW + PAD;
  const H = BH + 50;
  const bx = (i: number) => PAD + NW + AG + i * (BW + AG);
  const by = PAD;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ minHeight: 120 }}>
      {arrowDefs("la")}
      {/* left null */}
      <Label x={PAD + NW / 2} y={by + BH / 2} text="null" fill={MUT} size={11} />
      {/* right null */}
      <Label x={PAD + NW + AG + items.length * (BW + AG) + NW / 2} y={by + BH / 2} text="null" fill={MUT} size={11} />

      {items.map((item, i) => (
        <g key={i}>
          <Rect x={bx(i)} y={by} w={BW} h={BH} fill={i === 0 ? "#1e3a5f" : BG} stroke={i === 0 ? ACC : STR} />
          <Label x={bx(i) + BW / 2} y={by + BH / 2} text={fmt(item)} />
          <Label x={bx(i) + BW / 2} y={by + BH + 14} text={`[${i}]`} fill={MUT} size={10} />

          {/* forward arrow → next box or null */}
          {i < items.length - 1 ? (
            <line
              x1={bx(i) + BW} y1={by + BH * (doubly ? 0.33 : 0.5)}
              x2={bx(i + 1)} y2={by + BH * (doubly ? 0.33 : 0.5)}
              stroke={ACCT} strokeWidth={1.5} markerEnd="url(#la)"
            />
          ) : (
            <line
              x1={bx(i) + BW} y1={by + BH * (doubly ? 0.33 : 0.5)}
              x2={bx(i) + BW + AG} y2={by + BH * (doubly ? 0.33 : 0.5)}
              stroke={ACCT} strokeWidth={1.5} markerEnd="url(#la)"
            />
          )}

          {/* backward arrow ← (doubly only) */}
          {doubly && i > 0 && (
            <line
              x1={bx(i)} y1={by + BH * 0.67}
              x2={bx(i - 1) + BW} y2={by + BH * 0.67}
              stroke={ACCT} strokeWidth={1.5} markerEnd="url(#la)"
            />
          )}
          {/* backward arrow from first box to null */}
          {doubly && i === 0 && (
            <line
              x1={bx(0)} y1={by + BH * 0.67}
              x2={PAD + NW} y2={by + BH * 0.67}
              stroke={ACCT} strokeWidth={1.5} markerEnd="url(#la)"
            />
          )}
        </g>
      ))}

      {/* type badge */}
      <Label x={W / 2} y={H - 8} text={doubly ? "std::list (doubly-linked)" : "std::forward_list (singly-linked)"} fill={MUT} size={10} mono={false} />
    </svg>
  );
};

// ── StackSVG ──────────────────────────────────────────────────────────────────

const StackSVG: React.FC<{ items: any[] }> = ({ items }) => {
  // items[0] = bottom, items[N-1] = top
  const reversed = [...items].reverse();
  const SW = 130, SH = 38, LW = 80, PAD = 20;
  const W = PAD + LW + 8 + SW + PAD;
  const H = PAD + reversed.length * SH + 40;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ minHeight: 120 }}>
      {arrowDefs("sa")}
      {/* push/pop arrows */}
      <text x={PAD + LW / 2} y={PAD + 10} textAnchor="middle" fill={GRN} fontSize={11} fontFamily="monospace">▼ push</text>
      <text x={PAD + LW / 2} y={PAD + reversed.length * SH + 20} textAnchor="middle" fill={ORG} fontSize={11} fontFamily="monospace">▲ pop</text>

      {reversed.map((item, i) => {
        const isTop = i === 0;
        const y = PAD + 20 + i * SH;
        return (
          <g key={i}>
            <Rect x={PAD + LW + 8} y={y} w={SW} h={SH} fill={isTop ? "#1e3a5f" : BG} stroke={isTop ? GRN : STR} />
            <Label x={PAD + LW + 8 + SW / 2} y={y + SH / 2} text={fmt(item)} bold={isTop} fill={isTop ? "#86efac" : TXT} />
            {isTop && <Label x={PAD + LW / 2} y={y + SH / 2} text="TOP →" fill={GRN} size={11} />}
          </g>
        );
      })}
      <Label x={W / 2} y={H - 6} text="std::stack (LIFO)" fill={MUT} size={10} mono={false} />
    </svg>
  );
};

// ── QueueSVG ──────────────────────────────────────────────────────────────────

const QueueSVG: React.FC<{ items: any[] }> = ({ items }) => {
  const BW = 82, BH = 46, LAB = 68, PAD = 20;
  const W = PAD + LAB + items.length * BW + LAB + PAD;
  const H = BH + 60;
  const bx = (i: number) => PAD + LAB + i * BW;
  const by = 20;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ minHeight: 120 }}>
      {arrowDefs("qa")}
      {/* direction labels */}
      <text x={PAD + LAB - 6} y={by + BH / 2 + 5} textAnchor="end" fill={GRN} fontSize={11} fontFamily="monospace">← dequeue</text>
      <text x={PAD + LAB + items.length * BW + 6} y={by + BH / 2 + 5} textAnchor="start" fill={ORG} fontSize={11} fontFamily="monospace">enqueue →</text>

      {items.map((item, i) => {
        const isFront = i === 0;
        const isBack = i === items.length - 1;
        return (
          <g key={i}>
            <Rect
              x={bx(i)} y={by} w={BW} h={BH} rx={0}
              fill={isFront ? "#162d1f" : isBack ? "#2d1a0e" : BG}
              stroke={isFront ? GRN : isBack ? ORG : STR}
            />
            <Label x={bx(i) + BW / 2} y={by + BH / 2} text={fmt(item)} fill={isFront ? "#86efac" : isBack ? "#fdba74" : TXT} bold={isFront || isBack} />
            {isFront && <Label x={bx(i) + BW / 2} y={by + BH + 14} text="FRONT" fill={GRN} size={10} />}
            {isBack && <Label x={bx(i) + BW / 2} y={by + BH + 14} text="BACK" fill={ORG} size={10} />}
          </g>
        );
      })}
      {/* outer border around all boxes */}
      {items.length > 0 && (
        <rect x={bx(0)} y={by} width={items.length * BW} height={BH} fill="none" stroke={MUT} strokeWidth={0.5} rx={0} />
      )}
      <Label x={W / 2} y={H - 6} text="std::queue (FIFO)" fill={MUT} size={10} mono={false} />
    </svg>
  );
};

// ── VectorSVG ─────────────────────────────────────────────────────────────────

const VectorSVG: React.FC<{ items: any[]; length: number; capacity?: number }> = ({ items, length, capacity }) => {
  const BW = 64, BH = 44, PAD = 24;
  const cap = Math.min(capacity ?? length, length + 6);
  const W = PAD + cap * BW + PAD;
  const H = BH + 56;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ minHeight: 120 }}>
      {Array.from({ length: cap }).map((_, i) => {
        const filled = i < length;
        const x = PAD + i * BW;
        return (
          <g key={i}>
            <Rect x={x} y={PAD} w={BW} h={BH} fill={filled ? BG : DIM} stroke={filled ? STR : DIM} />
            {filled
              ? <Label x={x + BW / 2} y={PAD + BH / 2} text={fmt(items[i])} />
              : <Label x={x + BW / 2} y={PAD + BH / 2} text="·" fill={MUT} />
            }
            {filled && <Label x={x + BW / 2} y={PAD + BH + 14} text={`[${i}]`} fill={MUT} size={10} />}
          </g>
        );
      })}
      {/* length marker */}
      {length < cap && (
        <>
          <line x1={PAD + length * BW} y1={PAD - 8} x2={PAD + length * BW} y2={PAD + BH + 8} stroke={ACC} strokeWidth={1} strokeDasharray="3,2" />
          <Label x={PAD + length * BW} y={PAD - 14} text={`size=${length}`} fill={ACCT} size={10} />
        </>
      )}
      {capacity != null && capacity > 0 && (
        <Label x={W / 2} y={H - 6} text={`std::vector  size=${length}  capacity=${capacity}`} fill={MUT} size={10} mono={false} />
      )}
      {capacity == null && (
        <Label x={W / 2} y={H - 6} text="array" fill={MUT} size={10} mono={false} />
      )}
    </svg>
  );
};

// ── DequeSVG ──────────────────────────────────────────────────────────────────

const DequeSVG: React.FC<{ items: any[]; size: number }> = ({ items, size }) => {
  const BW = 64, BH = 44, PAD = 24, LAB = 60;
  const W = PAD + LAB + items.length * BW + LAB + PAD;
  const H = BH + 54;
  const bx = (i: number) => PAD + LAB + i * BW;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ minHeight: 120 }}>
      {arrowDefs("da")}
      <text x={PAD + LAB - 6} y={PAD + BH / 2 + 5} textAnchor="end" fill={GRN} fontSize={11} fontFamily="monospace">FRONT</text>
      <text x={PAD + LAB + items.length * BW + 6} y={PAD + BH / 2 + 5} textAnchor="start" fill={ORG} fontSize={11} fontFamily="monospace">BACK</text>
      {items.map((item, i) => (
        <g key={i}>
          <Rect x={bx(i)} y={PAD} w={BW} h={BH}
            fill={i === 0 ? "#162d1f" : i === items.length - 1 ? "#2d1a0e" : BG}
            stroke={i === 0 ? GRN : i === items.length - 1 ? ORG : STR} />
          <Label x={bx(i) + BW / 2} y={PAD + BH / 2} text={fmt(item)} />
          <Label x={bx(i) + BW / 2} y={PAD + BH + 14} text={`[${i}]`} fill={MUT} size={10} />
        </g>
      ))}
      <Label x={W / 2} y={H - 6} text={`std::deque  size=${size}`} fill={MUT} size={10} mono={false} />
    </svg>
  );
};

// ── GridSVG — unordered containers ────────────────────────────────────────────

const GridSVG: React.FC<{ entries: Array<[string, any]>; type: string }> = ({ entries, type }) => {
  const COLS = 3, CW = 180, CH = 38, GAP = 6, PAD = 20;
  const rows = Math.ceil(entries.length / COLS);
  const W = PAD + COLS * (CW + GAP) - GAP + PAD;
  const H = PAD + rows * (CH + GAP) - GAP + PAD + 24;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ minHeight: 120 }}>
      {entries.map(([k, v], i) => {
        const col = i % COLS, row = Math.floor(i / COLS);
        const x = PAD + col * (CW + GAP);
        const y = PAD + row * (CH + GAP);
        const keyStr = String(k).length > 10 ? String(k).slice(0, 10) + "…" : String(k);
        const valStr = fmt(v);
        return (
          <g key={i}>
            <Rect x={x} y={y} w={CW} h={CH} />
            <Label x={x + CW * 0.38} y={y + CH / 2} text={keyStr} fill="#c084fc" size={11} />
            <text x={x + CW * 0.5} y={y + CH / 2} dominantBaseline="central" fill={MUT} fontSize={10}>→</text>
            <Label x={x + CW * 0.78} y={y + CH / 2} text={valStr} size={11} />
          </g>
        );
      })}
      <Label x={W / 2} y={H - 6} text={type} fill={MUT} size={10} mono={false} />
    </svg>
  );
};

// ── SetGridSVG — unordered_set ────────────────────────────────────────────────

const SetGridSVG: React.FC<{ items: any[]; type: string }> = ({ items, type }) => {
  const COLS = 5, CW = 90, CH = 38, GAP = 6, PAD = 20;
  const rows = Math.ceil(items.length / COLS);
  const W = PAD + COLS * (CW + GAP) - GAP + PAD;
  const H = PAD + rows * (CH + GAP) - GAP + PAD + 24;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ minHeight: 100 }}>
      {items.map((item, i) => {
        const col = i % COLS, row = Math.floor(i / COLS);
        const x = PAD + col * (CW + GAP);
        const y = PAD + row * (CH + GAP);
        return (
          <g key={i}>
            <Rect x={x} y={y} w={CW} h={CH} />
            <Label x={x + CW / 2} y={y + CH / 2} text={fmt(item)} />
          </g>
        );
      })}
      <Label x={W / 2} y={H - 6} text={type} fill={MUT} size={10} mono={false} />
    </svg>
  );
};

// ── PairSVG ───────────────────────────────────────────────────────────────────

const PairSVG: React.FC<{ first: any; second: any }> = ({ first, second }) => {
  const BW = 120, BH = 54, GAP = 4, PAD = 40;
  const W = PAD + BW + GAP + BW + PAD;
  const H = BH + 60;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ minHeight: 120 }}>
      <Rect x={PAD} y={PAD} w={BW} h={BH} stroke={ACC} />
      <Label x={PAD + BW / 2} y={PAD + BH * 0.32} text="first" fill={MUT} size={10} />
      <Label x={PAD + BW / 2} y={PAD + BH * 0.65} text={fmt(first)} bold />

      <Rect x={PAD + BW + GAP} y={PAD} w={BW} h={BH} stroke={ACC} />
      <Label x={PAD + BW + GAP + BW / 2} y={PAD + BH * 0.32} text="second" fill={MUT} size={10} />
      <Label x={PAD + BW + GAP + BW / 2} y={PAD + BH * 0.65} text={fmt(second)} bold />

      <Label x={W / 2} y={H - 8} text="std::pair" fill={MUT} size={10} mono={false} />
    </svg>
  );
};

// ── TupleSVG ──────────────────────────────────────────────────────────────────

const TupleSVG: React.FC<{ entries: Record<string, any> }> = ({ entries }) => {
  const BW = 100, BH = 54, GAP = 4, PAD = 30;
  const keys = Object.keys(entries);
  const W = PAD + keys.length * (BW + GAP) - GAP + PAD;
  const H = BH + 60;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ minHeight: 120 }}>
      {keys.map((k, i) => {
        const x = PAD + i * (BW + GAP);
        return (
          <g key={k}>
            <Rect x={x} y={PAD} w={BW} h={BH} stroke={ACC} />
            <Label x={x + BW / 2} y={PAD + BH * 0.3} text={`[${k}]`} fill={MUT} size={10} />
            <Label x={x + BW / 2} y={PAD + BH * 0.65} text={fmt(entries[k])} bold />
          </g>
        );
      })}
      <Label x={W / 2} y={H - 8} text="std::tuple" fill={MUT} size={10} mono={false} />
    </svg>
  );
};

// ── Empty placeholder ─────────────────────────────────────────────────────────

const EmptySVG: React.FC<{ label: string }> = ({ label }) => (
  <svg viewBox="0 0 300 100" width="100%" height="100%">
    <Label x={150} y={50} text={`${label}  [ empty ]`} fill={MUT} size={14} mono={false} />
  </svg>
);

// ── Dispatcher ────────────────────────────────────────────────────────────────

function renderContent(val: any): React.ReactNode {
  if (!val || typeof val !== "object") return <EmptySVG label="?" />;
  const t = val.type;

  if (t === "std::list") {
    const items = val.value ?? [];
    return items.length === 0 ? <EmptySVG label="list" /> : <LinkedListSVG items={items} doubly />;
  }
  if (t === "std::forward_list") {
    const items = val.value ?? [];
    return items.length === 0 ? <EmptySVG label="forward_list" /> : <LinkedListSVG items={items} />;
  }

  if (t === "std::stack") {
    const items = unwrap(val.wrapped);
    return items.length === 0 ? <EmptySVG label="stack" /> : <StackSVG items={items} />;
  }
  if (t === "std::queue") {
    const items = unwrap(val.wrapped);
    return items.length === 0 ? <EmptySVG label="queue" /> : <QueueSVG items={items} />;
  }

  if (t === "std::priority_queue") {
    const items = unwrap(val.wrapped);
    if (!items.length) return <EmptySVG label="priority_queue" />;
    const root = buildHeapTree(items);
    if (!root) return <EmptySVG label="priority_queue" />;
    treePlace(root, 0, 0);
    return <TreeSVG root={root} title="std::priority_queue  (max-heap layout: index 0 = root)" accent={ORG} />;
  }

  if (t === "std::vector" || t === "array") {
    const items = val.value ?? [];
    return <VectorSVG items={items} length={val.length ?? items.length} capacity={val.capacity} />;
  }
  if (t === "std::deque") {
    const items = val.value ?? [];
    return items.length === 0 ? <EmptySVG label="deque" /> : <DequeSVG items={items} size={val.size ?? items.length} />;
  }

  if (t === "std::map") {
    const entries = Object.entries(val.value ?? {});
    if (!entries.length) return <EmptySVG label="map" />;
    const bst = buildBSTTree(entries.map(([k, v]) => ({ lbl: k, sub: fmt(v) })));
    if (!bst) return <EmptySVG label="map" />;
    treePlace(bst, 0, 0);
    return <TreeSVG root={bst} title="std::map  (sorted BST layout)" accent="#a78bfa" />;
  }
  if (t === "std::unordered_map") {
    const entries = Object.entries(val.value ?? {});
    return entries.length === 0 ? <EmptySVG label="unordered_map" /> : <GridSVG entries={entries} type="std::unordered_map" />;
  }
  if (t === "std::set") {
    const items: any[] = val.value ?? [];
    if (!items.length) return <EmptySVG label="set" />;
    const bst = buildBSTTree(items.map(v => ({ lbl: fmt(v) })));
    if (!bst) return <EmptySVG label="set" />;
    treePlace(bst, 0, 0);
    return <TreeSVG root={bst} title="std::set  (sorted BST layout)" accent={GRN} />;
  }
  if (t === "std::unordered_set") {
    const items: any[] = val.value ?? [];
    return items.length === 0 ? <EmptySVG label="unordered_set" /> : <SetGridSVG items={items} type="std::unordered_set" />;
  }

  if (t === "std::pair") return <PairSVG first={val.first} second={val.second} />;
  if (t === "std::tuple") return <TupleSVG entries={val.value ?? {}} />;

  return <EmptySVG label={t ?? "?"} />;
}

// ── Main component ─────────────────────────────────────────────────────────────

interface ContainerVisualizerProps {
  variable: Variable;
  onClose: () => void;
}

const ContainerVisualizer: React.FC<ContainerVisualizerProps> = ({ variable, onClose }) => {
  const val = variable.value;
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true; lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    setPan(p => ({ x: p.x + e.clientX - lastPos.current.x, y: p.y + e.clientY - lastPos.current.y }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMouseUp = useCallback(() => { dragging.current = false; }, []);
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(3, Math.max(0.2, z * (e.deltaY < 0 ? 1.1 : 0.9))));
  }, []);

  const content = useMemo(() => renderContent(val), [val]);

  const typeLabel = (val?.type ?? "").replace("std::", "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex flex-col"
        style={{ width: "82vw", height: "78vh", maxWidth: 1200, maxHeight: 800 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold font-mono">{variable.name}</span>
            <span className="text-gray-400 text-sm">{typeLabel}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-xs">scroll = zoom · drag = pan</span>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div
          className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {content}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Export helpers ─────────────────────────────────────────────────────────────

const VISUALIZABLE_CONTAINER_TYPES = new Set([
  "std::vector", "std::deque",
  "std::list", "std::forward_list",
  "std::stack", "std::queue", "std::priority_queue",
  "std::map", "std::unordered_map",
  "std::set", "std::unordered_set",
  "std::pair", "std::tuple",
  "array",
]);

export function hasVisualizableContainer(value: any): boolean {
  return !!(value && typeof value === "object" && VISUALIZABLE_CONTAINER_TYPES.has(value.type));
}

export default ContainerVisualizer;
