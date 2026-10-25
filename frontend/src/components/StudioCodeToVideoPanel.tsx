import { useEffect, useRef, useState } from "react";
import { studioApi, type StudioCodeVideoJob } from "../services/studioApi";

interface Props {
  workspacePath: string;
  projectId: string;
  disabled?: boolean;
}
const inputClass = "rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 text-xs text-[var(--text-main)]";
const buttonClass = "rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-overlay-hover)] disabled:opacity-40";

/** Authenticated local HTML/Studio React-wrapper → MP4 developer preview.
 * Does not execute arbitrary TSX; external React requires a self-contained HTML build.
 */
export function StudioCodeToVideoPanel({ workspacePath, projectId, disabled = false }: Props) {
  const [source, setSource] = useState<"studio" | "html">("studio");
  const [file, setFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [trusted, setTrusted] = useState(false);
  const [width, setWidth] = useState(640);
  const [height, setHeight] = useState(360);
  const [fps, setFps] = useState(12);
  const [seconds, setSeconds] = useState(2);
  const [working, setWorking] = useState(false);
  const [job, setJob] = useState<StudioCodeVideoJob | null>(null);
  const [history, setHistory] = useState<StudioCodeVideoJob[]>([]);
  const [historyError, setHistoryError] = useState("");
  const jobId = useRef<string | null>(null);
  const lifetime = useRef(0);
  useEffect(() => () => { lifetime.current += 1; }, []);
  const [error, setError] = useState("");
  const [video, setVideo] = useState("");
  const [name, setName] = useState("");
  useEffect(() => () => { if (video) URL.revokeObjectURL(video); }, [video]);
  useEffect(() => {
    let active = true;
    setHistory([]);
    setHistoryError("");
    void studioApi.listCodeVideoJobs(workspacePath).then(records => {
      if (active) setHistory(records.slice(0, 8));
    }).catch(() => {
      if (active) setHistoryError("Job history unavailable from this backend");
    });
    return () => { active = false; };
  }, [workspacePath, projectId]);
  const refreshHistory = async () => {
    const version = lifetime.current;
    try {
      const records = await studioApi.listCodeVideoJobs(workspacePath);
      if (version !== lifetime.current) return;
      setHistory(records.slice(0, 8));
      setHistoryError("");
    } catch {
      if (version === lifetime.current)
        setHistoryError("Job history refresh failed");
    }
  };
  const openPrevious = async (saved: StudioCodeVideoJob) => {
    if (working || disabled || saved.status !== "completed" || !saved.result) return;
    const version = lifetime.current;
    try {
      setError("");
      const url = await studioApi.loadCodeVideo(workspacePath, saved.result.id);
      if (version !== lifetime.current) {
        URL.revokeObjectURL(url);
        return;
      }
      setVideo(url);
      setName(saved.result.id + ".mp4");
    } catch (cause) {
      if (version === lifetime.current)
        setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  useEffect(() => {
    lifetime.current += 1;
    setVideo(""); setError(""); setFile(null); setAudioFile(null); setTrusted(false);
    setJob(null); jobId.current = null; setWorking(false);
  }, [projectId, workspacePath]);
  const submit = async () => {
    if (working || disabled) return;
    const version = lifetime.current;
    setWorking(true); setError(""); setVideo(""); setJob(null);
    try {
      if (source === "html" && (!file || !trusted)) throw new Error(
        "Choose an HTML file and confirm that you trust its source");
      const isStudioReact = source === "html" && !!file?.name.toLowerCase().endsWith(".tsx");
      if (file && file.size > (isStudioReact ? 2 * 1024 * 1024 : 256 * 1024))
        throw new Error("Code source exceeds maximum file size");
      const content = source === "html" ? await file!.text() : undefined;
      const audio = audioFile ? await studioApi.uploadAudio(workspacePath, audioFile) : undefined;
      if (version !== lifetime.current) return;
      let current = await studioApi.queueCodeVideo(workspacePath, {
        ...(content ? { ...(isStudioReact ? { reactTsx: content } : { html: content }),
          trustLocalHtml: true } : { projectId }),
        width, height, fps, durationSeconds: seconds,
        ...(audio ? { audioAssetId: audio.id } : {}),
      });
      if (version !== lifetime.current) return;
      jobId.current = current.id;
      setJob(current);
      while (!["completed", "cancelled", "failed", "interrupted"].includes(current.status)) {
        await new Promise<void>(resolve => setTimeout(resolve, 350));
        if (version !== lifetime.current) return;
        current = await studioApi.inspectCodeVideo(workspacePath, current.id);
        if (version !== lifetime.current) return;
        setJob(current);
      }
      if (current.status === "failed" || current.status === "cancelled" || current.status === "interrupted")
        throw new Error(current.error ?? ("Code-to-Video " + current.status));
      if (!current.result) throw new Error("Code-to-Video completed without an MP4");
      const url = await studioApi.loadCodeVideo(workspacePath, current.result.id);
      if (version !== lifetime.current) { URL.revokeObjectURL(url); return; }
      setVideo(url);
      setName(current.result.id + ".mp4");
      void refreshHistory();
    } catch (cause) {
      if (version === lifetime.current)
        setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (version === lifetime.current) {
        setWorking(false);
        jobId.current = null;
      }
    }
  };
  const cancel = async () => {
    const id = jobId.current;
    if (!id) return;
    const version = lifetime.current;
    try {
      const result = await studioApi.cancelCodeVideo(workspacePath, id);
      if (version === lifetime.current) setJob(result);
    } catch (cause) {
      if (version === lifetime.current)
        setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  return <section className="border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-3 py-2"
    aria-label="Studio Code to Video">
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="text-xs font-semibold text-[var(--text-main)]">Code → MP4</h3>
      <span className="text-[10px] text-[var(--text-muted)]">Chromium + FFmpeg · preview · offline</span>
      <select aria-label="Code video source" className={inputClass} value={source}
        disabled={disabled || working} onChange={event => {
          setSource(event.target.value as "studio" | "html"); setVideo(""); setError("");
        }}>
        <option value="studio">This Studio project (HTML / React wrapper)</option>
        <option value="html">Trusted HTML / Studio-exported React TSX</option>
      </select>
      {source === "html" && <>
        <input type="file" accept=".html,.tsx,text/html" aria-label="Source HTML file"
          className={inputClass + " max-w-[185px]"} disabled={disabled || working}
          onChange={event => setFile(event.target.files?.[0] ?? null)} />
        <label className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
          <input type="checkbox" aria-label="Trust HTML source" checked={trusted}
            disabled={disabled || working} onChange={event => setTrusted(event.target.checked)} />
          I trust this local HTML
        </label>
      </>}
      <label className="text-[11px] text-[var(--text-muted)]">W
        <input aria-label="Video width" type="number" min={160} max={1920} step={2}
          value={width} disabled={disabled || working}
          onChange={event => setWidth(Number(event.target.value))} className={inputClass + " ml-1 w-16"} />
      </label>
      <label className="text-[11px] text-[var(--text-muted)]">H
        <input aria-label="Video height" type="number" min={90} max={1080} step={2}
          value={height} disabled={disabled || working}
          onChange={event => setHeight(Number(event.target.value))} className={inputClass + " ml-1 w-16"} />
      </label>
      <label className="text-[11px] text-[var(--text-muted)]">FPS
        <input aria-label="Video fps" type="number" min={1} max={30}
          value={fps} disabled={disabled || working}
          onChange={event => setFps(Number(event.target.value))} className={inputClass + " ml-1 w-12"} />
      </label>
      <label className="text-[11px] text-[var(--text-muted)]">Sec
        <input aria-label="Video seconds" type="number" min={.25} max={12} step={.25}
          value={seconds} disabled={disabled || working}
          onChange={event => setSeconds(Number(event.target.value))} className={inputClass + " ml-1 w-14"} />
      </label>
      <label className="text-[11px] text-[var(--text-muted)]">
        Optional PCM16 WAV (AAC mux)
        <input type="file" accept=".wav,audio/wav,audio/wave,audio/x-wav" aria-label="Code video audio file"
          className={inputClass + " ml-1 max-w-[180px]"}
          disabled={disabled || working} onChange={event => setAudioFile(event.target.files?.[0] ?? null)} />
      </label>
      <button className={buttonClass} disabled={disabled || working || (source === "html" && (!file || !trusted))}
        onClick={() => void submit()} type="button">{working ? "Rendering..." : "Render MP4"}</button>
      {working && job && !["cancelled", "failed", "completed", "cancelling"].includes(job.status) &&
        <button type="button" className={buttonClass} aria-label="Cancel code video render"
          onClick={() => void cancel()}>Cancel</button>}
      {job && <span role="status" className="text-[11px] text-[var(--text-muted)]">
        {job.status} · {job.framesCompleted}/{job.frameCount || "?"} frames
      </span>}
    </div>
    <p className="mt-1 text-[10px] text-[var(--text-muted)]">
      First-party Studio HTML/React exports share the same scene. External React must first be built into a
      self-contained HTML file (Studio-generated React TSX also works). CSS/WAAPI and Studio frame controls are sampled; arbitrary JS timelines,
      browser audio and remote assets are not captured. Optional uploaded audio is muxed to MP4.
      Do not load untrusted HTML.
    </p>
    {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
    <div className="mt-2 border-t border-[var(--border-color)] pt-2" aria-label="Code video history">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-[var(--text-main)]">Recent renders</span>
        <button className={buttonClass} type="button" disabled={working}
          onClick={() => void refreshHistory()} aria-label="Refresh code video history">Refresh</button>
        {historyError && <span className="text-[10px] text-[var(--text-muted)]">{historyError}</span>}
      </div>
      {history.length > 0 && <ul className="mt-1 flex flex-wrap gap-2 text-[11px]" aria-label="Previous code video jobs">
        {history.map(saved => <li key={saved.id}
          className="flex items-center gap-2 rounded border border-[var(--border-color)] px-2 py-1">
          <span className="font-mono">{saved.id.slice(-6)}</span>
          <span>{saved.status}</span>
          <span>{saved.framesCompleted}/{saved.frameCount}f</span>
          {saved.status === "completed" && saved.result &&
            <button className={buttonClass} type="button" disabled={working || disabled}
              aria-label={"Open saved video " + saved.id}
              onClick={() => void openPrevious(saved)}>Open MP4</button>}
          {saved.status === "interrupted" && <span className="text-amber-400">
            Restart interrupted this render; manual retry required</span>}
        </li>)}
      </ul>}
    </div>
    {video && <div className="mt-2 flex flex-wrap items-center gap-2">
      <video aria-label="Rendered code to MP4" src={video} controls className="max-h-48 max-w-[420px]" />
      <a className={buttonClass} href={video} download={name}>Download MP4</a>
    </div>}
  </section>;
}
