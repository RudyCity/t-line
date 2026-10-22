import { useEffect, useRef, useState } from 'react';
import { LayoutTemplate, Eye, Save, Loader2, X } from 'lucide-react';
import {
  motionStudioApi, type MotionProject, type MotionTemplateSummary,
  type MotionTemplateInput,
} from '../services/motionStudioApi';

interface Props {
  workspacePath: string;
  project: MotionProject;
  busy: boolean;
  preview: MotionProject | null;
  onPreview: (project: MotionProject | null) => void;
  onApply: (input: MotionTemplateInput) => void;
}
const field = 'mt-1 w-full rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1.5 text-xs';
const button = 'inline-flex items-center gap-1.5 rounded border border-[var(--border-color)] px-3 py-2 text-xs hover:bg-[var(--surface-overlay-hover)] disabled:opacity-40';

export function MotionTemplatePanel({ workspacePath, project, busy, preview, onPreview, onApply }: Props) {
  const [templates, setTemplates] = useState<MotionTemplateSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [headline, setHeadline] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  useEffect(() => {
    let active = true;
    setTemplates([]); setError('');
    void motionStudioApi.templates(workspacePath).then(result => {
      if (active) setTemplates(result.templates);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { active = false; sequence.current++; };
  }, [workspacePath]);
  useEffect(() => {
    sequence.current++;
    setPending(false); setHeadline(''); setSubtitle(''); onPreview(null);
    // Keep previews scoped to the originating project and committed revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.revision]);
  const selected = templates.find(template => template.id === selectedId) ?? templates[0];
  const canEdit = Boolean(selected) && !busy && !pending && headline.length <= 120 &&
    subtitle.length <= 160;
  const input: MotionTemplateInput = {
    templateId: selected?.id ?? '', ...(headline.trim() ? { headline: headline.trim() } : {}),
    ...(subtitle.trim() ? { subtitle: subtitle.trim() } : {}),
  };
  const invalidate = () => { sequence.current++; setPending(false); setError(''); onPreview(null); };
  const showPreview = async () => {
    if (!canEdit) return;
    const n = ++sequence.current;
    setPending(true); setError('');
    try {
      const temporary = await motionStudioApi.previewTemplate(workspacePath, project.id, project.revision, input);
      if (n === sequence.current) onPreview(temporary);
    } catch (cause) {
      if (n === sequence.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (n === sequence.current) setPending(false);
    }
  };
  const apply = () => { if (!canEdit) return; invalidate(); onApply(input); };
  return (
    <details aria-label="Motion Scene Templates" className="border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 py-3">
      <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
        <LayoutTemplate size={14}/> Scene Templates
        <span className="rounded border border-[var(--border-color)] px-1.5 py-0.5 text-[10px] font-normal">
          {templates.length} templates
        </span>
        <span className="ml-auto text-[10px] font-normal text-[var(--text-muted)]">
          Workspace Brand Kit applied
        </span>
      </summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <label className="text-[10px] text-[var(--text-muted)]">Template
          <select aria-label="Select Motion scene template" className={field} value={selected?.id ?? ''}
            onChange={e => { setSelectedId(e.target.value); invalidate(); }}>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name} · {t.category}</option>)}
            {!templates.length && <option value="">No templates</option>}
          </select>
        </label>
        <label className="text-[10px] text-[var(--text-muted)]">Headline
          <input aria-label="Template headline" className={field} value={headline}
            maxLength={120} onChange={e => { setHeadline(e.target.value); invalidate(); }}
            placeholder="Use template default" />
        </label>
        <label className="text-[10px] text-[var(--text-muted)]">Subtitle
          <input aria-label="Template subtitle" className={field} value={subtitle}
            maxLength={160} onChange={e => { setSubtitle(e.target.value); invalidate(); }}
            placeholder="Use template default" />
        </label>
        <div className="flex gap-1">
          <button type="button" className={button} onClick={() => void showPreview()} disabled={!canEdit}>
            {pending ? <Loader2 size={13} className="animate-spin"/> : <Eye size={13}/>} Preview
          </button>
          <button type="button" className={button} onClick={apply} disabled={!canEdit}><Save size={13}/> Apply</button>
          {preview && <button type="button" className={button} aria-label="Close template preview"
            onClick={invalidate}><X size={13}/></button>}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-[var(--text-muted)]">
        {error || selected?.description || 'Choose a scene template.'}
        {' · Apply replaces the current scene layers; Undo restores them.'}
        {preview && ' · Preview is not saved.'}
      </p>
    </details>
  );
}
