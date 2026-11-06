"""
Human Fall Detection Application
Main CLI entrypoint for Webcam and Video detection.
"""
import argparse
import sys
from pathlib import Path

from config import DetectionConfig
from src.detector import FallDetector
from src.webcam import WebcamStreamer
from src.video_processor import VideoProcessor


def build_parser() -> argparse.ArgumentParser:
    """Creates command line argument parser."""
    parser = argparse.ArgumentParser(
        description="Human Fall Detection using custom trained YOLO11 and OpenCV",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument(
        "--mode",
        type=str,
        choices=["webcam", "video"],
        default="webcam",
        help="Operation mode: 'webcam' for real-time camera feed or 'video' for file processing.",
    )
    parser.add_argument(
        "--source",
        type=str,
        default=None,
        help="Path to input video file (required when --mode video). Supported formats: mp4, avi, mov, mkv.",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="models/best.pt",
        help="Path to trained YOLO11 model weights.",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.50,
        help="Confidence threshold for fall detection.",
    )
    parser.add_argument(
        "--imgsz",
        type=int,
        default=640,
        help="Inference image resolution size.",
    )
    parser.add_argument(
        "--device",
        type=str,
        default=None,
        help="Device to run inference on: 'cuda', 'cuda:0', 'cpu', or leave empty for auto-detection.",
    )
    parser.add_argument(
        "--webcam-id",
        type=int,
        default=0,
        help="Webcam camera index (default: 0).",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="outputs",
        help="Directory where annotated output videos are saved.",
    )
    parser.add_argument(
        "--no-preview",
        action="store_true",
        help="Disable real-time GUI window preview during video processing (useful for headless / faster batch).",
    )

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    # Validate mode-specific arguments
    if args.mode == "video" and not args.source:
        print("[ERROR] Argument '--source <video_path>' is required when running in 'video' mode.")
        print("Example: python main.py --mode video --source videos/test_fall.mp4")
        sys.exit(1)

    model_path = Path(args.model)
    if not model_path.exists():
        print(f"[ERROR] Trained model file not found at: {model_path.resolve()}")
        print("Please ensure your custom YOLO11 model is located at models/best.pt.")
        sys.exit(1)

    # Initialize configuration
    config = DetectionConfig(
        model_path=model_path,
        confidence_threshold=args.conf,
        image_size=args.imgsz,
        device=args.device,
        webcam_index=args.webcam_id,
        video_source=Path(args.source) if args.source else None,
        output_dir=Path(args.output_dir),
    )

    # Instantiate detector
    try:
        detector = FallDetector(config=config)
    except Exception as e:
        print(f"[ERROR] Could not initialize FallDetector: {e}")
        sys.exit(1)

    # Execute selected mode
    if args.mode == "webcam":
        print("[INFO] Starting Webcam Fall Detection mode...")
        streamer = WebcamStreamer(config=config, detector=detector)
        streamer.run()

    elif args.mode == "video":
        print(f"[INFO] Starting Video Fall Detection mode on: {config.video_source}...")
        try:
            processor = VideoProcessor(config=config, detector=detector)
            processor.process(show_preview=not args.no_preview)
        except Exception as e:
            print(f"[ERROR] Error processing video: {e}")
            sys.exit(1)


if __name__ == "__main__":
    main()
