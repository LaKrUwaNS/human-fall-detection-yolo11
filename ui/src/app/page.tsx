"use client";

import React, { useState, useEffect } from "react";
import { Camera, Video } from "lucide-react";
import { SystemStatus, DetectionMode } from "@/types/detection";
import { DetectionService } from "@/services/detectionService";
import { Header } from "@/components/Header";
import { WebcamTab } from "@/components/WebcamTab";
import { VideoTab } from "@/components/VideoTab";

export default function Home() {
  const [activeTab, setActiveTab] = useState<DetectionMode>("webcam");
  const [confidence, setConfidence] = useState<number>(0.5);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  // Poll system status on initial mount
  useEffect(() => {
    DetectionService.getStatus()
      .then((data) => setSystemStatus(data))
      .catch((err) => console.log("Backend not yet connected:", err));
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col">
      {/* Top Navigation Bar Component */}
      <Header
        systemStatus={systemStatus}
        confidence={confidence}
        onConfidenceChange={setConfidence}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* Mode Selector Tabs */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2 bg-neutral-900 p-1.5 rounded-xl border border-neutral-800">
            <button
              onClick={() => setActiveTab("webcam")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "webcam"
                  ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
              }`}
            >
              <Camera className="w-4 h-4" />
              1. Real-Time Webcam
            </button>
            <button
              onClick={() => setActiveTab("video")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "video"
                  ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
              }`}
            >
              <Video className="w-4 h-4" />
              2. Video File Detection
            </button>
          </div>
        </div>

        {/* Tab Views */}
        {activeTab === "webcam" && <WebcamTab confidence={confidence} />}
        {activeTab === "video" && <VideoTab confidence={confidence} />}
      </main>
    </div>
  );
}
