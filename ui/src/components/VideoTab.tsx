"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  FileVideo,
  Upload,
  Play,
  Square,
  Sparkles,
  Download,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { Detection, VideoProcessResult } from "@/types/detection";
import { DetectionService } from "@/services/detectionService";
import { drawDetectionOverlay } from "@/components/DetectionCanvas";

interface VideoTabProps {
  confidence: number;
}

export const VideoTab: React.FC<VideoTabProps> = ({ confidence }) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [isProcessingVideo, setIsProcessingVideo] = useState<boolean>(false);
  const [videoResult, setVideoResult] = useState<VideoProcessResult | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Live in-browser interactive testing state
  const [isLiveVideoTesting, setIsLiveVideoTesting] = useState<boolean>(false);
  const [liveFallDetected, setLiveFallDetected] = useState<boolean>(false);
  const [liveDetections, setLiveDetections] = useState<Detection[]>([]);
  const [liveFps, setLiveFps] = useState<number>(0);
  const [liveLatencyMs, setLiveLatencyMs] = useState<number>(0);

  const interactiveVideoRef = useRef<HTMLVideoElement | null>(null);
  const interactiveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const interactiveCaptureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isLiveVideoTestingRef = useRef<boolean>(false);
  const isLiveProcessingFrameRef = useRef<boolean>(false);
  const liveFrameCountRef = useRef<number>(0);
  const liveLastFpsTimeRef = useRef<number>(0);
  const processLiveFrameRef = useRef<() => void>(() => {});

  useEffect(() => {
    isLiveVideoTestingRef.current = isLiveVideoTesting;
  }, [isLiveVideoTesting]);

  const processLiveFrame = useCallback(async () => {
    if (!isLiveVideoTestingRef.current || !interactiveVideoRef.current || !interactiveCaptureCanvasRef.current) {
      return;
    }

    const video = interactiveVideoRef.current;
    if (video.paused || video.ended || video.readyState < 2 || isLiveProcessingFrameRef.current) {
      if (isLiveVideoTestingRef.current) {
        requestAnimationFrame(() => processLiveFrameRef.current());
      }
      return;
    }

    isLiveProcessingFrameRef.current = true;
    const captureCanvas = interactiveCaptureCanvasRef.current;
    const ctx = captureCanvas.getContext("2d");

    if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
      captureCanvas.width = video.videoWidth;
      captureCanvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

      captureCanvas.toBlob(
        async (blob) => {
          if (!blob) {
            isLiveProcessingFrameRef.current = false;
            if (isLiveVideoTestingRef.current) {
              requestAnimationFrame(() => processLiveFrameRef.current());
            }
            return;
          }

          try {
            const data = await DetectionService.detectFrame(blob, confidence);
            setLiveFallDetected(data.fall_detected);
            setLiveLatencyMs(data.inference_ms);
            setLiveDetections(data.detections);

            drawDetectionOverlay(
              interactiveCanvasRef.current,
              data.detections,
              data.fall_detected,
              video.videoWidth,
              video.videoHeight
            );

            liveFrameCountRef.current += 1;
            const now = performance.now();
            const elapsed = now - liveLastFpsTimeRef.current;
            if (elapsed >= 500) {
              const currentFps = (liveFrameCountRef.current / elapsed) * 1000;
              setLiveFps(Math.round(currentFps * 10) / 10);
              liveFrameCountRef.current = 0;
              liveLastFpsTimeRef.current = now;
            }
          } catch (err) {
            console.error("Live video inference error:", err);
          } finally {
            isLiveProcessingFrameRef.current = false;
            if (isLiveVideoTestingRef.current) {
              requestAnimationFrame(() => processLiveFrameRef.current());
            }
          }
        },
        "image/jpeg",
        0.85
      );
    } else {
      isLiveProcessingFrameRef.current = false;
      if (isLiveVideoTestingRef.current) {
        requestAnimationFrame(() => processLiveFrameRef.current());
      }
    }
  }, [confidence]);

  useEffect(() => {
    processLiveFrameRef.current = processLiveFrame;
  }, [processLiveFrame]);

  const startLiveDetection = () => {
    if (!interactiveVideoRef.current) return;
    interactiveVideoRef.current.play();
    setIsLiveVideoTesting(true);
    isLiveVideoTestingRef.current = true;
    liveFrameCountRef.current = 0;
    liveLastFpsTimeRef.current = performance.now();
    requestAnimationFrame(() => processLiveFrameRef.current());
  };

  const stopLiveDetection = () => {
    setIsLiveVideoTesting(false);
    isLiveVideoTestingRef.current = false;
    if (interactiveVideoRef.current) {
      interactiveVideoRef.current.pause();
    }
    if (interactiveCanvasRef.current) {
      const ctx = interactiveCanvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, interactiveCanvasRef.current.width, interactiveCanvasRef.current.height);
    }
    setLiveFallDetected(false);
    setLiveDetections([]);
    setLiveFps(0);
    setLiveLatencyMs(0);
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVideoFile(file);
      setVideoPreviewUrl(URL.createObjectURL(file));
      setVideoResult(null);
      setVideoError(null);
      stopLiveDetection();
    }
  };

  const handleProcessVideo = async () => {
    if (!videoFile) return;

    setIsProcessingVideo(true);
    setVideoError(null);
    setVideoResult(null);
    stopLiveDetection();

    try {
      const result = await DetectionService.processVideo(videoFile, confidence);
      setVideoResult(result);
    } catch (err: unknown) {
      console.error(err);
      setVideoError(
        err instanceof Error ? err.message : "Error uploading or processing video."
      );
    } finally {
      setIsProcessingVideo(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
      {/* Upload & Configuration Card */}
      <div className="lg:col-span-1 flex flex-col gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
          <h3 className="text-sm font-bold text-neutral-200 flex items-center gap-2 border-b border-neutral-800 pb-3">
            <FileVideo className="w-4 h-4 text-amber-400" />
            Upload Video File
          </h3>

          {/* Drag & Drop Input */}
          <label className="border-2 border-dashed border-neutral-700 hover:border-red-500/60 bg-neutral-950/60 rounded-xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition group">
            <Upload className="w-8 h-8 text-neutral-400 group-hover:text-red-400 transition" />
            <div className="text-center">
              <span className="text-xs font-semibold text-neutral-200 block">
                Choose video file or drag here
              </span>
              <span className="text-[11px] text-neutral-500 block mt-0.5">
                Supports MP4, AVI, MOV, MKV
              </span>
            </div>
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoSelect}
              className="hidden"
            />
          </label>

          {videoFile && (
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 flex items-center justify-between text-xs">
              <div className="truncate max-w-50">
                <span className="font-semibold text-neutral-200 block truncate">
                  {videoFile.name}
                </span>
                <span className="text-neutral-500 text-[11px]">
                  {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
              <span className="text-emerald-400 font-semibold text-[11px]">Ready</span>
            </div>
          )}

          {videoError && (
            <div className="text-xs text-red-400 bg-red-950/60 border border-red-800/60 p-3 rounded-xl">
              {videoError}
            </div>
          )}

          {/* Real-time Browser Playback Detection */}
          {videoPreviewUrl && (
            <div className="flex flex-col gap-2 pt-2 border-t border-neutral-800">
              <button
                onClick={isLiveVideoTesting ? stopLiveDetection : startLiveDetection}
                disabled={isProcessingVideo}
                className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition shadow-lg ${
                  isLiveVideoTesting
                    ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30"
                }`}
              >
                {isLiveVideoTesting ? (
                  <>
                    <Square className="w-4 h-4 fill-current" />
                    Stop Live Video Detection
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Watch Video in Real-Time (Live AI)
                  </>
                )}
              </button>
              <span className="text-[11px] text-neutral-400 text-center">
                Play and watch bounding boxes detect falls live as video plays!
              </span>
            </div>
          )}

          {/* Server-side Full Video Processing & Export */}
          <div className="flex flex-col gap-2 pt-2 border-t border-neutral-800">
            <button
              onClick={handleProcessVideo}
              disabled={!videoFile || isProcessingVideo || isLiveVideoTesting}
              className={`w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition ${
                !videoFile || isProcessingVideo || isLiveVideoTesting
                  ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                  : "bg-red-600/80 hover:bg-red-600 text-white shadow-lg shadow-red-600/20"
              }`}
            >
              {isProcessingVideo ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing &amp; Burning Video...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Burn HUD &amp; Export Annotated Video
                </>
              )}
            </button>
          </div>
        </div>

        {/* Processing Results Summary */}
        {videoResult && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
            <h4 className="text-sm font-bold text-neutral-200 flex items-center gap-2 border-b border-neutral-800 pb-3">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              Detection Report
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800/80">
                <span className="text-neutral-500 block text-[11px]">Total Frames</span>
                <span className="font-mono font-bold text-neutral-200 text-sm">
                  {videoResult.total_frames}
                </span>
              </div>

              <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800/80">
                <span className="text-neutral-500 block text-[11px]">Fall Frames</span>
                <span className="font-mono font-bold text-red-400 text-sm">
                  {videoResult.fall_frames}
                </span>
              </div>

              <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800/80">
                <span className="text-neutral-500 block text-[11px]">Fall Percentage</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {videoResult.fall_rate_pct}%
                </span>
              </div>

              <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800/80">
                <span className="text-neutral-500 block text-[11px]">Process Duration</span>
                <span className="font-mono font-bold text-neutral-200 text-sm">
                  {videoResult.processing_time_sec}s
                </span>
              </div>
            </div>

            <a
              href={DetectionService.getDownloadUrl(videoResult.download_url)}
              download
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/30"
            >
              <Download className="w-4 h-4" />
              Download Annotated Video ({videoResult.filename})
            </a>
          </div>
        )}
      </div>

      {/* Video Viewport & Real-time Live Canvas Overlay */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        <div className="aspect-video bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center relative">
          {videoResult ? (
            <div className="w-full h-full flex flex-col">
              <div className="bg-neutral-950 px-4 py-2 border-b border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
                <span>Annotated Video Result (Burned HUD &amp; Boxes)</span>
                <span className="text-emerald-400 font-semibold">Processed Successfully</span>
              </div>
              <video
                controls
                autoPlay
                src={DetectionService.getDownloadUrl(videoResult.download_url)}
                className="w-full h-full object-contain bg-black"
              />
            </div>
          ) : videoPreviewUrl ? (
            <div className="w-full h-full flex flex-col relative">
              <div className="bg-neutral-950 px-4 py-2 border-b border-neutral-800 flex items-center justify-between text-xs text-neutral-400 z-20">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-neutral-300">Video Player</span>
                  {isLiveVideoTesting && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Live Inference Active
                    </span>
                  )}
                </div>
                <span className="text-neutral-400">
                  {isLiveVideoTesting ? `${liveFps} FPS | Latency: ${liveLatencyMs}ms` : "Ready to play"}
                </span>
              </div>

              {/* Real-time Alert Banner during Video Playback */}
              {isLiveVideoTesting && (
                <div
                  className={`absolute top-12 left-4 right-4 z-30 flex items-center justify-between px-4 py-2 rounded-xl backdrop-blur-md border transition-all ${
                    liveFallDetected
                      ? "bg-red-600/90 border-red-500 text-white animate-pulse shadow-lg shadow-red-600/40"
                      : "bg-neutral-900/80 border-neutral-700/60 text-emerald-400"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {liveFallDetected ? (
                      <AlertTriangle className="w-4 h-4 text-white" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    )}
                    <span className="font-bold text-xs tracking-wide">
                      {liveFallDetected ? "CRITICAL: FALL DETECTED IN VIDEO!" : "NORMAL: NO FALL DETECTED"}
                    </span>
                  </div>

                    <div className="flex items-center gap-3 text-[11px] font-mono font-medium text-neutral-200">
                      <span>Targets: {liveDetections.length}</span>
                    </div>
                </div>
              )}

              <div className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center bg-black">
                <video
                  ref={interactiveVideoRef}
                  controls
                  playsInline
                  src={videoPreviewUrl}
                  onPlay={() => {
                    if (!isLiveVideoTesting) {
                      startLiveDetection();
                    }
                  }}
                  onPause={() => {
                    if (isLiveVideoTesting) {
                      stopLiveDetection();
                    }
                  }}
                  className="w-full h-full object-contain"
                />
                <canvas
                  ref={interactiveCanvasRef}
                  className={`absolute inset-0 w-full h-full object-contain pointer-events-none z-10 ${
                    !isLiveVideoTesting ? "hidden" : ""
                  }`}
                />
                <canvas ref={interactiveCaptureCanvasRef} className="hidden" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 text-neutral-500 p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center text-neutral-400">
                <FileVideo className="w-8 h-8" />
              </div>
              <p className="text-xs text-neutral-400">
                Upload a video to preview and watch fall detection live in real time
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

