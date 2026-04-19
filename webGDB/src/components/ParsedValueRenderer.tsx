// src/components/ParsedValueRenderer.tsx

import React, { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/solid";

interface Props {
  value: any;
  depth?: number;
}

const KNOWN_TYPES = new Set([
  "number", "char", "string", "pointer", "array",
  "std::vector", "std::list", "std::forward_list", "std::deque",
  "std::map", "std::unordered_map", "std::set", "std::unordered_set",
  "std::pair", "std::tuple", "std::stack", "std::priority_queue",
]);

function isTypedValue(v: any): boolean {
  return v && typeof v === "object" && typeof v.type === "string" && KNOWN_TYPES.has(v.type);
}

const Expand: React.FC<{ label: React.ReactNode; children: React.ReactNode; startOpen?: boolean }> = ({
  label,
  children,
  startOpen = false,
}) => {
  const [open, setOpen] = useState(startOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 hover:opacity-80"
      >
        {open ? (
          <ChevronDownIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRightIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
        )}
        {label}
      </button>
      {open && <div className="ml-5 border-l border-gray-700 pl-2 mt-1">{children}</div>}
    </div>
  );
};

const SequenceRenderer: React.FC<{ label: string; items: any[]; depth: number }> = ({
  label,
  items,
  depth,
}) => {
  if (items.length === 0) return <span className="text-gray-500">{label} {"[]"}</span>;
  return (
    <Expand label={<span className="text-cyan-400 font-mono text-sm">{label}</span>}>
      <ul className="space-y-0.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-1 text-sm">
            <span className="text-gray-500 font-mono">[{i}]</span>
            <ParsedValueRenderer value={item} depth={depth + 1} />
          </li>
        ))}
      </ul>
    </Expand>
  );
};

const MapRenderer: React.FC<{ label: string; entries: Record<string, any>; depth: number }> = ({
  label,
  entries,
  depth,
}) => {
  const keys = Object.keys(entries);
  if (keys.length === 0) return <span className="text-gray-500">{label} {"{}"}</span>;
  return (
    <Expand label={<span className="text-cyan-400 font-mono text-sm">{label}</span>}>
      <ul className="space-y-0.5">
        {keys.map((key) => (
          <li key={key} className="flex gap-1 text-sm">
            <span className="text-yellow-300 font-mono">[{key}]</span>
            <span className="text-gray-400">=</span>
            <ParsedValueRenderer value={entries[key]} depth={depth + 1} />
          </li>
        ))}
      </ul>
    </Expand>
  );
};

const StructRenderer: React.FC<{ fields: Record<string, any>; depth: number }> = ({
  fields,
  depth,
}) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) return <span className="text-gray-500">{"{}"}</span>;
  return (
    <Expand label={<span className="text-gray-300 font-mono text-sm">{"{ … }"}</span>}>
      <ul className="space-y-0.5">
        {keys.map((key) => (
          <li key={key} className="flex gap-1 items-start text-sm">
            <span className="text-purple-300 font-mono">{key}</span>
            <span className="text-gray-400">=</span>
            <ParsedValueRenderer value={fields[key]} depth={depth + 1} />
          </li>
        ))}
      </ul>
    </Expand>
  );
};

const ParsedValueRenderer: React.FC<Props> = ({ value, depth = 0 }) => {
  if (value === null || value === undefined) {
    return <span className="text-gray-500 font-mono text-sm">null</span>;
  }

  if (typeof value === "string") {
    return <span className="text-yellow-300 font-mono text-sm">"{value}"</span>;
  }

  if (typeof value === "number") {
    return <span className="text-blue-300 font-mono text-sm">{value}</span>;
  }

  if (!isTypedValue(value)) {
    // Plain composite object / struct from GDB — render fields
    return <StructRenderer fields={value} depth={depth} />;
  }

  const { type } = value;

  // ── Primitives ──────────────────────────────────────────────
  if (type === "number") {
    return <span className="text-blue-300 font-mono text-sm">{value.value}</span>;
  }

  if (type === "char") {
    return <span className="text-green-300 font-mono text-sm">'{value.value}'</span>;
  }

  if (type === "string") {
    return <span className="text-yellow-300 font-mono text-sm">"{value.value}"</span>;
  }

  // ── Pointers ─────────────────────────────────────────────────
  if (type === "pointer") {
    if (value.address === "0x0") {
      return <span className="text-gray-500 font-mono text-sm">nullptr</span>;
    }
    if (value.circular) {
      return (
        <span className="text-red-400 font-mono text-sm" title="Circular reference">
          ⟲ {value.address}
        </span>
      );
    }
    if (!value.dereferenced) {
      return <span className="text-orange-300 font-mono text-sm">{value.address}</span>;
    }
    return (
      <Expand
        label={
          <span className="text-orange-300 font-mono text-sm">
            → <span className="text-gray-400">{value.address}</span>
          </span>
        }
        startOpen={depth < 2}
      >
        <ParsedValueRenderer value={value.dereferenced} depth={depth + 1} />
      </Expand>
    );
  }

  // ── Arrays ───────────────────────────────────────────────────
  if (type === "array") {
    return <SequenceRenderer label={`array[${value.value.length}]`} items={value.value} depth={depth} />;
  }

  // ── std::vector ──────────────────────────────────────────────
  if (type === "std::vector") {
    return (
      <SequenceRenderer
        label={`vector[${value.length}]`}
        items={value.value}
        depth={depth}
      />
    );
  }

  // ── std::list / std::forward_list ────────────────────────────
  if (type === "std::list" || type === "std::forward_list") {
    const shortName = type === "std::list" ? "list" : "forward_list";
    return <SequenceRenderer label={`${shortName}[${value.value.length}]`} items={value.value} depth={depth} />;
  }

  // ── std::deque ───────────────────────────────────────────────
  if (type === "std::deque") {
    return <SequenceRenderer label={`deque[${value.size}]`} items={value.value} depth={depth} />;
  }

  // ── std::set / std::unordered_set ────────────────────────────
  if (type === "std::set" || type === "std::unordered_set") {
    const shortName = type === "std::set" ? "set" : "unordered_set";
    return <SequenceRenderer label={`${shortName}[${value.size}]`} items={value.value} depth={depth} />;
  }

  // ── std::map / std::unordered_map ────────────────────────────
  if (type === "std::map" || type === "std::unordered_map") {
    const shortName = type === "std::map" ? "map" : "unordered_map";
    return (
      <MapRenderer
        label={`${shortName}[${value.size}]`}
        entries={value.value}
        depth={depth}
      />
    );
  }

  // ── std::pair ────────────────────────────────────────────────
  if (type === "std::pair") {
    return (
      <Expand label={<span className="text-cyan-400 font-mono text-sm">pair</span>}>
        <div className="flex gap-1 text-sm">
          <span className="text-gray-500">first =</span>
          <ParsedValueRenderer value={value.first} depth={depth + 1} />
        </div>
        <div className="flex gap-1 text-sm">
          <span className="text-gray-500">second =</span>
          <ParsedValueRenderer value={value.second} depth={depth + 1} />
        </div>
      </Expand>
    );
  }

  // ── std::tuple ───────────────────────────────────────────────
  if (type === "std::tuple") {
    const entries = Object.entries(value.value as Record<string, any>);
    return (
      <Expand label={<span className="text-cyan-400 font-mono text-sm">tuple</span>}>
        {entries.map(([idx, v]) => (
          <div key={idx} className="flex gap-1 text-sm">
            <span className="text-gray-500">[{idx}] =</span>
            <ParsedValueRenderer value={v} depth={depth + 1} />
          </div>
        ))}
      </Expand>
    );
  }

  // ── std::stack / std::priority_queue ─────────────────────────
  if (type === "std::stack" || type === "std::priority_queue") {
    const shortName = type === "std::stack" ? "stack" : "priority_queue";
    return (
      <Expand label={<span className="text-cyan-400 font-mono text-sm">{shortName}</span>}>
        <ParsedValueRenderer value={value.wrapped} depth={depth + 1} />
      </Expand>
    );
  }

  // Fallback: render as plain object
  return <StructRenderer fields={value} depth={depth} />;
};

export default ParsedValueRenderer;
