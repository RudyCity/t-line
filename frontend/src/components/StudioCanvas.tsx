/* Hallmark · pre-emit critique: P4 H5 E5 S5 R5 V4
 * Studio Studio canvas: pointer-captured, revision-guarded move/rotate/resize interactions.
 * Reuses application tokens and declarative SVG scene nodes; never evaluates scene markup.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { StudioEdit, StudioLayer, StudioProject } from '../services/studioApi';
import { evaluateLayer } from '../services/studioScene';
import {
  clientToStudioPoint, draggedCanvasPosition, resizedRotatedRectangle, rotatedCanvasAngle,
  transformStudioEdits, type CanvasPoint, type CanvasPreview, type StudioCanvasMode,
} from '../services/studioCanvasInteraction';

interface StudioCanvasProps {
  project: StudioProject;
  assetUrls?: Record<string, string>;
  frame: number;
  selectedLayer: string | null;
  isActive: boolean;
  busy: boolean;
  snapping: boolean;
  onSelectLayer: (id: string) => void;
  onStopPlayback: () => void;
  onEdit: (edits: StudioEdit[], message: string) => void;
}
interface Gesture {
  pointerId: number; layerId: string; mode: StudioCanvasMode;
  projectId: string; revision: number; frame: number;
  start: CanvasPoint; center: CanvasPoint;
  original: CanvasPreview;
}
function snapPreview(
  layer: StudioLayer, scene: StudioProject['composition'],
  gesture: Gesture, point: CanvasPoint, snapping: boolean,
): CanvasPreview {
  if (gesture.mode === 'resize') {
    return { ...gesture.original, ...resizedRotatedRectangle(gesture.start, point, gesture.original, snapping) };
  }
  if (gesture.mode === 'rotate') {
    return {
      ...gesture.original,
      rotation: rotatedCanvasAngle(gesture.start, point, gesture.center, gesture.original.rotation, snapping),
    };
  }
  return {
    ...gesture.original,
    ...draggedCanvasPosition(gesture.start, point, gesture.original, scene, layer, snapping),
  };
}
export function StudioCanvas({
  project, frame, selectedLayer, isActive, busy, snapping, assetUrls = {},
  onSelectLayer, onStopPlayback, onEdit,
}: StudioCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const previewRef = useRef<CanvasPreview | null>(null);
  const [preview, setPreview] = useState<CanvasPreview | null>(null);
  const scene = project.composition;

  const pointFor = (event: ReactPointerEvent<SVGSVGElement>): CanvasPoint =>
    clientToStudioPoint({ x: event.clientX, y: event.clientY }, event.currentTarget.getBoundingClientRect(), scene);

  const start = (event: ReactPointerEvent<SVGGElement | SVGCircleElement>, layer: StudioLayer, mode: StudioCanvasMode) => {
    if (busy || !isActive || event.button !== 0 || gesture.current) return;
    const svg = svgRef.current;
    if (!svg) return;
    const bounds = svg.getBoundingClientRect();
    if (!bounds.width || !bounds.height) { onSelectLayer(layer.id); return; }
    const initial = evaluateLayer(layer, frame);
    const pointer = clientToStudioPoint({ x: event.clientX, y: event.clientY }, bounds, scene);
    const original = { layerId: layer.id, ...initial, width: layer.width, height: layer.height,
      centerGuideX: false, centerGuideY: false };
    gesture.current = {
      pointerId: event.pointerId, layerId: layer.id, mode,
      projectId: project.id, revision: project.revision, frame,
      start: pointer, center: { x: initial.x + layer.width / 2, y: initial.y + layer.height / 2 },
      original,
    };
    previewRef.current = original;
    setPreview(original);
    onSelectLayer(layer.id);
    onStopPlayback();
    try { svg.setPointerCapture(event.pointerId); } catch { /* browser may refuse for synthetic events */ }
    event.stopPropagation();
    event.preventDefault();
  };

  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const layer = scene.layers.find(item => item.id === current.layerId);
    if (!layer) return;
    const next = snapPreview(layer, scene, current, pointFor(event), snapping);
    previewRef.current = next;
    setPreview(next);
  };

  const finish = (event: ReactPointerEvent<SVGSVGElement>, commit: boolean) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    const last = previewRef.current;
    previewRef.current = null;
    setPreview(null);
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    } catch { /* release is best-effort */ }
    if (!commit || !last || busy || !isActive || selectedLayer !== current.layerId ||
      current.projectId !== project.id || current.revision !== project.revision || current.frame !== frame) return;
    const edits = transformStudioEdits(project, current.layerId, current.frame, last);
    if (edits.length) onEdit(edits, current.mode === 'rotate' ? 'Layer rotated on canvas' : current.mode === 'resize' ? 'Rectangle resized on canvas' : 'Layer moved on canvas');
  };

  const keyboard = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (!isActive || busy || gesture.current || !selectedLayer) return;
    const selected = scene.layers.find(item => item.id === selectedLayer);
    if (!selected) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const evaluated = evaluateLayer(selected, frame);
    if (event.ctrlKey && !event.altKey) {
      if (selected.kind !== 'rect') return;
      const delta = event.shiftKey ? 10 : 1;
      const next = {
        width: selected.width + (event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0),
        height: selected.height + (event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0),
      };
      if (next.width < 1 || next.height < 1) return;
      const edits = transformStudioEdits(project, selectedLayer, frame, next);
      if (!edits.length) return;
      event.preventDefault();
      onStopPlayback();
      onEdit(edits, 'Rectangle resized with keyboard');
      return;
    }
    const step = event.shiftKey ? 10 : 1;
    const next = event.altKey ? {
      rotation: evaluated.rotation + (event.key === 'ArrowLeft' ? -15 : event.key === 'ArrowRight' ? 15 : 0),
    } : {
      x: evaluated.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
      y: evaluated.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
    };
    if (event.altKey && event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const edits = transformStudioEdits(project, selectedLayer, frame, next);
    if (!edits.length) return;
    event.preventDefault();
    onStopPlayback();
    onEdit(edits, event.altKey ? 'Layer rotated with keyboard' : 'Layer nudged with keyboard');
  };

  return (
    <svg ref={svgRef} role="img" aria-label={'Studio preview frame ' + frame} tabIndex={0}
      onKeyDown={keyboard}
      width="100%" viewBox={`0 0 ${scene.width} ${scene.height}`}
      onPointerMove={move}
      onPointerUp={event => finish(event, true)}
      onPointerCancel={event => finish(event, false)}
      onLostPointerCapture={event => {
        // A lost capture without an up event must never commit an incomplete drag.
        if (gesture.current?.pointerId === event.pointerId) finish(event, false);
      }}
      className="block max-h-full select-none rounded shadow-2xl"
      style={{ aspectRatio: scene.width + '/' + scene.height, touchAction: 'none' }}>
      <rect width={scene.width} height={scene.height} fill={scene.background} />
      {scene.layers.map(layer => {
        const evaluated = { ...evaluateLayer(layer, frame), width: layer.width, height: layer.height };
        const values = preview?.layerId === layer.id ? { ...evaluated, ...preview } : evaluated;
        const cx = values.x + (values.width ?? layer.width) / 2;
        const cy = values.y + (values.height ?? layer.height) / 2;
        const transform = `rotate(${values.rotation} ${cx} ${cy})`;
        const selected = selectedLayer === layer.id;
        return (
          <g key={layer.id} data-motion-layer={layer.id} onPointerDown={event => start(event, layer, 'move')}
            onClick={() => onSelectLayer(layer.id)}
            className={busy ? 'cursor-default' : 'cursor-move'}>
            {layer.kind === 'rect' ? (
              <rect x={values.x} y={values.y} width={values.width ?? layer.width} height={values.height ?? layer.height}
                rx={Math.min(layer.cornerRadius ?? 0, (values.width ?? layer.width) / 2, (values.height ?? layer.height) / 2)}
                fill={layer.fill} opacity={values.opacity} transform={transform} />
            ) : layer.kind === 'image' ? (
              assetUrls[layer.assetId] ? (
                <image x={values.x} y={values.y} width={values.width ?? layer.width}
                  height={values.height ?? layer.height} href={assetUrls[layer.assetId]}
                  preserveAspectRatio="none" opacity={values.opacity} transform={transform} />
              ) : (
                <rect x={values.x} y={values.y} width={values.width ?? layer.width}
                  height={values.height ?? layer.height} fill="var(--bg-card)"
                  stroke="var(--border-color)" transform={transform} />
              )
            ) : (
              <text x={values.x} y={values.y + layer.fontSize} fontSize={layer.fontSize}
                fontFamily={layer.fontFamily} fill={layer.fill} opacity={values.opacity}
                transform={transform}>{layer.text}</text>
            )}
            {selected && (
              <g pointerEvents="none">
                <rect x={values.x} y={values.y} width={values.width ?? layer.width} height={values.height ?? layer.height}
                  transform={transform} fill="none" stroke="var(--color-primary)"
                  strokeWidth={Math.max(2, scene.width / 480)} strokeDasharray="10 5" />
              </g>
            )}
          </g>
        );
      })}
      {selectedLayer && scene.layers.filter(layer => layer.id === selectedLayer).map(layer => {
        const evaluated = { ...evaluateLayer(layer, frame), width: layer.width, height: layer.height };
        const values = preview?.layerId === layer.id ? { ...evaluated, ...preview } : evaluated;
        const cx = values.x + (values.width ?? layer.width) / 2;
        const cy = values.y + (values.height ?? layer.height) / 2;
        const theta = values.rotation * Math.PI / 180;
        const handle = {
          x: cx + Math.sin(theta) * (values.height / 2 + 32),
          y: cy - Math.cos(theta) * (values.height / 2 + 32),
        };
        return (
          <g key={layer.id + '-handles'} aria-label="Transform handles">
            <line x1={cx} y1={cy} x2={handle.x} y2={handle.y}
              stroke="var(--color-primary)" strokeWidth={Math.max(2, scene.width / 480)} pointerEvents="none" />
            {layer.kind === 'rect' && (
              <rect role="button" aria-label="Resize selected rectangle" tabIndex={0}
                x={cx + Math.cos(theta) * (values.width / 2) - Math.sin(theta) * (values.height / 2) - 10}
                y={cy + Math.sin(theta) * (values.width / 2) + Math.cos(theta) * (values.height / 2) - 10}
                width={20} height={20} rx={3}
                fill="var(--bg-card)" stroke="var(--color-primary)" strokeWidth={Math.max(2, scene.width / 480)}
                onPointerDown={event => start(event, layer, 'resize')} className="cursor-nwse-resize" />
            )}
            <circle role="button" aria-label="Rotate selected layer" tabIndex={0}
              cx={handle.x} cy={handle.y} r={Math.max(9, scene.width / 150)}
              fill="var(--bg-card)" stroke="var(--color-primary)" strokeWidth={Math.max(2, scene.width / 480)}
              onPointerDown={event => start(event, layer, 'rotate')} className="cursor-grab" />
          </g>
        );
      })}
      {preview?.centerGuideX && <line x1={scene.width / 2} y1={0} x2={scene.width / 2} y2={scene.height}
        stroke="var(--color-primary)" strokeWidth={2} strokeDasharray="7 7" pointerEvents="none" />}
      {preview?.centerGuideY && <line x1={0} y1={scene.height / 2} x2={scene.width} y2={scene.height / 2}
        stroke="var(--color-primary)" strokeWidth={2} strokeDasharray="7 7" pointerEvents="none" />}
    </svg>
  );
}
