// src/components/DebugControls.tsx

import React from "react";

interface DebugControlsProps {
  onResume: () => void;
  onNext: () => void;
  onStepIn: () => void;
  onStepOver: () => void;
  onExit: () => void;
  isRunning: boolean;
}

const DebugControls: React.FC<DebugControlsProps> = ({
  onResume,
  onNext,
  onStepIn,
  onStepOver,
  onExit,
  isRunning,
}) => {
  return (
    <div className="p-4 flex space-x-2">
      <div className="flex space-x-4 flex-grow">
        <button
          className="btn btn-primary"
          onClick={onResume}
          disabled={isRunning}
        >
          Resume
        </button>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={isRunning}
        >
          Next
        </button>
        <button
          className="btn btn-primary"
          onClick={onStepIn}
          disabled={isRunning}
        >
          Step In
        </button>
        <button
          className="btn btn-primary"
          onClick={onStepOver}
          disabled={isRunning}
        >
          Step Over
        </button>
      </div>

      <button
        className="btn btn-secondary ml-auto"
        onClick={onExit}
        disabled={isRunning}
      >
        Exit
      </button>
    </div>
  );
};

export default DebugControls;
