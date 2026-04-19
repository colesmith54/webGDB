// src/components/Variables.tsx

import React from "react";
import ParsedValueRenderer from "./ParsedValueRenderer";
import { Variable } from "../types";
import { hasVisualizablePointer } from "./GraphVisualizer";
import { ChartBarIcon } from "@heroicons/react/24/solid";

interface VariablesProps {
  variables: Variable[];
  onVisualize: (variable: Variable) => void;
}

function friendlyType(type: string): string {
  if (!type || type === "unknown") return "";
  const short: Record<string, string> = {
    "std::vector": "vector",
    "std::list": "list",
    "std::forward_list": "forward_list",
    "std::deque": "deque",
    "std::map": "map",
    "std::unordered_map": "unordered_map",
    "std::set": "set",
    "std::unordered_set": "unordered_set",
    "std::pair": "pair",
    "std::tuple": "tuple",
    "std::stack": "stack",
    "std::priority_queue": "priority_queue",
    number: "int",
    char: "char",
    string: "string",
    pointer: "ptr",
    array: "array",
  };
  return short[type] ?? type;
}

const Variables: React.FC<VariablesProps> = ({ variables, onVisualize }) => {
  return (
    <div className="p-4 bg-gray-800 w-full text-white">
      <h2 className="text-lg font-semibold mb-2 text-gray-200">Variables</h2>
      <ul className="space-y-1">
        {variables.map((variable, index) => {
          const canVisualize = hasVisualizablePointer(variable.value);
          const typeLabel = friendlyType(variable.type);
          return (
            <li key={index} className="border-b border-gray-700 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-sm">
                  <span className="text-purple-300">{variable.name}</span>
                  {typeLabel && (
                    <span className="text-gray-500 ml-1">: {typeLabel}</span>
                  )}
                </span>
                {canVisualize && (
                  <button
                    onClick={() => onVisualize(variable)}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                    title="Visualize pointer structure"
                  >
                    <ChartBarIcon className="w-3 h-3" />
                    Visualize
                  </button>
                )}
              </div>
              <div className="ml-2">
                <ParsedValueRenderer value={variable.value} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default Variables;
