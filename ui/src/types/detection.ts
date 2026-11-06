/**
 * TypeScript Type Definitions for Human Fall Detection System.
 */

export interface Detection {
  bbox: [number, number, number, number];
  confidence: number;
  class_id?: number;
  class_name: string;
  is_fall: boolean;
}

export interface FrameResponse {
  fall_detected: boolean;
  detections_count: number;
  inference_ms: number;
  detections: Detection[];
}

export interface VideoProcessResult {
  status: string;
  filename: string;
  download_url: string;
  total_frames: number;
  fall_frames: number;
  fall_rate_pct: number;
  video_fps: number;
  resolution: string;
  processing_time_sec: number;
}

export interface SystemStatus {
  model_loaded: boolean;
  device: string;
  classes: Record<string, string>;
  confidence_threshold: number;
}

export type DetectionMode = "webcam" | "video";

