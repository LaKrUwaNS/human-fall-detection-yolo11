"""
FastAPI Server for Human Fall Detection System.
Provides endpoints for:
1. Real-time webcam frame processing via HTTP POST / WebSocket
2. Non-blocking asynchronous video file processing & H.264 MP4 export
3. Downsampling / frame stride for long videos
4. Downloadable annotated video files
5. System health and hardware status
"""
import asyncio
import io
import os
import shutil
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Dict, Any, List

import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from config import DetectionConfig
from src.detector import FallDetector
from src.utils import draw_detections, draw_hud, FPSCounter

app = FastAPI(
    title="Human Fall Detection API",
    description="Backend API powering the Next.js Fall Detection Web UI",
    version="1.3.0",
)

# Enable CORS for Next.js frontend (ports 3000, 3001, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dedicated worker threadpool for long-running CPU/GPU video inference
EXECUTOR = ThreadPoolExecutor(max_workers=2)

# Global model instance
CONFIG = DetectionConfig(
    model_path=Path("models/best.pt"),
    confidence_threshold=0.50,
    output_dir=Path("outputs"),
)

try:
    DETECTOR = FallDetector(config=CONFIG)
    print(f"[API] Initialized FallDetector successfully on {DETECTOR.device}")
except Exception as e:
    print(f"[API ERROR] Failed to load FallDetector: {e}")
    DETECTOR = None


class SystemStatus(BaseModel):
    model_loaded: bool
    device: str
    classes: Dict[int, str]
    confidence_threshold: float


class DetectionBox(BaseModel):
    bbox: List[int] = Field(..., description="[x1, y1, x2, y2]")
    confidence: float
    class_id: int
    class_name: str
    is_fall: bool


class FrameResponse(BaseModel):
    fall_detected: bool
    detections_count: int
    inference_ms: float
    detections: List[DetectionBox]


class VideoResult(BaseModel):
    status: str
    filename: str
    download_url: str
    total_frames: int
    processed_frames: int
    fall_frames: int
    fall_rate_pct: float
    video_fps: float
    resolution: str
    processing_time_sec: float


@app.get("/api/status", response_model=SystemStatus)
def get_status() -> SystemStatus:
    """Returns current detection engine status and hardware info."""
    if DETECTOR is None:
        return SystemStatus(
            model_loaded=False,
            device="none",
            classes={},
            confidence_threshold=CONFIG.confidence_threshold,
        )
    return SystemStatus(
        model_loaded=True,
        device=str(DETECTOR.device),
        classes=DETECTOR.class_names,
        confidence_threshold=CONFIG.confidence_threshold,
    )


@app.post("/api/detect/frame", response_model=FrameResponse)
async def detect_frame(
    file: UploadFile = File(...),
    confidence: float = Form(0.50),
) -> FrameResponse:
    """
    Accepts a single camera image frame, executes YOLO11 inference in threadpool,
    and returns bounding boxes, labels, confidence scores, and fall status.
    """
    if DETECTOR is None:
        raise HTTPException(status_code=500, detail="Model is not loaded")

    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image file or format")

    loop = asyncio.get_running_loop()

    start_time = time.perf_counter()
    # Run inference in worker threadpool to keep the async event loop responsive
    detections, fall_detected = await loop.run_in_executor(
        EXECUTOR,
        DETECTOR.detect,
        frame,
        confidence,
    )
    inference_ms = (time.perf_counter() - start_time) * 1000.0

    boxes_out = [
        DetectionBox(
            bbox=[det.bbox[0], det.bbox[1], det.bbox[2], det.bbox[3]],
            confidence=round(det.confidence, 3),
            class_id=det.class_id,
            class_name=det.class_name,
            is_fall=det.is_fall,
        )
        for det in detections
    ]

    return FrameResponse(
        fall_detected=fall_detected,
        detections_count=len(detections),
        inference_ms=round(inference_ms, 1),
        detections=boxes_out,
    )


def _process_video_sync(
    video_path: Path,
    output_path: Path,
    confidence: float,
    max_frames: int = 1500,  # Safety cap for uploaded videos to prevent infinite processing
) -> Dict[str, Any]:
    """
    Synchronous video processing function executed in worker threadpool.
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError("Could not open video file")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    if fps <= 0:
        fps = 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    fps_counter = FPSCounter()
    processed_count = 0
    fall_frames_count = 0
    start_processing_time = time.perf_counter()

    # Determine frame stride for long videos
    # If video > 600 frames on CPU, sample every 2nd or 3rd frame to ensure quick feedback
    frame_stride = 1
    if total_frames > 1200:
        frame_stride = 3
    elif total_frames > 600:
        frame_stride = 2

    # Streaming H.264 writer
    use_imageio = False
    writer = None
    try:
        import imageio.v2 as imageio
        writer = imageio.get_writer(
            str(output_path),
            fps=fps / frame_stride,
            codec="libx264",
            format="FFMPEG",
        )
        use_imageio = True
    except Exception:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(output_path), fourcc, fps / frame_stride, (width, height))

    frame_idx = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                break

            frame_idx += 1
            if frame_stride > 1 and (frame_idx % frame_stride != 0):
                continue

            processed_count += 1
            if processed_count > max_frames:
                print(f"[INFO] Reached max processed frame limit ({max_frames}). Stopping video processing.")
                break

            detections, fall_detected = DETECTOR.detect(frame, override_conf=confidence)
            if fall_detected:
                fall_frames_count += 1

            curr_fps = fps_counter.update()

            annotated = draw_detections(frame, detections, box_thickness=CONFIG.visual.box_thickness)
            annotated = draw_hud(
                frame=annotated,
                fall_detected=fall_detected,
                fps=curr_fps,
                device_name=str(DETECTOR.device),
                confidence_thresh=confidence,
                detections_count=len(detections),
            )

            if use_imageio:
                rgb_frame = cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB)
                writer.append_data(rgb_frame)
            else:
                writer.write(annotated)

    finally:
        cap.release()
        if use_imageio and writer:
            writer.close()
        elif writer:
            writer.release()

    total_duration = time.perf_counter() - start_processing_time

    return {
        "total_frames": total_frames,
        "processed_frames": processed_count,
        "fall_frames": fall_frames_count,
        "fall_rate_pct": round((fall_frames_count / max(1, processed_count)) * 100, 1),
        "video_fps": round(fps, 1),
        "resolution": f"{width}x{height}",
        "processing_time_sec": round(total_duration, 2),
    }


@app.post("/api/detect/video", response_model=VideoResult)
async def process_video(
    file: UploadFile = File(...),
    confidence: float = Form(0.50),
) -> VideoResult:
    """
    Uploads a video, runs frame-by-frame YOLO11 fall detection in background threadpool,
    burns HUD annotations, and returns summary statistics with a download URL.
    """
    if DETECTOR is None:
        raise HTTPException(status_code=500, detail="Model is not loaded")

    CONFIG.output_dir.mkdir(parents=True, exist_ok=True)

    suffix = Path(file.filename or "uploaded.mp4").suffix or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)

    output_filename = f"processed_{int(time.time())}_{Path(file.filename or 'video').stem}.mp4"
    output_file_path = CONFIG.output_dir / output_filename

    try:
        loop = asyncio.get_running_loop()
        stats = await loop.run_in_executor(
            EXECUTOR,
            _process_video_sync,
            tmp_path,
            output_file_path,
            confidence,
        )

        return VideoResult(
            status="success",
            filename=output_filename,
            download_url=f"/api/download/{output_filename}",
            total_frames=stats["total_frames"],
            processed_frames=stats["processed_frames"],
            fall_frames=stats["fall_frames"],
            fall_rate_pct=stats["fall_rate_pct"],
            video_fps=stats["video_fps"],
            resolution=stats["resolution"],
            processing_time_sec=stats["processing_time_sec"],
        )

    except Exception as e:
        print(f"[ERROR in process_video] {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path.exists():
            try:
                os.remove(tmp_path)
            except Exception:
                pass


@app.get("/api/download/{filename}")
def download_video(filename: str) -> FileResponse:
    """Allows downloading the processed output video."""
    file_path = CONFIG.output_dir / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Processed video not found")
    return FileResponse(
        path=file_path,
        media_type="video/mp4",
        filename=filename,
    )


@app.websocket("/ws/detect")
async def websocket_detect(websocket: WebSocket) -> None:
    """
    WebSocket endpoint for low-latency webcam frames.
    Receives JPEG binary frames, returns JSON coordinates and fall status.
    """
    await websocket.accept()
    if DETECTOR is None:
        await websocket.send_json({"error": "Model not loaded"})
        await websocket.close()
        return

    loop = asyncio.get_running_loop()

    try:
        while True:
            data = await websocket.receive_bytes()
            if not data:
                continue

            nparr = np.frombuffer(data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is None:
                await websocket.send_json({"error": "Invalid frame"})
                continue

            start_t = time.perf_counter()
            detections, fall_detected = await loop.run_in_executor(
                EXECUTOR,
                DETECTOR.detect,
                frame,
            )
            elapsed_ms = (time.perf_counter() - start_t) * 1000.0

            boxes = [
                {
                    "bbox": [det.bbox[0], det.bbox[1], det.bbox[2], det.bbox[3]],
                    "confidence": round(det.confidence, 3),
                    "class_name": det.class_name,
                    "is_fall": det.is_fall,
                }
                for det in detections
            ]

            await websocket.send_json({
                "fall_detected": fall_detected,
                "latency_ms": round(elapsed_ms, 1),
                "detections": boxes,
            })
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS ERROR] {e}")
