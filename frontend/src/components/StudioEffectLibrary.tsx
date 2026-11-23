import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Eye,
  Layers3,
  Loader2,
  Save,
  X,
  Search,
} from 'lucide-react';
import {
  studioApi,
  type StudioEffectCatalogItem,
  type StudioEffectApplication,
  type StudioEffectCategory,
  type StudioProject,
} from '../services/studioApi';

interface Props {
  workspacePath: string;
  project: StudioProject;
  selectedLayer: string | null;
  busy: boolean;
  preview: StudioProject | null;
  onPreview: (project: StudioProject | null) => void;
  onApply: (input: StudioEffectApplication) => void;
}

const field =
  'mt-1 w-full rounded border border-[#2a2d3d] bg-[#12141e] px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus-visible:outline-2 focus-visible:outline-cyan-500';
const button =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-[#2a2d3d] bg-[#161822] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-[#202330] hover:text-white disabled:opacity-40 transition-colors';

const categories: Array<{ value: StudioEffectCategory | ''; label: string }> = [
  { value: '', label: 'All' },
  { value: 'entrance', label: 'Entrance' },
  { value: 'exit', label: 'Exit' },
  { value: 'kinetic-typography', label: 'Kinetic typography' },
  { value: 'camera', label: 'Camera' },
  { value: 'transition', label: 'Transition' },
  { value: 'background', label: 'Background' },
  { value: 'graphic-accent', label: 'Graphic accent' },
];

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  entrance: { bg: 'bg-emerald-950/60', text: 'text-emerald-300', border: 'border-emerald-700/60' },
  exit: { bg: 'bg-rose-950/60', text: 'text-rose-300', border: 'border-rose-700/60' },
  'kinetic-typography': { bg: 'bg-cyan-950/60', text: 'text-cyan-300', border: 'border-cyan-700/60' },
  camera: { bg: 'bg-amber-950/60', text: 'text-amber-300', border: 'border-amber-700/60' },
  transition: { bg: 'bg-purple-950/60', text: 'text-purple-300', border: 'border-purple-700/60' },
  background: { bg: 'bg-indigo-950/60', text: 'text-indigo-300', border: 'border-indigo-700/60' },
  'graphic-accent': { bg: 'bg-teal-950/60', text: 'text-teal-300', border: 'border-teal-700/60' },
};

function defaultParams(effect?: StudioEffectCatalogItem): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(effect?.parameters ?? {}).map(([name, def]) => [name, def.default])
  );
}

/** Classify exact visual motion animation type from effect id, name, and tags */
function getEffectVisualType(effect: StudioEffectCatalogItem): {
  type: string;
  label: string;
} {
  const id = effect.id.toLowerCase();
  const name = effect.name.toLowerCase();
  const tags = effect.tags.map(t => t.toLowerCase());
  const all = `${id} ${name} ${tags.join(' ')}`;

  // Directional Slide
  if (all.includes('left') || all.includes('from right')) return { type: 'slide-left', label: 'SLIDE ←' };
  if (all.includes('right') || all.includes('from left')) return { type: 'slide-right', label: 'SLIDE →' };
  if (all.includes('up') || all.includes('rise')) return { type: 'slide-up', label: 'SLIDE ↑' };
  if (all.includes('down') || all.includes('descend')) return { type: 'slide-down', label: 'SLIDE ↓' };

  // Motions
  if (all.includes('drop') || all.includes('gravity')) return { type: 'drop', label: 'DROP ↓' };
  if (all.includes('spin') || all.includes('vortex') || all.includes('spiral')) return { type: 'spin', label: 'SPIN ↻' };
  if (all.includes('tilt') || all.includes('flip')) return { type: 'tilt', label: 'TILT ⤹' };
  if (all.includes('fade') || all.includes('dissolve') || all.includes('opacity')) return { type: 'fade', label: 'FADE' };
  if (all.includes('pop') || all.includes('elastic') || all.includes('bounce') || all.includes('hop')) return { type: 'pop', label: 'BOUNCE' };
  if (all.includes('zoom') || all.includes('scale') || all.includes('punch')) return { type: 'zoom', label: 'ZOOM' };

  // Kinetic
  if (all.includes('typewriter') || all.includes('letter')) return { type: 'typewriter', label: 'TYPEWRITER' };
  if (all.includes('glitch') || all.includes('chromatic')) return { type: 'glitch', label: 'GLITCH' };
  if (all.includes('pulse') || all.includes('heartbeat') || all.includes('thump') || all.includes('breathing')) return { type: 'pulse', label: 'PULSE' };
  if (all.includes('wave')) return { type: 'wave', label: 'WAVE' };

  // Camera
  if (all.includes('shake') || all.includes('jitter')) return { type: 'shake', label: 'SHAKE' };
  if (all.includes('dolly') || all.includes('pan') || all.includes('whip')) return { type: 'dolly', label: 'DOLLY' };

  // Accent
  if (all.includes('arrow') || all.includes('pointer')) return { type: 'arrow', label: 'ARROW ➔' };
  if (all.includes('target') || all.includes('reticle') || all.includes('crosshair')) return { type: 'reticle', label: 'TARGET ◎' };
  if (all.includes('badge') || all.includes('pill') || all.includes('capsule')) return { type: 'badge', label: 'BADGE' };
  if (all.includes('underline') || all.includes('rule') || all.includes('bar')) return { type: 'rule', label: 'RULE ━' };
  if (all.includes('spark') || all.includes('star') || all.includes('shine') || all.includes('cross')) return { type: 'spark', label: 'SPARK ✦' };
  if (all.includes('shimmer') || all.includes('sheen') || all.includes('sweep') || all.includes('specular')) return { type: 'shimmer', label: 'SHIMMER' };

  // Transition & Background
  if (all.includes('wipe')) return { type: 'wipe', label: 'WIPE ◧' };
  if (all.includes('grid') || all.includes('mesh')) return { type: 'grid', label: 'GRID' };
  if (all.includes('drift') || all.includes('stars')) return { type: 'stars', label: 'STARS' };

  // Fallbacks by category
  if (effect.category === 'exit') return { type: 'exit-fade', label: 'OUT' };
  if (effect.category === 'kinetic-typography') return { type: 'pulse', label: 'KINETIC' };
  if (effect.category === 'camera') return { type: 'shake', label: 'CAMERA' };
  if (effect.category === 'transition') return { type: 'wipe', label: 'TRANSITION' };
  if (effect.category === 'background') return { type: 'stars', label: 'BACKGROUND' };
  if (effect.category === 'graphic-accent') return { type: 'shimmer', label: 'ACCENT' };

  return { type: 'fade', label: 'MOTION' };
}

/** Embedded live animation thumbnail showcasing the exact visual motion style of each effect */
function EffectLiveThumbnail({
  effect,
  isActive,
  isPreviewing,
}: {
  effect: StudioEffectCatalogItem;
  isActive: boolean;
  isPreviewing: boolean;
}) {
  const v = getEffectVisualType(effect);

  return (
    <div className="relative h-20 w-full overflow-hidden rounded-md bg-[#07090f] border border-[#1b1f2d] flex items-center justify-center select-none group-hover:border-cyan-500/40 transition-all">
      {/* Studio Canvas Stage Background Grid */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)',
          backgroundSize: '10px 10px',
        }}
      />

      {/* 1. Slide Directions */}
      {v.type === 'slide-left' && (
        <div
          className="flex h-7 px-3 items-center justify-center rounded border border-emerald-500/60 bg-emerald-950/70 shadow-md text-[9px] font-bold text-emerald-300"
          style={{ animation: 'efSlideLeft 2.2s cubic-bezier(0.2, 0.8, 0.2, 1) infinite' }}
        >
          <span>{v.label}</span>
        </div>
      )}
      {v.type === 'slide-right' && (
        <div
          className="flex h-7 px-3 items-center justify-center rounded border border-emerald-500/60 bg-emerald-950/70 shadow-md text-[9px] font-bold text-emerald-300"
          style={{ animation: 'efSlideRight 2.2s cubic-bezier(0.2, 0.8, 0.2, 1) infinite' }}
        >
          <span>{v.label}</span>
        </div>
      )}
      {v.type === 'slide-up' && (
        <div
          className="flex h-7 px-3 items-center justify-center rounded border border-emerald-500/60 bg-emerald-950/70 shadow-md text-[9px] font-bold text-emerald-300"
          style={{ animation: 'efSlideUp 2.2s cubic-bezier(0.2, 0.8, 0.2, 1) infinite' }}
        >
          <span>{v.label}</span>
        </div>
      )}
      {v.type === 'slide-down' && (
        <div
          className="flex h-7 px-3 items-center justify-center rounded border border-emerald-500/60 bg-emerald-950/70 shadow-md text-[9px] font-bold text-emerald-300"
          style={{ animation: 'efSlideDown 2.2s cubic-bezier(0.2, 0.8, 0.2, 1) infinite' }}
        >
          <span>{v.label}</span>
        </div>
      )}

      {/* 2. Drop / Gravity Bounce */}
      {v.type === 'drop' && (
        <div
          className="flex h-7 px-3 items-center justify-center rounded border border-emerald-500/60 bg-emerald-950/70 shadow-md text-[9px] font-bold text-emerald-300"
          style={{ animation: 'efDrop 2.2s ease-in-out infinite' }}
        >
          <span>{v.label}</span>
        </div>
      )}

      {/* 3. Spin & Vortex */}
      {v.type === 'spin' && (
        <div
          className="flex h-8 w-12 items-center justify-center rounded border border-cyan-500/60 bg-cyan-950/70 shadow-md text-[9px] font-bold text-cyan-300"
          style={{ animation: 'efSpin 2.4s cubic-bezier(0.2, 0.8, 0.2, 1) infinite' }}
        >
          <span>↻ 360°</span>
        </div>
      )}

      {/* 4. Tilt / Flip */}
      {v.type === 'tilt' && (
        <div
          className="flex h-7 px-3 items-center justify-center rounded border border-emerald-500/60 bg-emerald-950/70 shadow-md text-[9px] font-bold text-emerald-300"
          style={{ animation: 'efTilt 2.2s ease-in-out infinite' }}
        >
          <span>{v.label}</span>
        </div>
      )}

      {/* 5. Fade In & Exit Fade */}
      {(v.type === 'fade' || v.type === 'exit-fade') && (
        <div
          className={`flex h-7 px-3 items-center justify-center rounded border shadow-md text-[9px] font-bold ${
            v.type === 'exit-fade'
              ? 'border-rose-500/60 bg-rose-950/70 text-rose-300'
              : 'border-emerald-500/60 bg-emerald-950/70 text-emerald-300'
          }`}
          style={{
            animation:
              v.type === 'exit-fade'
                ? 'efExit 2.2s ease-in-out infinite'
                : 'efFade 2.2s ease-in-out infinite',
          }}
        >
          <span>{v.label}</span>
        </div>
      )}

      {/* 6. Elastic Pop / Bounce */}
      {v.type === 'pop' && (
        <div
          className="flex h-7 px-3 items-center justify-center rounded border border-emerald-500/60 bg-emerald-950/70 shadow-md text-[9px] font-bold text-emerald-300"
          style={{ animation: 'efPop 2.2s cubic-bezier(0.34, 1.56, 0.64, 1) infinite' }}
        >
          <span>{v.label}</span>
        </div>
      )}

      {/* 7. Zoom / Scale */}
      {v.type === 'zoom' && (
        <div
          className="flex h-7 px-3 items-center justify-center rounded border border-cyan-500/60 bg-cyan-950/70 shadow-md text-[9px] font-bold text-cyan-300"
          style={{ animation: 'efZoom 2.2s ease-in-out infinite' }}
        >
          <span>{v.label}</span>
        </div>
      )}

      {/* 8. Glitch */}
      {v.type === 'glitch' && (
        <div
          className="flex items-center justify-center px-3 py-1 rounded bg-black/80 border border-cyan-400 font-mono text-[11px] font-black tracking-widest text-white shadow-md"
          style={{ animation: 'efGlitch 1.2s steps(2) infinite' }}
        >
          <span>GLITCH</span>
        </div>
      )}

      {/* 9. Typewriter */}
      {v.type === 'typewriter' && (
        <div className="flex items-center gap-0.5 px-2 py-1 rounded bg-cyan-950/70 border border-cyan-500/50 font-mono text-[10px] text-cyan-300">
          <span className="font-bold">TEXT</span>
          <span className="animate-ping font-bold text-white">_</span>
        </div>
      )}

      {/* 10. Pulse / Heartbeat */}
      {v.type === 'pulse' && (
        <div
          className="flex items-center gap-1 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-400 text-[10px] font-black text-cyan-300 shadow-sm"
          style={{ animation: 'efPulse 1.6s ease-in-out infinite' }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          <span>PULSE</span>
        </div>
      )}

      {/* 11. Camera Shake */}
      {v.type === 'shake' && (
        <div
          className="relative h-11 w-20 rounded border border-dashed border-amber-500/60 bg-amber-950/30 flex items-center justify-center"
          style={{ animation: 'efCameraShake 1.8s ease-in-out infinite' }}
        >
          <div className="absolute left-1 top-0.5 text-[7px] text-amber-400 font-mono tracking-tighter">
            REC
          </div>
          <div className="h-2 w-2 rounded-full border border-amber-400 text-amber-400 flex items-center justify-center text-[7px] font-mono">
            +
          </div>
        </div>
      )}

      {/* 12. Arrow Indicator */}
      {v.type === 'arrow' && (
        <div
          className="flex items-center gap-1 px-3 py-1 rounded bg-teal-950/70 border border-teal-500/60 text-teal-300 font-bold text-xs"
          style={{ animation: 'efArrowPulse 1.5s ease-in-out infinite' }}
        >
          <span>ARROW</span>
          <span className="text-sm">➔</span>
        </div>
      )}

      {/* 13. Target Reticle */}
      {v.type === 'reticle' && (
        <div className="relative h-10 w-10 flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-full border border-dashed border-teal-400/80"
            style={{ animation: 'efReticleSpin 4s linear infinite' }}
          />
          <div className="h-4 w-4 rounded-full border border-teal-300 flex items-center justify-center text-[7px] text-teal-300 font-mono">
            +
          </div>
        </div>
      )}

      {/* 14. Rule Underline */}
      {v.type === 'rule' && (
        <div className="flex flex-col items-center gap-1 w-full px-4">
          <span className="text-[10px] font-bold text-teal-300">HEADER</span>
          <div
            className="h-0.5 bg-teal-400 rounded-full"
            style={{ animation: 'efRuleDraw 2.4s ease-in-out infinite' }}
          />
        </div>
      )}

      {/* 15. Spark Cross */}
      {v.type === 'spark' && (
        <div
          className="text-teal-300 text-base"
          style={{ animation: 'efSparkleTwinkle 2s ease-in-out infinite' }}
        >
          ✦
        </div>
      )}

      {/* 16. Badge Pill */}
      {v.type === 'badge' && (
        <div
          className="px-2.5 py-0.5 rounded-full bg-teal-950/80 border border-teal-400 text-[9px] font-bold text-teal-200"
          style={{ animation: 'efPulse 2s ease-in-out infinite' }}
        >
          BADGE
        </div>
      )}

      {/* 17. Wipe Transition */}
      {v.type === 'wipe' && (
        <div className="relative h-10 w-20 overflow-hidden rounded border border-purple-500/50 bg-[#100d1a]">
          <div className="absolute inset-0 flex">
            <div className="h-full w-1/2 bg-purple-950/80 flex items-center justify-center text-[8px] text-purple-400 font-bold">
              A
            </div>
            <div className="h-full w-1/2 bg-cyan-950/80 flex items-center justify-center text-[8px] text-cyan-400 font-bold">
              B
            </div>
          </div>
          <div
            className="absolute inset-0 bg-gradient-to-r from-purple-500/40 via-white/50 to-transparent"
            style={{ animation: 'efWipe 2.4s ease-in-out infinite' }}
          />
        </div>
      )}

      {/* 18. Shimmer / Sheen */}
      {v.type === 'shimmer' && (
        <div className="relative h-9 w-18 overflow-hidden rounded-md border border-teal-500/60 bg-teal-950/40 flex items-center justify-center shadow-xs">
          <div className="text-[9px] font-black text-teal-300 tracking-wider">SHEEN</div>
          <div
            className="absolute -inset-y-2 -left-4 w-6 bg-gradient-to-r from-transparent via-white/70 to-transparent skew-x-12"
            style={{ animation: 'efShimmer 2.2s ease-in-out infinite' }}
          />
        </div>
      )}

      {/* 19. Stars / Ambient Background */}
      {v.type === 'stars' && (
        <div className="relative h-11 w-20 rounded overflow-hidden border border-indigo-500/50 bg-[#0b0c16] flex items-center justify-center">
          <div
            className="absolute h-8 w-8 rounded-full bg-indigo-500/30 blur-xs"
            style={{ animation: 'efPulse 3s ease-in-out infinite' }}
          />
          <div
            className="h-1.5 w-1.5 rounded-full bg-cyan-300 ring-1 ring-cyan-300/40"
            style={{ animation: 'efSlideLeft 2.5s ease-in-out infinite' }}
          />
          <div
            className="h-1 w-1 rounded-full bg-indigo-400 absolute left-3 top-2 ring-1 ring-indigo-400/40"
            style={{ animation: 'efSlideRight 3.2s ease-in-out infinite' }}
          />
        </div>
      )}

      {/* Live Previewing Badge */}
      {isActive && isPreviewing && (
        <div className="absolute top-1 right-1 flex items-center gap-1 rounded bg-cyan-400 px-1.5 py-0.2 text-[8px] font-bold text-zinc-950 shadow-sm animate-pulse font-mono">
          <span className="h-1 w-1 rounded-full bg-zinc-950" />
          <span>PREVIEWING</span>
        </div>
      )}
    </div>
  );
}

/** Individual, catalog-typed effects with interactive visual card gallery and direct preview. */
export function StudioEffectLibrary({
  workspacePath,
  project,
  selectedLayer,
  busy,
  preview,
  onPreview,
  onApply,
}: Props) {
  const [effects, setEffects] = useState<StudioEffectCatalogItem[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<StudioEffectCategory | ''>('');
  const [effectId, setEffectId] = useState('');
  const [params, setParams] = useState<Record<string, string | number | boolean>>({});
  const [startFrame, setStartFrame] = useState(0);
  const [durationFrames, setDurationFrames] = useState(75);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(0);

  const kind = project.composition.layers.find(layer => layer.id === selectedLayer)?.kind;

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { '': effects.length };
    for (const ef of effects) {
      counts[ef.category] = (counts[ef.category] || 0) + 1;
    }
    return counts;
  }, [effects]);

  const available = useMemo(
    () =>
      effects.filter(
        effect =>
          (!category || effect.category === category) &&
          effect.targetKinds.some(target => target === 'scene' || target === kind) &&
          [effect.id, effect.name, effect.description, ...effect.tags].some(item =>
            item.toLowerCase().includes(search.trim().toLowerCase())
          )
      ),
    [effects, category, kind, search]
  );

  const activeId = available.some(effect => effect.id === effectId)
    ? effectId
    : (available[0]?.id ?? '');
  const selected = available.find(effect => effect.id === activeId);

  const validWindow =
    Number.isSafeInteger(startFrame) &&
    startFrame >= 0 &&
    Number.isSafeInteger(durationFrames) &&
    durationFrames >= 1 &&
    startFrame + durationFrames <= project.composition.durationFrames;

  // Never forward parameters from another effect: SuperAgent rejects unknown keys.
  const parameterValues = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(selected?.parameters ?? {}).map(([name, def]) => [
          name,
          Object.prototype.hasOwnProperty.call(params, name) ? params[name] : def.default,
        ])
      ),
    [selected, params]
  );

  const validParams = Object.entries(selected?.parameters ?? {}).every(([name, def]) => {
    const val = parameterValues[name];
    if (def.type === 'number')
      return (
        typeof val === 'number' &&
        Number.isFinite(val) &&
        (def.min === undefined || val >= def.min) &&
        (def.max === undefined || val <= def.max)
      );
    if (def.type === 'color') return typeof val === 'string' && /^#[a-fA-F0-9]{6}$/.test(val);
    if (def.type === 'boolean') return typeof val === 'boolean';
    if (def.type === 'enum') return def.choices?.includes(val as string | number) === true;
    return typeof val === 'string' && val.length <= 256 && !/[<>]/.test(val);
  });

  const canEdit = !busy && !pending && Boolean(selected) && validWindow && validParams;

  const request: StudioEffectApplication = {
    effectId: activeId,
    ...(selected?.targetKinds.includes(kind ?? 'scene') && kind && selectedLayer
      ? { targetLayerId: selectedLayer }
      : {}),
    startFrame,
    durationFrames,
    params: parameterValues,
  };

  useEffect(() => {
    let alive = true;
    version.current++;
    setEffects([]);
    setError('');
    void (async () => {
      try {
        const all: StudioEffectCatalogItem[] = [];
        for (let offset = 0; offset < 1000; offset += 100) {
          const page = await studioApi.effectsPage(workspacePath, offset);
          if (!alive) return;
          all.push(...page.effects);
          if (!page.hasMore) break;
        }
        if (alive) setEffects(all);
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
    return () => {
      alive = false;
      version.current++;
    };
  }, [workspacePath]);

  useEffect(() => {
    version.current++;
    setPending(false);
    setStartFrame(0);
    setDurationFrames(Math.min(75, project.composition.durationFrames));
    setParams({});
    onPreview(null);
    // Keep effect preview scoped to its originating project/revision and selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.revision, selectedLayer]);

  const invalidate = () => {
    version.current++;
    setPending(false);
    setError('');
    onPreview(null);
  };

  const chooseEffect = (id: string) => {
    setEffectId(id);
    const effect = effects.find(item => item.id === id);
    setParams(defaultParams(effect));
    invalidate();
  };

  const updateParam = (name: string, value: string | number | boolean) => {
    setParams(previous => ({ ...previous, [name]: value }));
    invalidate();
  };

  const showPreview = async () => {
    if (!canEdit) return;
    const sequence = ++version.current;
    setPending(true);
    setError('');
    try {
      const result = await studioApi.previewEffect(
        workspacePath,
        project.id,
        project.revision,
        request
      );
      if (sequence === version.current) onPreview(result);
    } catch (cause) {
      if (sequence === version.current)
        setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (sequence === version.current) setPending(false);
    }
  };

  const apply = () => {
    if (!canEdit) return;
    invalidate();
    onApply(request);
  };

  return (
    <details
      className="border-b border-[#222533] bg-[#0c0e15] px-4 py-3 text-zinc-100"
      aria-label="Studio Effects Library"
    >
      {/* Dynamic Keyframes for 60fps hardware-accelerated motion previews */}
      <style>{`
        @keyframes efSlideLeft {
          0% { opacity: 0; transform: translateX(36px); }
          35% { opacity: 1; transform: translateX(-3px); }
          50%, 85% { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(0); }
        }
        @keyframes efSlideRight {
          0% { opacity: 0; transform: translateX(-36px); }
          35% { opacity: 1; transform: translateX(3px); }
          50%, 85% { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(0); }
        }
        @keyframes efSlideUp {
          0% { opacity: 0; transform: translateY(28px); }
          35% { opacity: 1; transform: translateY(-3px); }
          50%, 85% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(0); }
        }
        @keyframes efSlideDown {
          0% { opacity: 0; transform: translateY(-28px); }
          35% { opacity: 1; transform: translateY(3px); }
          50%, 85% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(0); }
        }
        @keyframes efDrop {
          0% { opacity: 0; transform: translateY(-40px); }
          30% { opacity: 1; transform: translateY(4px); }
          45% { transform: translateY(-8px); }
          60% { transform: translateY(0); }
          85% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; }
        }
        @keyframes efSpin {
          0% { opacity: 0; transform: rotate(0deg) scale(0.4); }
          40% { opacity: 1; transform: rotate(360deg) scale(1); }
          85% { opacity: 1; transform: rotate(360deg) scale(1); }
          100% { opacity: 0; transform: rotate(360deg) scale(0.7); }
        }
        @keyframes efTilt {
          0% { opacity: 0; transform: rotate(-25deg) scale(0.7); }
          35% { opacity: 1; transform: rotate(4deg) scale(1.05); }
          50%, 85% { opacity: 1; transform: rotate(0deg) scale(1); }
          100% { opacity: 0; }
        }
        @keyframes efFade {
          0% { opacity: 0; transform: scale(0.96); }
          35%, 85% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1); }
        }
        @keyframes efPop {
          0% { opacity: 0; transform: scale(0.4); }
          30% { opacity: 1; transform: scale(1.2); }
          45% { transform: scale(0.9); }
          60%, 85% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.8); }
        }
        @keyframes efZoom {
          0% { opacity: 0; transform: scale(0.2); }
          35%, 85% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.4); }
        }
        @keyframes efGlitch {
          0%, 100% { transform: translate(0, 0); text-shadow: -2px 0 #00ffff, 2px 0 #ff00ff; }
          25% { transform: translate(-3px, 1px); text-shadow: 3px 0 #00ffff, -3px 0 #ff00ff; }
          50% { transform: translate(2px, -2px); text-shadow: -2px 0 #00ffff, 2px 0 #ff00ff; }
          75% { transform: translate(-1px, 2px); text-shadow: 2px 0 #00ffff, -2px 0 #ff00ff; }
        }
        @keyframes efPulse {
          0%, 100% { transform: scale(1); }
          20% { transform: scale(1.22); }
          35% { transform: scale(1); }
          50% { transform: scale(1.15); }
          70% { transform: scale(1); }
        }
        @keyframes efCameraShake {
          0%, 100% { transform: translate(0, 0); }
          15% { transform: translate(-4px, 2px); }
          30% { transform: translate(3px, -3px); }
          45% { transform: translate(-2px, -2px); }
          60% { transform: translate(3px, 2px); }
          75% { transform: translate(-2px, 1px); }
        }
        @keyframes efArrowPulse {
          0%, 100% { transform: translateX(0); opacity: 0.6; }
          50% { transform: translateX(6px); opacity: 1; }
        }
        @keyframes efReticleSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes efRuleDraw {
          0% { width: 0%; opacity: 0; }
          40%, 85% { width: 85%; opacity: 1; }
          100% { width: 85%; opacity: 0; }
        }
        @keyframes efSparkleTwinkle {
          0%, 100% { transform: scale(0.6) rotate(0deg); opacity: 0.4; }
          50% { transform: scale(1.25) rotate(90deg); opacity: 1; }
        }
        @keyframes efShimmer {
          0% { transform: translateX(-120%) rotate(25deg); }
          50%, 100% { transform: translateX(200%) rotate(25deg); }
        }
        @keyframes efWipe {
          0% { clip-path: inset(0 100% 0 0); }
          45%, 80% { clip-path: inset(0 0 0 0); }
          100% { clip-path: inset(0 0 0 100%); }
        }
        @keyframes efExit {
          0%, 35% { opacity: 1; transform: scale(1) translateY(0); }
          75% { opacity: 0; transform: scale(0.6) translateY(12px); }
          100% { opacity: 0; transform: scale(0.6); }
        }
      `}</style>

      <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-zinc-200">
        <Layers3 size={14} className="text-cyan-400" />
        <span>Effects Library</span>
        <span className="rounded border border-[#2a2d3d] bg-[#161822] px-1.5 py-0.5 text-[10px] font-normal text-zinc-400 font-mono">
          {effects.length} effects
        </span>
        <span className="ml-auto text-[10px] font-normal text-zinc-500 font-mono">
          234 visual shaders & motions
        </span>
        <ChevronDown size={12} className="text-zinc-500 ml-1" />
      </summary>

      {/* Main Effects Browser & Gallery */}
      <div className="mt-3 space-y-3">
        {/* Search bar & Category select for test automation / accessibility */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-2.5 text-zinc-500" />
            <input
              aria-label="Search individual Studio effects"
              className="w-full rounded-md border border-[#2a2d3d] bg-[#12141e] pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus-visible:outline-2 focus-visible:outline-cyan-500"
              value={search}
              onChange={event => {
                setSearch(event.target.value);
                setParams({});
                invalidate();
              }}
              placeholder={`Search ${effects.length || 234} effects (fade, kinetic, camera, glitch…)`}
            />
          </div>

          {/* Quick jump select & category combobox for full keyboard/automation parity */}
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono">
              <span className="sr-only">Category</span>
              <select
                aria-label="Studio effect category"
                className="rounded border border-[#2a2d3d] bg-[#161822] px-2 py-1 text-xs text-zinc-300 focus-visible:outline-cyan-500"
                value={category}
                onChange={event => {
                  setCategory(event.target.value as StudioEffectCategory | '');
                  setParams({});
                  invalidate();
                }}
              >
                {categories.map(item => (
                  <option key={item.value} value={item.value}>
                    {item.label} ({categoryCounts[item.value] ?? 0})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono">
              <span className="sr-only">Effect</span>
              <select
                aria-label="Select individual Studio effect"
                className="max-w-[150px] truncate rounded border border-[#2a2d3d] bg-[#161822] px-2 py-1 text-xs text-zinc-300 focus-visible:outline-cyan-500"
                value={activeId}
                onChange={event => chooseEffect(event.target.value)}
              >
                {available.map(effect => (
                  <option value={effect.id} key={effect.id}>
                    {effect.name}
                  </option>
                ))}
                {!available.length && <option value="">No matching effects</option>}
              </select>
            </label>
          </div>
        </div>

        {/* Category Pills with live counter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {categories.map(item => {
            const isSelected = category === item.value;
            const count = categoryCounts[item.value] ?? 0;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setCategory(item.value as StudioEffectCategory | '');
                  setParams({});
                  invalidate();
                }}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all shrink-0 ${
                  isSelected
                    ? 'bg-cyan-500 text-zinc-950 font-bold shadow-xs'
                    : 'bg-[#161822] text-zinc-400 hover:text-zinc-200 border border-[#2a2d3d]'
                }`}
              >
                <span>{item.label}</span>
                <span
                  className={`text-[10px] font-mono ${
                    isSelected ? 'text-zinc-900 font-bold' : 'text-zinc-500'
                  }`}
                >
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Visual Effect Cards Gallery with Live Animated Motion Thumbnails */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto custom-scrollbar p-0.5">
          {available.map(ef => {
            const isActive = ef.id === activeId;
            const color = categoryColors[ef.category] || {
              bg: 'bg-zinc-800',
              text: 'text-zinc-300',
              border: 'border-zinc-700',
            };
            return (
              <div
                key={ef.id}
                onClick={() => chooseEffect(ef.id)}
                className={`group relative flex flex-col justify-between rounded-lg border p-2 transition-all cursor-pointer ${
                  isActive
                    ? 'border-cyan-400 bg-[#161d2b] shadow-sm shadow-cyan-950/40 ring-1 ring-cyan-500/50'
                    : 'border-[#222533] bg-[#12141e] hover:border-cyan-500/40 hover:bg-[#181b28]'
                }`}
              >
                <div>
                  {/* Embedded Live Motion Thumbnail */}
                  <EffectLiveThumbnail
                    effect={ef}
                    isActive={isActive}
                    isPreviewing={Boolean(isActive && preview)}
                  />

                  {/* Card Info & Meta */}
                  <div className="mt-2">
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <h4 className="text-xs font-bold text-zinc-100 truncate group-hover:text-cyan-300">
                        {ef.name}
                      </h4>
                      <span
                        className={`inline-block text-[9px] px-1.5 py-0.2 rounded font-mono uppercase shrink-0 font-medium ${color.bg} ${color.text}`}
                      >
                        {ef.category}
                      </span>
                    </div>

                    <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed mb-2">
                      {ef.description}
                    </p>
                  </div>
                </div>

                <div className="pt-1.5 border-t border-[#222533]/80">
                  <span className="font-mono text-zinc-500 text-[9px] uppercase font-medium truncate block">
                    {ef.targetKinds.join(' · ')}
                  </span>
                </div>
              </div>
            );
          })}

          {!available.length && (
            <div className="col-span-full rounded-lg border border-dashed border-[#2a2d3d] p-6 text-center text-xs text-zinc-500 bg-[#12141e]">
              No effects match the current filter or layer type.
            </div>
          )}
        </div>

        {/* Config & Action Inspector Panel */}
        <div className="rounded-lg border border-[#222533] bg-[#10121a] p-3 space-y-3 shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222533] pb-2">
            <div>
              {selected ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-100">{selected.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">({selected.id})</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{selected.description}</p>
                </>
              ) : (
                <>
                  <span className="text-xs font-bold text-zinc-300">No Effect Selected</span>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Select a compatible effect card above to configure parameters and apply.
                  </p>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={button}
                disabled={!canEdit}
                onClick={() => void showPreview()}
              >
                {pending ? (
                  <Loader2 size={13} className="animate-spin text-cyan-400" />
                ) : (
                  <Eye size={13} className="text-cyan-400" />
                )}
                <span>Preview</span>
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-teal-400 to-cyan-400 px-3 py-1.5 text-xs font-bold text-zinc-950 shadow-md shadow-cyan-500/20 hover:brightness-110 active:scale-95 disabled:opacity-40 transition-all"
                disabled={!canEdit}
                onClick={apply}
              >
                <Save size={13} className="stroke-[2.5]" />
                <span>Apply</span>
              </button>
              {preview && (
                <button
                  type="button"
                  className={button}
                  aria-label="Close single effect preview"
                  onClick={invalidate}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Timing parameters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label className="text-[10px] text-zinc-400 font-medium">
              Start frame
              <input
                aria-label="Effect start frame"
                type="number"
                min="0"
                step="1"
                className={field}
                value={startFrame}
                onChange={event => {
                  setStartFrame(Number(event.target.value));
                  invalidate();
                }}
              />
            </label>
            <label className="text-[10px] text-zinc-400 font-medium">
              Frames
              <input
                aria-label="Effect duration"
                type="number"
                min="1"
                step="1"
                className={field}
                value={durationFrames}
                onChange={event => {
                  setDurationFrames(Number(event.target.value));
                  invalidate();
                }}
              />
            </label>
          </div>

          {/* Dynamic Effect Parameters */}
          {selected && Object.keys(selected.parameters).length > 0 && (
            <div
              className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 pt-1"
              aria-label="Studio effect parameters"
            >
              {Object.entries(selected.parameters).map(([name, def]) => (
                <label
                  key={selected.id + ':' + name}
                  className="text-[10px] text-zinc-400 font-medium"
                >
                  {def.name}
                  {def.type === 'boolean' ? (
                    <input
                      type="checkbox"
                      className="ml-2 accent-cyan-500"
                      aria-label={'Effect parameter ' + name}
                      checked={parameterValues[name] === true}
                      onChange={event => updateParam(name, event.target.checked)}
                    />
                  ) : def.type === 'enum' ? (
                    <select
                      className={field}
                      aria-label={'Effect parameter ' + name}
                      value={String(parameterValues[name])}
                      onChange={event =>
                        updateParam(
                          name,
                          def.choices?.find(choice => String(choice) === event.target.value) ??
                            event.target.value
                        )
                      }
                    >
                      {(def.choices ?? []).map(choice => (
                        <option value={String(choice)} key={String(choice)}>
                          {String(choice)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className={field}
                      aria-label={'Effect parameter ' + name}
                      type={def.type === 'number' ? 'number' : def.type === 'color' ? 'color' : 'text'}
                      {...(def.type === 'number'
                        ? { min: def.min, max: def.max, step: def.step ?? 'any' }
                        : {})}
                      value={String(parameterValues[name] ?? '')}
                      onChange={event =>
                        updateParam(
                          name,
                          def.type === 'number' ? Number(event.target.value) : event.target.value
                        )
                      }
                    />
                  )}
                  <span className="mt-0.5 block text-[10px] text-zinc-500 leading-tight">
                    {def.description}
                  </span>
                </label>
              ))}
            </div>
          )}

          <p className="text-[10px] text-zinc-400 font-mono">
            {error || selected?.description || 'Select a compatible effect and layer.'}
            {selected?.targetKinds.includes('scene') &&
            !selected?.targetKinds.includes(kind ?? 'scene')
              ? ' · Applies to the entire scene'
              : ''}
            {preview ? ' · Previewing on canvas stage' : ''}
          </p>
        </div>
      </div>
    </details>
  );
}
