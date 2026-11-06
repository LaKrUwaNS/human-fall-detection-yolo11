"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Play, Square, Camera, AlertTriangle, CheckCircle, Activity } from "lucide-react";
import { Detection } from "@/types/detection";
import { DetectionService } from "@/services/detectionService";
import { drawDetectionOverlay } from "@/components/DetectionCanvas";

interface WebcamTabProps {
  confidence: number;
}

export const WebcamTab: React.FC<WebcamTabProps> = ({ confidence }) => {
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [fallDetected, setFallDetected] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(0);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isStreamingRef = useRef<boolean>(false);
  const isProcessingFrameRef = useRef<boolean>(false);
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(0);
  const processFrameRef = useRef<() => void>(() => {});

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const processFrame = useCallback(async () => {
    if (!isStreamingRef.current || !videoRef.current || !captureCanvasRef.current) {
      return;
    }

    const video = videoRef.current;
    if (video.readyState < 2 || isProcessingFrameRef.current) {
      if (isStreamingRef.current) {
        requestAnimationFrame(() => processFrameRef.current());
      }
      return;
    }

    isProcessingFrameRef.current = true;
    const captureCanvas = captureCanvasRef.current;
    const ctx = captureCanvas.getContext("2d");

    if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
      captureCanvas.width = video.videoWidth;
      captureCanvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

      captureCanvas.toBlob(
        async (blob) => {
          if (!blob) {
            isProcessingFrameRef.current = false;
            if (isStreamingRef.current) {
              requestAnimationFrame(() => processFrameRef.current());
            }
            return;
          }

          try {
            const data = await DetectionService.detectFrame(blob, confidence);
            setFallDetected(data.fall_detected);
            setLatencyMs(data.inference_ms);
            setDetections(data.detections);

            drawDetectionOverlay(
              canvasRef.current,
              data.detections,
              data.fall_detected,
              video.videoWidth,
              video.videoHeight
            );

            frameCountRef.current += 1;
            const now = performance.now();
            const elapsed = now - lastFpsTimeRef.current;
            if (elapsed >= 500) {
              const currentFps = (frameCountRef.current / elapsed) * 1000;
              setFps(Math.round(currentFps * 10) / 10);
              frameCountRef.current = 0;
              lastFpsTimeRef.current = now;
            }
          } catch (err) {
            console.error("Frame detection error:", err);
          } finally {
            isProcessingFrameRef.current = false;
            if (isStreamingRef.current) {
              requestAnimationFrame(() => processFrameRef.current());
            }
          }
        },
        "image/jpeg",
        0.85
      );
    } else {
      isProcessingFrameRef.current = false;
      if (isStreamingRef.current) {
        requestAnimationFrame(() => processFrameRef.current());
      }
    }
  }, [confidence]);

  useEffect(() => {
    processFrameRef.current = processFrame;
  }, [processFrame]);

  const startWebcam = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsStreaming(true);
        isStreamingRef.current = true;
        frameCountRef.current = 0;
        lastFpsTimeRef.current = performance.now();
        requestAnimationFrame(() => processFrameRef.current());
      }
    } catch (err: unknown) {
      console.error("Camera access failed:", err);
      setCameraError(
        err instanceof Error
          ? err.message
          : "Could not access camera. Please allow camera permissions in your browser."
      );
    }
  };

  const stopWebcam = () => {
    setIsStreaming(false);
    isStreamingRef.current = false;
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setFallDetected(false);
    setDetections([]);
    setFps(0);
    setLatencyMs(0);
  };

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
      {/* Viewport Card */}
      <div className="lg:col-span-3 flex flex-col gap-4">
        <div className="relative aspect-video bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
          {/* Top Real-time Alert Banner */}
          {isStreaming && (
            <div
              className={`absolute top-4 left-4 right-4 z-20 flex items-center justify-between px-4 py-2.5 rounded-xl backdrop-blur-md border transition-all ${
                fallDetected
                  ? "bg-red-600/90 border-red-500 text-white animate-pulse shadow-lg shadow-red-600/40"
                  : "bg-neutral-900/80 border-neutral-700/60 text-emerald-400"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {fallDetected ? (
                  <AlertTriangle className="w-5 h-5 text-white" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                )}
                <span className="font-bold text-sm tracking-wide">
                  {fallDetected ? "CRITICAL: FALL DETECTED!" : "NORMAL: NO FALL DETECTED"}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono font-medium text-neutral-300">
                <span>FPS: {fps}</span>
                <span>Latency: {latencyMs}ms</span>
                <span>Detections: {detections.length}</span>
              </div>
            </div>
          )}

          {/* Video and Overlay Canvas */}
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-contain ${!isStreaming ? "hidden" : ""}`}
          />
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none z-10 ${
              !isStreaming ? "hidden" : ""
            }`}
          />
          <canvas ref={captureCanvasRef} className="hidden" />

          {/* Inactive Standby State */}
          {!isStreaming && (
            <div className="flex flex-col items-center justify-center gap-4 text-neutral-500 p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center text-neutral-400 shadow-inner">
                <Camera className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-neutral-200">
                  Camera Feed Inactive
                </h3>
                <p className="text-xs text-neutral-400 mt-1 max-w-sm">
                  Click &quot;Start Real-Time Detection&quot; to initialize your camera
                  and run live YOLO11 fall inference.
                </p>
              </div>
              {cameraError && (
                <div className="text-xs text-red-400 bg-red-950/60 border border-red-800/60 px-4 py-2 rounded-lg max-w-md">
                  {cameraError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            {!isStreaming ? (
              <button
                onClick={startWebcam}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-lg shadow-emerald-600/30"
              >
                <Play className="w-4 h-4 fill-current" />
                Start Real-Time Detection
              </button>
            ) : (
              <button
                onClick={stopWebcam}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition shadow-lg shadow-red-600/30"
              >
                <Square className="w-4 h-4 fill-current" />
                Stop Feed
              </button>
            )}
          </div>

          <div className="text-xs text-neutral-400 flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isStreaming ? "bg-emerald-500 animate-pulse" : "bg-neutral-600"
              }`}
            />
            {isStreaming ? "Streaming Active" : "Camera Idle"}
          </div>
        </div>
      </div>

      {/* Sidebar Telemetry & Log Card */}
      <div className="flex flex-col gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-4">
          <h3 className="text-sm font-bold text-neutral-200 flex items-center gap-2 border-b border-neutral-800 pb-3">
            <Activity className="w-4 h-4 text-red-400" />
            Live Detection Stats
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-neutral-950/70 border border-neutral-800/80 p-3 rounded-xl">
              <span className="text-[11px] text-neutral-500 block">Status</span>
              <span
                className={`text-sm font-bold mt-0.5 block ${
                  fallDetected ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {fallDetected ? "Fall Detected" : "Normal"}
              </span>
            </div>

            <div className="bg-neutral-950/70 border border-neutral-800/80 p-3 rounded-xl">
              <span className="text-[11px] text-neutral-500 block">Frame Rate</span>
              <span className="text-sm font-bold text-neutral-200 mt-0.5 block font-mono">
                {fps} FPS
              </span>
            </div>

            <div className="bg-neutral-950/70 border border-neutral-800/80 p-3 rounded-xl">
              <span className="text-[11px] text-neutral-500 block">Inference</span>
              <span className="text-sm font-bold text-neutral-200 mt-0.5 block font-mono">
                {latencyMs} ms
              </span>
            </div>

            <div className="bg-neutral-950/70 border border-neutral-800/80 p-3 rounded-xl">
              <span className="text-[11px] text-neutral-500 block">Objects</span>
              <span className="text-sm font-bold text-neutral-200 mt-0.5 block font-mono">
                {detections.length}
              </span>
            </div>
          </div>

          {/* Detected Objects List */}
          <div className="flex flex-col gap-2 mt-2">
            <span className="text-xs font-semibold text-neutral-400">
              Predictions in Frame:
            </span>
            {detections.length === 0 ? (
              <div className="text-xs text-neutral-500 italic py-4 text-center bg-neutral-950/40 rounded-lg border border-neutral-800/40">
                No targets detected in current frame
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                {detections.map((det, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between text-xs p-2 rounded-lg border ${
                      det.is_fall
                        ? "bg-red-950/40 border-red-800/50 text-red-200"
                        : "bg-neutral-950/60 border-neutral-800 text-neutral-300"
                    }`}
                  >
                    <span className="font-medium">{det.class_name}</span>
                    <span className="font-mono font-bold">
                      {(det.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Model Details Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-3 text-xs">
          <h4 className="font-bold text-neutral-300">Model Details</h4>
          <div className="flex justify-between text-neutral-400 py-1 border-b border-neutral-800/60">
            <span>Architecture:</span>
            <span className="text-neutral-200 font-mono">YOLO11</span>
          </div>
          <div className="flex justify-between text-neutral-400 py-1 border-b border-neutral-800/60">
            <span>Weights:</span>
            <span className="text-neutral-200 font-mono">models/best.pt</span>
          </div>
          <div className="flex justify-between text-neutral-400 py-1 border-b border-neutral-800/60">
            <span>Inference Resolution:</span>
            <span className="text-neutral-200 font-mono">640x640</span>
          </div>
          <div className="flex justify-between text-neutral-400 py-1">
            <span>Target Class:</span>
            <span className="text-red-400 font-semibold font-mono">Fall-Detected</span>
          </div>
        </div>
      </div>
    </div>
  );
};

