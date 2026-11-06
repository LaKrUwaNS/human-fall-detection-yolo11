"""
Utility functions and data models for fall detection, FPS tracking, and visual overlays.
"""
from dataclasses import dataclass
import time
from typing import List, Tuple
import cv2
import numpy as np


@dataclass
class DetectionResult:
    """Represents a single detected bounding box with metadata."""
    bbox: Tuple[int, int, int, int]  # (x1, y1, x2, y2)
    confidence: float
    class_id: int
    class_name: str
    is_fall: bool = False


class FPSCounter:
    """Moving average FPS calculator for stable, jitter-free real-time telemetry."""

    def __init__(self, avg_window: int = 15):
        self.avg_window = max(1, avg_window)
        self.frame_times: List[float] = []
        self.last_time = time.perf_counter()

    def update(self) -> float:
        """Call on every processed frame. Returns smoothed FPS value."""
        current_time = time.perf_counter()
        delta = current_time - self.last_time
        self.last_time = current_time

        if delta > 0:
            self.frame_times.append(delta)
            if len(self.frame_times) > self.avg_window:
                self.frame_times.pop(0)

        if not self.frame_times:
            return 0.0

        avg_delta = sum(self.frame_times) / len(self.frame_times)
        return round(1.0 / avg_delta, 1) if avg_delta > 0 else 0.0

    def reset(self) -> None:
        """Resets the timing window."""
        self.frame_times.clear()
        self.last_time = time.perf_counter()


def draw_hud(
    frame: np.ndarray,
    fall_detected: bool,
    fps: float,
    device_name: str,
    confidence_thresh: float,
    detections_count: int,
) -> np.ndarray:
    """
    Renders an informative top HUD overlay bar with status alerts and metrics.
    """
    h, w = frame.shape[:2]
    overlay = frame.copy()

    # Semi-transparent top bar
    header_height = 68
    cv2.rectangle(overlay, (0, 0), (w, header_height), (15, 15, 15), -1)
    alpha = 0.80
    cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)

    # Status formatting
    status_text = "STATUS: FALL DETECTED" if fall_detected else "STATUS: NO FALL DETECTED"
    status_color = (0, 0, 255) if fall_detected else (0, 220, 0)

    # Title & Status text
    cv2.putText(
        frame,
        "Human Fall Detection (YOLO11)",
        (16, 26),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )

    cv2.putText(
        frame,
        status_text,
        (16, 54),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        status_color,
        2,
        cv2.LINE_AA,
    )

    # Telemetry metrics
    metrics_line1 = f"FPS: {fps:.1f} | Device: {device_name.upper()}"
    metrics_line2 = f"Conf Thresh: {confidence_thresh:.2f} | Detected: {detections_count}"

    (tw1, _), _ = cv2.getTextSize(metrics_line1, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
    (tw2, _), _ = cv2.getTextSize(metrics_line2, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)

    right_margin = 16
    cv2.putText(
        frame,
        metrics_line1,
        (max(10, w - tw1 - right_margin), 26),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        (210, 210, 210),
        1,
        cv2.LINE_AA,
    )
    cv2.putText(
        frame,
        metrics_line2,
        (max(10, w - tw2 - right_margin), 52),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        (210, 210, 210),
        1,
        cv2.LINE_AA,
    )

    # If fall detected, draw a noticeable perimeter warning border
    if fall_detected:
        border_thickness = 4
        cv2.rectangle(frame, (0, 0), (w, h), (0, 0, 255), border_thickness)

    return frame


def draw_detections(
    frame: np.ndarray,
    detections: List[DetectionResult],
    box_thickness: int = 2,
) -> np.ndarray:
    """
    Draws bounding boxes and confidence label tags on detected objects.
    """
    for det in detections:
        x1, y1, x2, y2 = det.bbox
        color = (0, 0, 255) if det.is_fall else (0, 220, 0)

        # Draw outer rectangle
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, box_thickness)

        # Label tag
        label = f"{det.class_name} {det.confidence:.2f}"
        (tw, th), baseline = cv2.getTextSize(
            label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1
        )
        tag_y1 = max(0, y1 - th - baseline - 6)
        tag_y2 = y1

        # Draw filled label tag background
        cv2.rectangle(
            frame,
            (x1, tag_y1),
            (x1 + tw + 8, tag_y2),
            color,
            -1,
        )

        # Draw label text in contrasting white
        cv2.putText(
            frame,
            label,
            (x1 + 4, tag_y2 - baseline - 2),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )

    return frame
