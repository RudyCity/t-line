import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Eye, Layers3, Loader2, Save, X } from 'lucide-react';
import {
  studioApi, type StudioEffectCatalogItem, type StudioEffectApplication,
  type StudioEffectCategory, type StudioProject,
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
const field = 'mt-1 w-full rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1.5 text-xs text-[var(--text-main)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';
const button = 'inline-flex items-center justify-center gap-1.5 rounded border border-[var(--border-color)] px-3 py-2 text-xs font-medium hover:bg-[var(--surface-overlay-hover)] focus-visible:outline-2 disabled:opacity-40';
const categories: Array<{ value: StudioEffectCategory | ''; label: string }> = [
  { value: '', label: 'All categories' },
  { value: 'entrance', label: 'Entrance' }, { value: 'exit', label: 'Exit' },
  { value: 'kinetic-typography', label: 'Kinetic typography' },
  { value: 'camera', label: 'Camera' }, { value: 'transition', label: 'Transition' },
  { value: 'background', label: 'Background' }, { value: 'graphic-accent', label: 'Graphic accent' },
];

function defaultParams(effect?: StudioEffectCatalogItem): Record<string, string | number | boolean> {
  return Object.fromEntries(Object.entries(effect?.parameters ?? {})
    .map(([name, def]) => [name, def.default]));
}

/** Individual, catalog-typed effects. A preview is compiled by SuperAgent and never writes to disk. */
export function StudioEffectLibrary({ workspacePath, project, selectedLayer, busy, preview, onPreview, onApply }: Props) {
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
  const available = useMemo(() => effects.filter(effect =>
    (!category || effect.category === category) &&
    effect.targetKinds.some(target => target === 'scene' || target === kind) &&
    [effect.id, effect.name, effect.description, ...effect.tags]
      .some(item => item.toLowerCase().includes(search.trim().toLowerCase()))), [effects, category, kind, search]);
  const activeId = available.some(effect => effect.id === effectId) ? effectId : (available[0]?.id ?? '');
  const selected = available.find(effect => effect.id === activeId);
  const validWindow = Number.isSafeInteger(startFrame) && startFrame >= 0 &&
    Number.isSafeInteger(durationFrames) && durationFrames >= 1 &&
    startFrame + durationFrames <= project.composition.durationFrames;
  // Never forward parameters from another effect: SuperAgent rejects unknown keys.
  const parameterValues = useMemo(() => Object.fromEntries(
    Object.entries(selected?.parameters ?? {}).map(([name, def]) =>
      [name, Object.prototype.hasOwnProperty.call(params, name) ? params[name] : def.default])
  ), [selected, params]);
  const validParams = Object.entries(selected?.parameters ?? {}).every(([name, def]) => {
    const val = parameterValues[name];
    if (def.type === 'number') return typeof val === 'number' && Number.isFinite(val) &&
      (def.min === undefined || val >= def.min) && (def.max === undefined || val <= def.max);
    if (def.type === 'color') return typeof val === 'string' && /^#[a-fA-F0-9]{6}$/.test(val);
    if (def.type === 'boolean') return typeof val === 'boolean';
    if (def.type === 'enum') return def.choices?.includes(val as string | number) === true;
    return typeof val === 'string' && val.length <= 256 && !/[<>]/.test(val);
  });
  const canEdit = !busy && !pending && Boolean(selected) && validWindow && validParams;
  const request: StudioEffectApplication = {
    effectId: activeId,
    ...(selected?.targetKinds.includes(kind ?? 'scene') && kind && selectedLayer
      ? { targetLayerId: selectedLayer } : {}),
    startFrame, durationFrames, params: parameterValues,
  };

  useEffect(() => {
    let alive = true;
    version.current++;
    setEffects([]); setError('');
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
    return () => { alive = false; version.current++; };
  }, [workspacePath]);

  useEffect(() => {
    version.current++; setPending(false); setStartFrame(0);
    setDurationFrames(Math.min(75, project.composition.durationFrames));
    setParams({});
    onPreview(null);
    // Keep effect preview scoped to its originating project/revision and selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.revision, selectedLayer]);

  const invalidate = () => {
    version.current++; setPending(false); setError(''); onPreview(null);
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
    setPending(true); setError('');
    try {
      const result = await studioApi.previewEffect(workspacePath, project.id, project.revision, request);
      if (sequence === version.current) onPreview(result);
    } catch (cause) {
      if (sequence === version.current) setError(cause instanceof Error ? cause.message : String(cause));
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
    <details className="border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 py-3" aria-label="Studio Effects Library">
      <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
        <Layers3 size={14} /> Effects Library
        <span className="rounded border border-[var(--border-color)] px-1.5 py-0.5 text-[10px] font-normal text-[var(--text-muted)]">
          {effects.length} effects
        </span>
        <ChevronDown size={12} className="ml-auto text-[var(--text-muted)]" />
      </summary>
      <div className="mt-3 grid gap-2 md:grid-cols-[minmax(130px,1fr)_170px_minmax(155px,1.2fr)_90px_90px_auto] md:items-end">
        <label className="text-[10px] text-[var(--text-muted)]">Search effects
          <input aria-label="Search individual Studio effects" className={field} value={search}
            onChange={event => { setSearch(event.target.value); setParams({}); invalidate(); }} placeholder="fade, slide, glitch…" />
        </label>
        <label className="text-[10px] text-[var(--text-muted)]">Category
          <select aria-label="Studio effect category" className={field} value={category}
            onChange={event => { setCategory(event.target.value as StudioEffectCategory | ''); setParams({}); invalidate(); }}>
            {categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-[10px] text-[var(--text-muted)]">Effect
          <select aria-label="Select individual Studio effect" className={field} value={activeId}
            onChange={event => chooseEffect(event.target.value)}>
            {available.map(effect => <option value={effect.id} key={effect.id}>{effect.name}</option>)}
            {!available.length && <option value="">No matching effects</option>}
          </select>
        </label>
        <label className="text-[10px] text-[var(--text-muted)]">Start frame
          <input aria-label="Effect start frame" type="number" min="0" step="1" className={field}
            value={startFrame} onChange={event => { setStartFrame(Number(event.target.value)); invalidate(); }} />
        </label>
        <label className="text-[10px] text-[var(--text-muted)]">Frames
          <input aria-label="Effect duration" type="number" min="1" step="1" className={field}
            value={durationFrames} onChange={event => { setDurationFrames(Number(event.target.value)); invalidate(); }} />
        </label>
        <div className="flex items-center gap-1">
          <button type="button" className={button} disabled={!canEdit} onClick={() => void showPreview()}>
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />} Preview
          </button>
          <button type="button" className={button} disabled={!canEdit} onClick={apply}><Save size={13} /> Apply</button>
          {preview && <button type="button" className={button} aria-label="Close single effect preview" onClick={invalidate}>
            <X size={13} />
          </button>}
        </div>
      </div>
      {selected && Object.keys(selected.parameters).length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Studio effect parameters">
          {Object.entries(selected.parameters).map(([name, def]) => (
            <label key={selected.id + ':' + name} className="text-[10px] text-[var(--text-muted)]">
              {def.name}
              {def.type === 'boolean' ?
                <input type="checkbox" className="ml-2" aria-label={'Effect parameter ' + name}
                  checked={parameterValues[name] === true}
                  onChange={event => updateParam(name, event.target.checked)} /> :
               def.type === 'enum' ?
                <select className={field} aria-label={'Effect parameter ' + name}
                  value={String(parameterValues[name])}
                  onChange={event => updateParam(name, def.choices?.find(choice =>
                    String(choice) === event.target.value) ?? event.target.value)}>
                  {(def.choices ?? []).map(choice => <option value={String(choice)} key={String(choice)}>{String(choice)}</option>)}
                </select> :
                <input className={field} aria-label={'Effect parameter ' + name}
                  type={def.type === 'number' ? 'number' : def.type === 'color' ? 'color' : 'text'}
                  {...(def.type === 'number' ? { min: def.min, max: def.max, step: def.step ?? 'any' } : {})}
                  value={String(parameterValues[name] ?? '')}
                  onChange={event => updateParam(name, def.type === 'number' ? Number(event.target.value) : event.target.value)} />
              }
              <span className="mt-1 block text-[10px] leading-4 opacity-70">{def.description}</span>
            </label>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-[var(--text-muted)]">
        {error || selected?.description || 'Select a compatible effect and layer.'}
        {selected?.targetKinds.includes('scene') && !selected?.targetKinds.includes(kind ?? 'scene')
          ? ' · Applies to the entire scene' : ''}
        {preview ? ' · Preview only — not saved' : ''}
      </p>
    </details>
  );
}
