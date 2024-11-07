// src/components/StackFrames.tsx

import React from "react";
import { Frame } from "../types";

interface StackFramesProps {
  stackFrames: Frame[];
}

const StackFrames: React.FC<StackFramesProps> = ({ stackFrames }) => {
  return (
    <div className="p-4 bg-gray-800 w-full">
      <h2 className="text-lg font-semibold mb-2">Stack Frames</h2>
      <table className="table-auto w-full text-left">
        <thead>
          <tr>
            <th className="px-4 py-2">#</th>
            <th className="px-4 py-2">Function</th>
            <th className="px-4 py-2">Address</th>
            <th className="px-4 py-2">File (line)</th>
          </tr>
        </thead>
        <tbody>
          {stackFrames.map((frame, index) => (
            <tr key={index}>
              <td className="border px-4 py-2">{index}</td>
              <td className="border px-4 py-2">{frame.func}</td>
              <td className="border px-4 py-2">{frame.addr}</td>
              <td className="border px-4 py-2">main.cpp:{frame.line}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StackFrames;
