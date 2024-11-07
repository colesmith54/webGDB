// src/components/ParsedValueRenderer.tsx

import React, { useState } from "react";

interface ParsedValueRendererProps {
  value: any;
}

const ParsedValueRenderer: React.FC<ParsedValueRendererProps> = ({ value }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  const renderValue = () => {
    if (Array.isArray(value)) {
      // Handle arrays
      return (
        <div className="ml-4">
          <span>[</span>
          {isExpanded && (
            <ul className="ml-4 list-disc">
              {value.map((elem, idx) => (
                <li key={idx}>
                  <ParsedValueRenderer value={elem} />
                </li>
              ))}
            </ul>
          )}
          <span>]</span>
          {value.length > 0 && (
            <button onClick={toggleExpand} className="ml-2 text-blue-400">
              {isExpanded ? "Collapse" : "Expand"}
            </button>
          )}
        </div>
      );
    } else if (typeof value === "object" && value !== null) {
      // Handle objects
      return (
        <div className="ml-4">
          <span>{"{"}</span>
          {isExpanded && (
            <ul className="ml-4 list-disc">
              {Object.entries(value).map(([key, val], idx) => (
                <li key={idx}>
                  <strong>{key}</strong>: <ParsedValueRenderer value={val} />
                </li>
              ))}
            </ul>
          )}
          <span>{"}"}</span>
          {Object.keys(value).length > 0 && (
            <button onClick={toggleExpand} className="ml-2 text-blue-400">
              {isExpanded ? "Collapse" : "Expand"}
            </button>
          )}
        </div>
      );
    } else {
      return <span>{String(value)}</span>;
    }
  };

  return <>{renderValue()}</>;
};

export default ParsedValueRenderer;
