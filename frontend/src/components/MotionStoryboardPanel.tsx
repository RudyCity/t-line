import { useEffect, useRef, useState } from 'react';
import { Eye, Loader2, Sparkles, Video } from 'lucide-react';
import {
  motionStudioApi, type MotionDirectorResult, type MotionProject, type MotionStoryboardPlan,
} from '../services/motionStudioApi';
import { MotionCanvas } from './MotionCanvas';

interface Props {
  workspacePath: string;
  busy: boolean;
  renderWidth: number;
  onCreated: (result: MotionDirectorResult) => void;
}
const input = 'w-full rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1.5 text-xs';
const button = 'inline-flex items-center gap-1.5 rounded border border-[var(--border-color)] px-3 py-2 text-xs hover:bg-[var(--surface-overlay-hover)] disabled:opacity-40';

export function MotionStoryboardPanel({ workspacePath, busy, renderWidth, onCreated }: Props) {
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState<MotionStoryboardPlan | null>(null);
  const [preview, setPreview] = useState<MotionProject | null>(null);
  const [frame, setFrame] = useState(0);
  const [working, setWorking] = useState<'plan' | 'preview' | 'render' | null>(null);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  useEffect(() => {
    sequence.current++;
    setPrompt(''); setPlan(null); setPreview(null); setError(''); setFrame(0); setWorking(null);
    return () => { sequence.current++; };
  }, [workspacePath]);
  const invalidate = () => { sequence.current++; setPreview(null); setFrame(0); setError(''); setWorking(null); };
  const planNow = async () => {
    if (busy || working || !prompt.trim() || prompt.length > 2000) return;
    const n = ++sequence.current; setWorking('plan'); setError(''); setPlan(null); setPreview(null);
    try {
      const result = await motionStudioApi.storyboardPlan(workspacePath, prompt);
      if (n !== sequence.current) return;
      setPlan(result.plan); setPreview(result.preview);
    } catch (cause) { if (n === sequence.current) setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { if (n === sequence.current) setWorking(null); }
  };
  const patchScene = (index: number, key: 'headline' | 'subtitle' | 'accent' | 'layout', value: string) => {
    setPlan(current => current ? {
      ...current, scenes: current.scenes.map((scene, i) =>
        i !== index ? scene : { ...scene, [key]: value }),
    } : null);
    invalidate();
  };
  const previewNow = async () => {
    if (!plan || busy || working) return;
    const n = ++sequence.current; setWorking('preview'); setError('');
    try {
      const result = await motionStudioApi.storyboardPreview(workspacePath, plan);
      if (n === sequence.current) { setPreview(result.preview); setFrame(0); }
    } catch (cause) { if (n === sequence.current) setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { if (n === sequence.current) setWorking(null); }
  };
  const renderNow = async () => {
    if (!plan || busy || working || !preview) return;
    const n = ++sequence.current; setWorking('render'); setError('');
    try {
      const result = await motionStudioApi.storyboardRender(workspacePath, plan, renderWidth);
      if (n === sequence.current) {
        onCreated(result);
        setPlan(null); setPreview(null);
      }
    } catch (cause) { if (n === sequence.current) setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { if (n === sequence.current) setWorking(null); }
  };
  const valid = Boolean(plan && plan.scenes.length >= 1 && plan.scenes.length <= 3 &&
    plan.name.trim() && plan.scenes.every(scene => scene.headline.trim() && /^#[a-f0-9]{6}$/i.test(scene.accent)));
  return (
    <details aria-label="AI Motion storyboard review" className="border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 py-3">
      <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
        <Sparkles size={14} /> AI Motion Director 2.0 · Storyboard Review
        <span className="ml-auto text-[10px] font-normal text-[var(--text-muted)]">Prompt → Review scenes → Preview → Approve render</span>
      </summary>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-[280px] flex-1 text-[10px] text-[var(--text-muted)]">Creative brief
          <textarea className={input} aria-label="Storyboard creative brief" rows={2}
            maxLength={2000} value={prompt} disabled={busy || !!working}
            placeholder="Buat motion promosi SaaS modern, tiga scene, tipografi dinamis…"
            onChange={event => { setPrompt(event.target.value); invalidate(); }} />
        </label>
        <button type="button" className={button} disabled={busy || !!working || !prompt.trim()}
          onClick={() => void planNow()}>
          {working === 'plan' ? <Loader2 size={13} className="animate-spin"/> : <Sparkles size={13}/>} Plan storyboard
        </button>
      </div>
      {plan && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label>Project name <input className={input} aria-label="Storyboard project name" maxLength={160}
              value={plan.name} onChange={e => { setPlan(p => p ? { ...p, name: e.target.value } : p); invalidate(); }}/></label>
            <span className="text-[var(--text-muted)]">{plan.durationSeconds}s · {plan.aspectRatio ?? '16:9'} · {plan.artDirection ?? 'editorial'}</span>
          </div>
          <div className="grid gap-2 lg:grid-cols-3">
            {plan.scenes.map((scene, index) => (
              <div key={index} className="space-y-2 rounded border border-[var(--border-color)] p-2">
                <strong className="text-xs">Scene {index + 1}</strong>
                <label className="block text-[10px]">Headline
                  <input className={input} aria-label={'Storyboard headline ' + index}
                    maxLength={100} value={scene.headline} onChange={e => patchScene(index, 'headline', e.target.value)}/>
                </label>
                <label className="block text-[10px]">Subtitle
                  <input className={input} aria-label={'Storyboard subtitle ' + index}
                    maxLength={100} value={scene.subtitle ?? ''} onChange={e => patchScene(index, 'subtitle', e.target.value)}/>
                </label>
                <div className="flex items-end gap-2">
                  <label className="flex-1 text-[10px]">Layout
                    <select className={input} aria-label={'Storyboard layout ' + index}
                      value={scene.layout ?? 'left'} onChange={e => patchScene(index, 'layout', e.target.value)}>
                      <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
                    </select>
                  </label>
                  <label className="text-[10px]">Accent
                    <input type="color" aria-label={'Storyboard accent ' + index}
                      className="block h-8 w-10" value={scene.accent}
                      onChange={e => patchScene(index, 'accent', e.target.value)}/>
                  </label>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} disabled={busy || !!working || !valid}
              onClick={() => void previewNow()}><Eye size={13}/> Preview storyboard</button>
            <button type="button" className={button} disabled={busy || !!working || !valid || !preview}
              onClick={() => void renderNow()}>
              {working === 'render' ? <Loader2 size={13} className="animate-spin"/> : <Video size={13}/>}
              Approve & render MP4
            </button>
            <span className="text-[10px] text-[var(--text-muted)]">
              Explicit approval required. Review previews do not create files.
            </span>
          </div>
          {preview && <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div className="h-52 max-w-lg overflow-hidden rounded border border-[var(--border-color)]">
              <MotionCanvas project={preview} frame={frame} selectedLayer={null}
                isActive={false} busy snapping={false}
                onSelectLayer={() => {}} onStopPlayback={() => {}} onEdit={() => {}}/>
            </div>
            <label className="self-center text-[10px] text-[var(--text-muted)]">Storyboard frame {frame}
              <input className="mt-2 w-full" aria-label="Storyboard preview frame" type="range"
                min={0} max={preview.composition.durationFrames - 1} value={frame}
                onChange={e => setFrame(Number(e.target.value))}/>
            </label>
          </div>}
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
      <p className="mt-2 text-[10px] text-[var(--text-muted)]">
        Model connection required for planning; approved rendering uses declarative scene layers. Add music, voiceover and imported images in the editor.
      </p>
    </details>
  );
}
