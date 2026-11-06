"use client";

import React from "react";
import { ShieldAlert, Cpu, Layers, Settings } from "lucide-react";
import { SystemStatus } from "@/types/detection";

interface HeaderProps {
  systemStatus: SystemStatus | null;
  confidence: number;
  onConfidenceChange: (conf: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  systemStatus,
  confidence,
  onConfidenceChange,
}) => {
  return (
    <header className="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur px-6 py-3.5 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-red-600 to-amber-500 flex items-center justify-center shadow-lg shadow-red-500/20">
          <ShieldAlert className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            Human Fall Detection
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              YOLO11
            </span>
          </h1>
          <p className="text-xs text-neutral-400">
            OpenCV &amp; Next.js AI Vision Real-Time Monitoring
          </p>
        </div>
      </div>

      {/* Global Controls & Status */}
      <div className="flex items-center gap-5">
        {/* Hardware Device Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800/80 border border-neutral-700/60 text-xs">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span className="text-neutral-400">Device:</span>
          <span className="font-semibold text-neutral-200 uppercase">
            {systemStatus?.device || "CPU"}
          </span>
        </div>

        {/* Model Status Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800/80 border border-neutral-700/60 text-xs">
          <Layers className="w-4 h-4 text-blue-400" />
          <span className="text-neutral-400">Target:</span>
          <span className="font-semibold text-neutral-200">Fall-Detected</span>
        </div>

        {/* Confidence Slider */}
        <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-lg bg-neutral-800/80 border border-neutral-700/60 text-xs">
          <Settings className="w-4 h-4 text-neutral-400" />
          <span className="text-neutral-300 font-medium whitespace-nowrap">
            Conf: {(confidence * 100).toFixed(0)}%
          </span>
          <input
            type="range"
            min="0.10"
            max="0.95"
            step="0.05"
            value={confidence}
            onChange={(e) => onConfidenceChange(parseFloat(e.target.value))}
            className="w-20 sm:w-28 accent-red-500 cursor-pointer"
          />
        </div>
      </div>
    </header>
  );
};

