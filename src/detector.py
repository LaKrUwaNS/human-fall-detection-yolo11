"""
Fall Detection core module using custom trained YOLO11.
Provides thread-safe model loading, inference warmup, and structured detection parsing.
"""
from pathlib import Path
from typing import List, Tuple
import threading
import numpy as np
from ultralytics import YOLO

from config import DetectionConfig
from src.utils import DetectionResult


class FallDetector:
    """
    Encapsulates YOLO11 inference for Human Fall Detection.
    Follows Single Responsibility Principle (SRP) for inference and data extraction.
    Thread-safe for concurrent API / streaming inference.
    """

    def __init__(self, config: DetectionConfig):
        self.config = config
        self.device = self.config.resolve_device()
        self._lock = threading.Lock()
        self.model = self._load_model()
        self.class_names = self.model.names if hasattr(self.model, "names") else {}
        self._warmup()

    def _load_model(self) -> YOLO:
        """Validates model path and initializes YOLO model."""
        model_path = Path(self.config.model_path)
        if not model_path.exists():
            raise FileNotFoundError(
                f"Model file not found at: {model_path.resolve()}.\n"
                f"Please ensure your trained YOLO11 weights are placed at models/best.pt."
            )
        try:
            print(f"[INFO] Loading YOLO11 model from: {model_path}...")
            model = YOLO(str(model_path))
            print(f"[INFO] Model loaded successfully. Classes: {getattr(model, 'names', {})}")
            return model
        except Exception as e:
            raise RuntimeError(f"Failed to load YOLO model from {model_path}: {e}") from e

    def _warmup(self) -> None:
        """Performs initial dummy inference to compile PyTorch execution graphs."""
        try:
            dummy_img = np.zeros((self.config.image_size, self.config.image_size, 3), dtype=np.uint8)
            self.model.predict(
                source=dummy_img,
                conf=self.config.confidence_threshold,
                imgsz=self.config.image_size,
                device=self.device,
                verbose=False,
            )
            print("[INFO] FallDetector model warmup complete.")
        except Exception as e:
            print(f"[WARN] Model warmup skipped or encountered error: {e}")

    def detect(
        self,
        frame: np.ndarray,
        override_conf: float = None,
    ) -> Tuple[List[DetectionResult], bool]:
        """
        Performs inference on a single image frame.

        Args:
            frame: np.ndarray image in BGR format
            override_conf: Optional custom confidence threshold for this call

        Returns:
            Tuple of:
                - detections: list of DetectionResult objects
                - fall_detected: bool indicating whether any fall was detected
        """
        if frame is None or frame.size == 0:
            return [], False

        conf = override_conf if override_conf is not None else self.config.confidence_threshold

        with self._lock:
            results = self.model.predict(
                source=frame,
                conf=conf,
                imgsz=self.config.image_size,
                device=self.device,
                verbose=False,
            )

        detections: List[DetectionResult] = []
        fall_detected = False

        if not results:
            return detections, fall_detected

        result = results[0]
        boxes = result.boxes

        if boxes is None or len(boxes) == 0:
            return detections, fall_detected

        for box in boxes:
            coords = box.xyxy[0].cpu().numpy().astype(int)
            x1, y1, x2, y2 = int(coords[0]), int(coords[1]), int(coords[2]), int(coords[3])

            confidence = float(box.conf[0].cpu().numpy())
            class_id = int(box.cls[0].cpu().numpy())
            class_name = self.class_names.get(class_id, f"class_{class_id}")

            # Check if class matches recognized fall names
            is_fall = class_name in self.config.fall_class_names or "fall" in class_name.lower()
            if is_fall:
                fall_detected = True

            detections.append(
                DetectionResult(
                    bbox=(x1, y1, x2, y2),
                    confidence=confidence,
                    class_id=class_id,
                    class_name=class_name,
                    is_fall=is_fall,
                )
            )

        return detections, fall_detected
