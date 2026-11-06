"""
Webcam detection module.
Handles real-time video capture, inference, visualization, and resource cleanup.
"""
import cv2
from config import DetectionConfig
from src.detector import FallDetector
from src.utils import FPSCounter, draw_hud, draw_detections


class WebcamStreamer:
    """Manages real-time webcam feed capture, inference, and visualization."""

    def __init__(self, config: DetectionConfig, detector: FallDetector):
        self.config = config
        self.detector = detector
        self.fps_counter = FPSCounter()

    def run(self) -> None:
        """Starts real-time detection on webcam."""
        cam_index = self.config.webcam_index
        print(f"[INFO] Opening webcam index: {cam_index}...")

        # Initialize video capture (try DirectShow on Windows first for fast startup)
        cap = cv2.VideoCapture(cam_index, cv2.CAP_DSHOW)
        if not cap.isOpened():
            print("[WARN] Failed with CAP_DSHOW, retrying default backend...")
            cap = cv2.VideoCapture(cam_index)

        if not cap.isOpened():
            print(f"[ERROR] Could not open webcam index {cam_index}. Please verify camera is connected and unblocked.")
            return

        window_name = "Human Fall Detection - Real-time Webcam"
        cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

        print("[INFO] Webcam feed running. Press 'q' or 'ESC' in the preview window to exit.")
        self.fps_counter.reset()

        try:
            while True:
                ret, frame = cap.read()
                if not ret or frame is None:
                    print("[WARN] Failed to receive frame from webcam. Exiting stream...")
                    break

                # Inference
                detections, fall_detected = self.detector.detect(frame)

                # FPS calculation
                fps = self.fps_counter.update()

                # Visual overlay
                annotated_frame = draw_detections(
                    frame=frame,
                    detections=detections,
                    box_thickness=self.config.visual.box_thickness,
                )
                annotated_frame = draw_hud(
                    frame=annotated_frame,
                    fall_detected=fall_detected,
                    fps=fps,
                    device_name=str(self.detector.device),
                    confidence_thresh=self.config.confidence_threshold,
                    detections_count=len(detections),
                )

                cv2.imshow(window_name, annotated_frame)

                key = cv2.waitKey(1) & 0xFF
                if key == ord('q') or key == 27:
                    print("[INFO] Exit signal received. Stopping webcam...")
                    break

        except KeyboardInterrupt:
            print("[INFO] Interrupted by user. Exiting...")
        except Exception as e:
            print(f"[ERROR] Exception during webcam streaming: {e}")
        finally:
            cap.release()
            cv2.destroyAllWindows()
            print("[INFO] Webcam resources and OpenCV windows released successfully.")
