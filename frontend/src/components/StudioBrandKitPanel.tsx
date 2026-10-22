import { useEffect, useState } from 'react';
import { Palette, Save, Loader2, ImagePlus } from 'lucide-react';
import {
  studioApi, type StudioBrandKit, type StudioBrandKitInput,
} from '../services/studioApi';

const inputClass = 'mt-1 w-full rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1.5 text-xs';
const btnClass = 'inline-flex items-center gap-1.5 rounded border border-[var(--border-color)] px-3 py-2 text-xs hover:bg-[var(--surface-overlay-hover)] disabled:opacity-40';
const fonts: StudioBrandKitInput['fontFamily'][] = ['Arial','Helvetica','Georgia','Verdana','sans-serif','serif','monospace'];
const fields: Array<{ key: 'primary' | 'accent' | 'background' | 'textColor'; name: string }> = [
  { key: 'primary', name: 'Primary' }, { key: 'accent', name: 'Accent' },
  { key: 'background', name: 'Background' }, { key: 'textColor', name: 'Text' },
];
interface Props { workspacePath: string }
export function StudioBrandKitPanel({ workspacePath }: Props) {
  const [current, setCurrent] = useState<StudioBrandKit | null>(null);
  const [form, setForm] = useState<StudioBrandKitInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  useEffect(() => {
    let active = true;
    setCurrent(null); setForm(null); setSaved(''); setError('');
    void studioApi.brandKit(workspacePath).then(kit => {
      if (!active) return;
      setCurrent(kit);
      setForm({ name: kit.name, primary: kit.primary, accent: kit.accent,
        background: kit.background, textColor: kit.textColor,
        fontFamily: kit.fontFamily, ...(kit.logoAssetId ? { logoAssetId: kit.logoAssetId } : {}) });
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { active = false; };
  }, [workspacePath]);

  const set = <K extends keyof StudioBrandKitInput>(key: K, value: StudioBrandKitInput[K]) => {
    setForm(prev => prev ? { ...prev, [key]: value } : prev);
    setSaved('');
  };
  const save = async () => {
    if (!current || !form || busy) return;
    setBusy(true); setError(''); setSaved('');
    try {
      const result = await studioApi.saveBrandKit(workspacePath, current.revision, form);
      setCurrent(result); setSaved('Saved Brand Kit revision ' + result.revision);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setBusy(false); }
  };
  const uploadLogo = async (file?: File) => {
    if (!file || busy) return;
    setBusy(true); setError(''); setSaved('');
    try {
      const result = await studioApi.uploadImage(workspacePath, file);
      set('logoAssetId', result.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setBusy(false); }
  };
  return (
    <details aria-label="Studio workspace Brand Kit" className="border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 py-3">
      <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
        <Palette size={14} /> Workspace Brand Kit
        <span className="ml-auto text-[10px] font-normal text-[var(--text-muted)]">
          Colors · Font · Logo
        </span>
      </summary>
      {form && current ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-[10px] text-[var(--text-muted)]">Brand name
              <input aria-label="Studio brand name" className={inputClass} value={form.name} maxLength={80}
                onChange={e => set('name', e.target.value)} disabled={busy} />
            </label>
            <label className="text-[10px] text-[var(--text-muted)]">Font
              <select aria-label="Studio brand font" className={inputClass}
                value={form.fontFamily} disabled={busy}
                onChange={e => set('fontFamily', e.target.value as StudioBrandKitInput['fontFamily'])}>
                {fonts.map(font => <option key={font} value={font}>{font}</option>)}
              </select>
            </label>
            {fields.map(field => (
              <label key={field.key} className="text-[10px] text-[var(--text-muted)]">{field.name}
                <div className="mt-1 flex items-center gap-1.5">
                  <input aria-label={'Studio brand ' + field.key} type="color"
                    value={form[field.key]} onChange={e => set(field.key, e.target.value)}
                    disabled={busy} className="h-8 w-10 rounded border border-[var(--border-color)]" />
                  <span className="font-mono text-xs">{form[field.key]}</span>
                </div>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className={btnClass + ' cursor-pointer'}>
              <ImagePlus size={13} /> Upload logo
              <input aria-label="Upload Studio brand logo" type="file" accept="image/png,image/jpeg,image/webp"
                className="sr-only" disabled={busy}
                onChange={e => { void uploadLogo(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} />
            </label>
            {form.logoAssetId && <button type="button" className={btnClass} disabled={busy}
              onClick={() => setForm(prev => prev ? { ...prev, logoAssetId: undefined } : prev)}>Clear logo</button>}
            <button type="button" className={btnClass} disabled={busy || !form.name.trim()} onClick={() => void save()}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save Brand Kit
            </button>
            <span className="text-[10px] text-[var(--text-muted)]">
              Templates use the last saved kit · r{current.revision}
            </span>
          </div>
          {saved && <p role="status" className="text-xs text-[var(--color-primary)]">{saved}</p>}
          {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
        </div>
      ) : <p className="mt-2 text-xs text-[var(--text-muted)]">{error || 'Loading workspace Brand Kit…'}</p>}
    </details>
  );
}
