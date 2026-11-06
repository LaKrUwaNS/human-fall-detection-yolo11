import { Detection } from "@/types/detection";

/**
 * Draws styled bounding boxes and detection tags onto an HTML5 Canvas.
 */
export function drawDetectionOverlay(
  canvas: HTMLCanvasElement | null,
  detections: Detection[],
  fallDetected: boolean,
  width: number,
  height: number
): void {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);

  detections.forEach((det) => {
    const [x1, y1, x2, y2] = det.bbox;
    const boxW = x2 - x1;
    const boxH = y2 - y1;
    const color = det.is_fall ? "#ef4444" : "#22c55e";

    // Draw outer bounding box
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.strokeRect(x1, y1, boxW, boxH);

    // Label tag
    const label = `${det.class_name} ${(det.confidence * 100).toFixed(0)}%`;
    ctx.font = "bold 13px Inter, system-ui, sans-serif";
    const textWidth = ctx.measureText(label).width;

    ctx.fillStyle = color;
    ctx.fillRect(x1, Math.max(0, y1 - 22), textWidth + 10, 22);

    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, x1 + 5, Math.max(15, y1 - 6));
  });

  // Perimeter red warning highlight if fall is detected
  if (fallDetected) {
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
    ctx.strokeRect(0, 0, width, height);
  }
}

