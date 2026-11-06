# OpenCV & YOLO11 Human Fall Detection System

A complete, production-ready Python and Next.js Human Fall Detection application utilizing a custom-trained **YOLO11** object detection model, **OpenCV**, and a modern **Next.js + Tailwind CSS** web UI.

---

## 🌟 Application Features

1. **Real-Time Webcam Detection**:
   - Stream from your browser or native OpenCV with live bounding boxes, confidence tags, detection status, and real-time smoothed FPS.
   - Immediate audio/visual status indicator: **CRITICAL: FALL DETECTED** (Red badge & bounding boxes) vs **NORMAL: NO FALL DETECTED** (Green).
2. **Video File Detection & Export**:
   - Upload MP4, AVI, MOV, or MKV videos directly in the web UI or CLI.
   - Processes every frame through your YOLO11 model, burning HUD telemetry and bounding boxes.
   - Generates and downloads the annotated video from the `outputs/` folder.
   - Provides summary statistics: total frames, fall frames count, fall percentage rate, and processing duration.
3. **Hardware Acceleration**:
   - Automatically detects NVIDIA CUDA GPUs (e.g., RTX 3050) and routes inference to the GPU. Gracefully falls back to CPU.
4. **Interactive Web UI**:
   - Complete Next.js 16 + Tailwind CSS frontend interface with real-time camera capture, threshold adjustments, video upload preview, and download links.

---

## 📁 Project Structure

```text
falling_detection/
├── models/
│   └── best.pt               # Preserved custom trained YOLO11 model weights
├── videos/                   # Input test videos
├── outputs/                  # Processed and annotated videos are saved here
├── src/
│   ├── __init__.py           # Package exports
│   ├── detector.py           # FallDetector class (YOLO11 inference & device handling)
│   ├── webcam.py             # WebcamStreamer (Native OpenCV camera feed & display)
│   ├── video_processor.py    # VideoProcessor (Frame inference & video writer)
│   └── utils.py              # Visual styling, FPS counter, HUD banner, and annotations
├── ui/                       # Next.js Web UI
│   ├── src/app/page.tsx      # Fall Detection Web Dashboard
│   └── package.json
├── config.py                 # Central configuration and CUDA/device resolution
├── server.py                 # FastAPI backend server for Web UI
├── main.py                   # CLI entrypoint for native OpenCV execution
├── requirements.txt          # Python backend dependencies
└── README.md                 # Complete documentation
```

---

## 🚀 Quick Start Guide

### 1. Python Environment Setup

Activate your virtual environment and install backend dependencies:

```powershell
# Activate your virtual environment
.\.venv\Scripts\Activate.ps1

# Install backend dependencies (FastAPI, OpenCV, Ultralytics, Uvicorn)
pip install -r requirements.txt
```

---

### 2. Running the Complete Next.js Web UI

The Web UI connects directly to your custom YOLO11 model through a FastAPI backend.

#### Step A: Start the Backend API Server
In your terminal (with `.venv` active):
```powershell
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```
*API will run at `http://localhost:8000` (docs available at `/docs`).*

#### Step B: Start the Next.js Frontend
In a second terminal:
```powershell
cd ui
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser:
- **Tab 1: Real-Time Webcam**: Click **"Start Real-Time Detection"** to stream frames from your browser with instant YOLO11 fall detection overlays, FPS, and latency metrics.
- **Tab 2: Video File Detection**: Upload any `.mp4` video, click **"Run Video Fall Detection"**, watch the preview, and download the annotated output video.
- **Top Bar**: Adjust confidence thresholds dynamically (0.10 - 0.95) and view active device status (GPU/CPU).

---

### 3. Running Native OpenCV Desktop CLI

You can also run the desktop OpenCV interface directly from the terminal:

#### A. Real-Time Webcam Detection
```powershell
python main.py --mode webcam

# With custom confidence
python main.py --mode webcam --conf 0.50
```
*(Press `Q` or `ESC` in the preview window to exit)*

#### B. Video File Detection
```powershell
python main.py --mode video --source videos/synthetic_test.mp4

# Run headlessly (faster batch processing)
python main.py --mode video --source videos/synthetic_test.mp4 --no-preview
```
Annotated videos are automatically saved to [`outputs/`](file:///c:/Users/Lenovo/Documents/Work Hub/OpenCV/falling_detection/outputs/).
