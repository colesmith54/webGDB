// src/components/Variables.tsx

import React from "react";
import ParsedValueRenderer from "./ParsedValueRenderer";
import { Variable } from "../types";

interface VariablesProps {
  variables: Variable[];
}

const Variables: React.FC<VariablesProps> = ({ variables }) => {
  return (
    <div className="p-4 bg-gray-800 w-full text-white">
      <h2 className="text-lg font-semibold mb-2">Variables</h2>
      <ul>
        {variables.map((variable, index) => (
          <li key={index} className="border-b border-gray-700 py-2">
            <div>
              <span className="font-mono">
                {variable.name}: ({variable.type})
              </span>
            </div>
            <ParsedValueRenderer value={variable.value} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Variables;
