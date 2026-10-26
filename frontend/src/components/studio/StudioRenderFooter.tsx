import React from 'react';
import { Film, X, Download, ExternalLink } from 'lucide-react';
import type { StudioJob } from '../../services/studioApi';
import { StudioExtraExportPanel } from '../StudioExtraExportPanel';

interface Props {
  workspacePath: string;
  projectName: string;
  jobs: StudioJob[];
  projectId: string;
  activeJobId: string;
  onSelectJobId: (id: string) => void;
  job: StudioJob | null;
  codeExportAvailable: boolean;
  codeFormat: 'html' | 'react' | 'react-jsx';
  onChangeCodeFormat: (format: 'html' | 'react' | 'react-jsx') => void;
  reactCodeAvailable: boolean;
  editableReactAvailable: boolean;
  codeTrigger: 'autoplay' | 'scroll' | 'click' | 'hover';
  onChangeCodeTrigger: (trigger: 'autoplay' | 'scroll' | 'click' | 'hover') => void;
  onExportWebCode: () => void;
  onCancelJob: () => void;
  previewUrl: string;
  extraExportsAvailable: boolean;
  busy: boolean;
}

const idle = new Set<StudioJob['status']>(['completed', 'failed', 'cancelled', 'interrupted']);
const control = 'rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2.5 py-1.5 text-xs text-[var(--text-main)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';
const action = 'inline-flex items-center gap-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-card-hover)] hover:border-[var(--color-primary)]/40 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40 disabled:pointer-events-none';
const primary = 'inline-flex items-center gap-1.5 rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none';

export function StudioRenderFooter({
  workspacePath,
  projectName,
  jobs,
  projectId,
  activeJobId,
  onSelectJobId,
  job,
  codeExportAvailable,
  codeFormat,
  onChangeCodeFormat,
  reactCodeAvailable,
  editableReactAvailable,
  codeTrigger,
  onChangeCodeTrigger,
  onExportWebCode,
  onCancelJob,
  previewUrl,
  extraExportsAvailable,
  busy,
}: Props) {
  const projectJobs = jobs.filter(item => item.projectId === projectId);

  return (
    <footer className="border-t border-[var(--border-color)] bg-[var(--bg-sidebar)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2" aria-label="Render jobs">
        <div className="flex min-w-0 items-center gap-2.5 text-xs">
          <Film size={14} className="text-[var(--color-primary)] shrink-0" />
          <select
            className={control + ' max-w-[210px] font-mono text-[11px]'}
            aria-label="Select render job"
            value={activeJobId}
            onChange={event => onSelectJobId(event.target.value)}
          >
            <option value="">No render selected</option>
            {projectJobs.map(item => (
              <option key={item.id} value={item.id}>
                {item.id.slice(-8)} · {item.status}
              </option>
            ))}
          </select>

          {job && (
            <span className="font-mono text-[11px] text-[var(--text-muted)] bg-[var(--bg-card)] px-2 py-0.5 rounded border border-[var(--border-color)]">
              {job.status} {job.framesCompleted}/{job.profile.frameCount}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {codeExportAvailable && (
            <div className="flex items-center gap-1.5">
              <select
                aria-label="Studio to Code format"
                className={control + ' w-28 text-[11px]'}
                disabled={busy}
                value={codeFormat}
                onChange={event => onChangeCodeFormat(event.target.value as 'html' | 'react' | 'react-jsx')}
              >
                <option value="html">Offline HTML</option>
                {reactCodeAvailable && <option value="react">React / Next (wrapper)</option>}
                {editableReactAvailable && <option value="react-jsx">Editable React JSX</option>}
              </select>

              <select
                aria-label="Studio to Code interaction"
                value={codeTrigger}
                onChange={event => onChangeCodeTrigger(event.target.value as typeof codeTrigger)}
                disabled={busy}
                className={control + ' w-24 text-[11px]'}
              >
                <option value="autoplay">Autoplay</option>
                <option value="scroll">Scroll</option>
                <option value="click">Click</option>
                <option value="hover">Hover</option>
              </select>

              <button
                type="button"
                className={action}
                disabled={busy}
                onClick={onExportWebCode}
                title="Offline HTML + SVG + native animation. Vector/text/path scenes only."
              >
                <Film size={12} /> Export Web Code
              </button>
            </div>
          )}

          {job && !idle.has(job.status) && (
            <button className={action + ' hover:text-red-400 hover:border-red-500/40'} onClick={onCancelJob} disabled={busy}>
              <X size={12} /> Cancel
            </button>
          )}

          {job?.status === 'completed' && previewUrl && (
            <>
              <a
                className={primary}
                href={previewUrl}
                download={projectName.replace(/[^a-z0-9-_]+/gi, '-') + '.mp4'}
              >
                <Download size={12} /> Download preview
              </a>
              <button
                className={action}
                onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink size={12} /> Open MP4
              </button>
            </>
          )}
        </div>
      </div>

      {job?.status === 'completed' && previewUrl && (
        <video
          aria-label="Rendered Studio MP4"
          className="max-h-24 w-full border-t border-[var(--border-color)] bg-black"
          controls
          src={previewUrl}
        />
      )}

      {job?.status === 'completed' && extraExportsAvailable && (
        <StudioExtraExportPanel
          key={job.id}
          workspacePath={workspacePath}
          jobId={job.id}
          filename={projectName.replace(/[^a-z0-9-_]+/gi, '-')}
        />
      )}

      {job?.error && (
        <p role="alert" className="border-t border-red-900 bg-red-950/40 px-4 py-2 text-xs text-red-400 font-mono">
          {job.error}
        </p>
      )}
    </footer>
  );
}
