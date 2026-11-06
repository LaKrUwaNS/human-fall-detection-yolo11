"""
Configuration settings for Human Fall Detection Application.
Provides robust dataclasses, device resolution, and visual constants.
"""
from dataclasses import dataclass, field
from pathlib import Path
from typing import Tuple, List, Optional
import torch


@dataclass
class VisualConfig:
    """Styling settings for OpenCV and Canvas overlays."""
    color_fall: Tuple[int, int, int] = (0, 0, 255)         # Bright Red (BGR)
    color_normal: Tuple[int, int, int] = (0, 200, 0)       # Green (BGR)
    color_hud_bg: Tuple[int, int, int] = (20, 20, 20)      # Dark HUD banner background
    color_text: Tuple[int, int, int] = (255, 255, 255)     # White text
    box_thickness: int = 2
    font_scale: float = 0.65
    font_thickness: int = 2


@dataclass
class DetectionConfig:
    """Core configuration parameters for detection, media input/output, and inference."""
    # Model configuration
    model_path: Path = Path("models/best.pt")
    confidence_threshold: float = 0.50
    image_size: int = 640
    device: Optional[str] = None  # None for auto-detect ('0' for CUDA or 'cpu')

    # Media input / output
    webcam_index: int = 0
    video_source: Optional[Path] = None
    output_dir: Path = Path("outputs")

    # Visual styling
    visual: VisualConfig = field(default_factory=VisualConfig)

    # Fall detection target classes
    fall_class_names: List[str] = field(
        default_factory=lambda: ["Fall-Detected", "fall", "fall-detected"]
    )

    def resolve_device(self) -> str:
        """
        Detects CUDA GPU availability and returns appropriate device string.
        Gracefully falls back to CPU if requested or if CUDA is unavailable.
        """
        if self.device:
            dev = self.device.lower().strip()
            if dev.startswith("cuda") and not torch.cuda.is_available():
                print(f"[WARN] CUDA requested ('{self.device}') but torch.cuda.is_available() is False. Falling back to CPU.")
                return "cpu"
            return dev

        if torch.cuda.is_available():
            try:
                gpu_name = torch.cuda.get_device_name(0)
                print(f"[INFO] CUDA available! Using GPU: {gpu_name}")
                return "0"
            except Exception as e:
                print(f"[WARN] Failed to query GPU device, falling back to CPU: {e}")
                return "cpu"
        else:
            print("[INFO] CUDA not available or not supported by PyTorch. Using CPU inference.")
            return "cpu"
