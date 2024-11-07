// src/components/ParsedValueRenderer.tsx

import React, { useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";

interface ParsedValueRendererProps {
  value: any;
}

const ParsedValueRenderer: React.FC<ParsedValueRendererProps> = ({ value }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  const ArrowIcon: React.FC<{ isExpanded: boolean }> = ({ isExpanded }) => (
    <ChevronDownIcon
      className={`w-4 h-4 transition-transform duration-200 ${
        isExpanded ? "transform rotate-180" : ""
      }`}
      aria-hidden="true"
    />
  );

  const renderValue = () => {
    if (Array.isArray(value)) {
      const itemCount = value.length;
      return (
        <div>
          <div className="flex items-center">
            {itemCount > 0 && (
              <button
                onClick={toggleExpand}
                className="focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "Collapse Array" : "Expand Array"}
              >
                <ArrowIcon isExpanded={isExpanded} />
              </button>
            )}
            {isExpanded ? (
              <span className="ml-2">[</span>
            ) : (
              <span className="ml-2">
                [<span className="text-gray-500">…</span>]
              </span>
            )}
          </div>
          {isExpanded && (
            <>
              <ul className="ml-12 list-disc">
                {value.map((elem, idx) => (
                  <li key={idx}>
                    <ParsedValueRenderer value={elem} />
                  </li>
                ))}
              </ul>
              <div className="flex items-center">
                <span className="ml-6">]</span>
              </div>
            </>
          )}
        </div>
      );
    } else if (typeof value === "object" && value !== null) {
      const keyCount = Object.keys(value).length;
      return (
        <div>
          <div className="flex items-center">
            {keyCount > 0 && (
              <button
                onClick={toggleExpand}
                className="focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "Collapse Object" : "Expand Object"}
              >
                <ArrowIcon isExpanded={isExpanded} />
              </button>
            )}
            {isExpanded ? (
              <span className="ml-2">{`{`}</span>
            ) : (
              <span className="ml-2">
                {"{"}
                <span className="text-gray-500">…</span>
                {"}"}
              </span>
            )}
          </div>
          {isExpanded && (
            <>
              <ul className="ml-12 list-disc">
                {Object.entries(value).map(([key, val], idx) => (
                  <li key={idx}>
                    <strong>{key}</strong>: <ParsedValueRenderer value={val} />
                  </li>
                ))}
              </ul>
              <div className="flex items-center">
                <span className="ml-6">{`}`}</span>
              </div>
            </>
          )}
        </div>
      );
    } else {
      return String(value);
    }
  };

  return <>{renderValue()}</>;
};

export default ParsedValueRenderer;
