"""
Video file processing module.
Handles loading video, per-frame inference, annotated video writing (H.264), and progress tracking.
"""
from pathlib import Path
from typing import Optional, Callable
import time
import cv2
import numpy as np

from config import DetectionConfig
from src.detector import FallDetector
from src.utils import FPSCounter, draw_hud, draw_detections


class VideoProcessor:
    """Processes video files, displays annotations, and saves output video."""

    def __init__(self, config: DetectionConfig, detector: FallDetector):
        self.config = config
        self.detector = detector
        self.fps_counter = FPSCounter()

    def process(
        self,
        show_preview: bool = True,
        progress_callback: Optional[Callable[[int, int, float], None]] = None,
    ) -> Optional[Path]:
        """
        Runs inference across all frames of the configured video source.
        Saves annotated output to outputs/ directory with H.264/MP4 encoding.

        Args:
            show_preview: Whether to display OpenCV GUI window during processing
            progress_callback: Optional callback receiving (processed_frames, total_frames, fps)
        """
        source_path = self.config.video_source
        if not source_path or not Path(source_path).exists():
            raise FileNotFoundError(f"Video file not found at: {source_path}")

        source_path = Path(source_path)
        print(f"[INFO] Opening video file: {source_path.resolve()}...")

        cap = cv2.VideoCapture(str(source_path))
        if not cap.isOpened():
            raise RuntimeError(f"Could not open video file: {source_path}")

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        if fps <= 0:
            fps = 25.0

        print(f"[INFO] Video resolution: {width}x{height}, FPS: {fps:.2f}, Total frames: {total_frames}")

        output_dir = Path(self.config.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file_name = f"annotated_{source_path.stem}.mp4"
        output_path = output_dir / output_file_name

        # Initialize stream writer using imageio (FFMPEG libx264) for universal playback
        use_imageio = False
        writer = None
        try:
            import imageio.v2 as imageio
            writer = imageio.get_writer(
                str(output_path),
                fps=fps,
                codec="libx264",
                format="FFMPEG",
            )
            use_imageio = True
            print(f"[INFO] Initialized H.264 streaming encoder via imageio-ffmpeg.")
        except Exception as e:
            print(f"[WARN] imageio FFMPEG unavailable ({e}), falling back to OpenCV VideoWriter...")
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            writer = cv2.VideoWriter(str(output_path), fourcc, fps, (width, height))
            if not writer.isOpened():
                output_file_name = f"annotated_{source_path.stem}.avi"
                output_path = output_dir / output_file_name
                fourcc = cv2.VideoWriter_fourcc(*"XVID")
                writer = cv2.VideoWriter(str(output_path), fourcc, fps, (width, height))

        window_name = f"Human Fall Detection - {source_path.name}"
        if show_preview:
            cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

        processed_frames = 0
        fall_events_detected = 0
        self.fps_counter.reset()

        print(f"[INFO] Processing video... Annotated video will be saved to: {output_path}")

        try:
            while True:
                ret, frame = cap.read()
                if not ret or frame is None:
                    break

                processed_frames += 1

                # Inference
                detections, fall_detected = self.detector.detect(frame)
                if fall_detected:
                    fall_events_detected += 1

                curr_fps = self.fps_counter.update()

                # Visual annotations
                annotated_frame = draw_detections(
                    frame=frame,
                    detections=detections,
                    box_thickness=self.config.visual.box_thickness,
                )
                annotated_frame = draw_hud(
                    frame=annotated_frame,
                    fall_detected=fall_detected,
                    fps=curr_fps,
                    device_name=str(self.detector.device),
                    confidence_thresh=self.config.confidence_threshold,
                    detections_count=len(detections),
                )

                # Write frame to output video stream
                if use_imageio:
                    # imageio expects RGB
                    rgb_frame = cv2.cvtColor(annotated_frame, cv2.COLOR_BGR2RGB)
                    writer.append_data(rgb_frame)
                else:
                    writer.write(annotated_frame)

                # Preview display
                if show_preview:
                    cv2.imshow(window_name, annotated_frame)
                    key = cv2.waitKey(1) & 0xFF
                    if key == ord('q') or key == 27:
                        print(f"[INFO] Early termination requested at frame {processed_frames}/{total_frames}.")
                        break

                if progress_callback:
                    progress_callback(processed_frames, total_frames, curr_fps)
                elif processed_frames % 50 == 0 or processed_frames == total_frames:
                    pct = (processed_frames / total_frames * 100) if total_frames > 0 else 0
                    print(f"[PROGRESS] Processed {processed_frames}/{total_frames} frames ({pct:.1f}%)...")

        except KeyboardInterrupt:
            print("[INFO] Processing interrupted by user.")
        finally:
            cap.release()
            if use_imageio and writer:
                writer.close()
            elif writer:
                writer.release()
            if show_preview:
                cv2.destroyAllWindows()

        print(f"[SUCCESS] Video processing complete!")
        print(f"[INFO] Total frames processed: {processed_frames}")
        print(f"[INFO] Frames with fall detected: {fall_events_detected}")
        print(f"[INFO] Saved annotated video to: {output_path.resolve()}")
        return output_path
