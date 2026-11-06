import { SystemStatus, FrameResponse, VideoProcessResult } from "@/types/detection";

// Fallback checking both localhost and 127.0.0.1 for maximum browser compatibility
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

export class DetectionService {
  /**
   * Fetches backend engine status and hardware information.
   */
  static async getStatus(): Promise<SystemStatus> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/status`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch status: ${res.statusText}`);
      }
      return res.json();
    } catch {
      // Fallback try localhost if 127.0.0.1 fails
      const fallbackUrl = "http://localhost:8000";
      const res = await fetch(`${fallbackUrl}/api/status`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to fetch status: ${res.statusText}`);
      }
      return res.json();
    }
  }

  /**
   * Sends a single image blob for YOLO11 inference.
   */
  static async detectFrame(imageBlob: Blob, confidence: number): Promise<FrameResponse> {
    const formData = new FormData();
    formData.append("file", imageBlob, "frame.jpg");
    formData.append("confidence", confidence.toString());

    let res: Response;
    try {
      res = await fetch(`${BACKEND_URL}/api/detect/frame`, {
        method: "POST",
        body: formData,
      });
    } catch {
      // Retry via localhost if connection refused on 127.0.0.1
      res = await fetch("http://localhost:8000/api/detect/frame", {
        method: "POST",
        body: formData,
      });
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Frame detection failed");
    }

    return res.json();
  }

  /**
   * Uploads and processes a full video file, returning the result summary and download link.
   */
  static async processVideo(videoFile: File, confidence: number): Promise<VideoProcessResult> {
    const formData = new FormData();
    formData.append("file", videoFile);
    formData.append("confidence", confidence.toString());

    let res: Response;
    try {
      res = await fetch(`${BACKEND_URL}/api/detect/video`, {
        method: "POST",
        body: formData,
      });
    } catch (networkErr: unknown) {
      // Attempt fallback to localhost:8000
      try {
        res = await fetch("http://localhost:8000/api/detect/video", {
          method: "POST",
          body: formData,
        });
      } catch {
        const msg = networkErr instanceof Error ? networkErr.message : "Connection refused";
        throw new Error(
          `Cannot connect to backend server at ${BACKEND_URL} (${msg}). Please verify that the FastAPI backend is running.`
        );
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Video processing failed on server");
    }

    return res.json();
  }

  /**
   * Constructs the absolute download URL for a processed video.
   */
  static getDownloadUrl(relativeUrl: string): string {
    if (relativeUrl.startsWith("http")) return relativeUrl;
    return `${BACKEND_URL}${relativeUrl}`;
  }
}
