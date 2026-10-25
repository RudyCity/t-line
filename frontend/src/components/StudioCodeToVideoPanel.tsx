import { useEffect, useState } from "react";
import { studioApi } from "../services/studioApi";

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
  const [trusted, setTrusted] = useState(false);
  const [width, setWidth] = useState(640);
  const [height, setHeight] = useState(360);
  const [fps, setFps] = useState(12);
  const [seconds, setSeconds] = useState(2);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [video, setVideo] = useState("");
  const [name, setName] = useState("");
  useEffect(() => () => { if (video) URL.revokeObjectURL(video); }, [video]);
  useEffect(() => {
    setVideo(""); setError(""); setFile(null); setTrusted(false);
  }, [projectId, workspacePath]);
  const submit = async () => {
    if (working || disabled) return;
    setWorking(true); setError(""); setVideo("");
    try {
      if (source === "html" && (!file || !trusted)) throw new Error(
        "Choose an HTML file and confirm that you trust its source");
      const isStudioReact = source === "html" && !!file?.name.toLowerCase().endsWith(".tsx");
      if (file && file.size > (isStudioReact ? 2 * 1024 * 1024 : 256 * 1024))
        throw new Error("Code source exceeds maximum file size");
      const content = source === "html" ? await file!.text() : undefined;
      const result = await studioApi.codeToVideo(workspacePath, {
        ...(content ? { ...(isStudioReact ? { reactTsx: content } : { html: content }),
          trustLocalHtml: true } : { projectId }),
        width, height, fps, durationSeconds: seconds,
      });
      const url = await studioApi.loadCodeVideo(workspacePath, result.id);
      setVideo(url);
      setName(result.id + ".mp4");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setWorking(false); }
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
      <button className={buttonClass} disabled={disabled || working || (source === "html" && (!file || !trusted))}
        onClick={() => void submit()} type="button">{working ? "Rendering..." : "Render MP4"}</button>
    </div>
    <p className="mt-1 text-[10px] text-[var(--text-muted)]">
      First-party Studio HTML/React exports share the same scene. External React must first be built into a
      self-contained HTML file (Studio-generated React TSX also works). CSS/WAAPI and Studio frame controls are sampled; arbitrary JS timelines,
      audio and remote assets are not guaranteed. Do not load untrusted HTML.
    </p>
    {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
    {video && <div className="mt-2 flex flex-wrap items-center gap-2">
      <video aria-label="Rendered code to MP4" src={video} controls className="max-h-48 max-w-[420px]" />
      <a className={buttonClass} href={video} download={name}>Download MP4</a>
    </div>}
  </section>;
}
