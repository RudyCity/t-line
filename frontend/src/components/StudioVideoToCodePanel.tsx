import { useEffect, useRef, useState } from "react";
import { studioApi, type StudioVideoCodeResult } from "../services/studioApi";

interface Props {
  workspacePath: string;
  onCreated: (report: StudioVideoCodeResult) => void;
  ocrAvailable?: boolean;
  ocrTimelineAvailable?: boolean;
}
const inputClass = "rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1.5 text-xs text-[var(--text-main)]";
const buttonClass = "rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-overlay-hover)] disabled:opacity-40";

/** Visible only when a connected backend supports the experimental bounded
 * reconstruction. No file path, token, or plaintext video in any URL.
 */
export function StudioVideoToCodePanel({
  workspacePath, onCreated, ocrAvailable = false, ocrTimelineAvailable = false,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'shapes' | 'text' | 'timeline'>('shapes');
  const [working, setWorking] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [previewWarning, setPreviewWarning] = useState("");
  const [report, setReport] = useState<StudioVideoCodeResult | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [diffUrl, setDiffUrl] = useState("");
  const [diffWarning, setDiffWarning] = useState("");
  const runSeq = useRef(0);

  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  useEffect(() => () => { if (diffUrl) URL.revokeObjectURL(diffUrl); }, [diffUrl]);
  useEffect(() => {
    runSeq.current++;
    setFile(null);
    setMode('shapes');
    setReport(null);
    setError("");
    setPreviewWarning("");
    setImageUrl(""); setDiffUrl(""); setDiffWarning("");
  }, [workspacePath]);

  const reconstruct = async () => {
    if (!file || working) return;
    if (file.size < 32 || file.size > 12 * 1024 * 1024) {
      setError("Choose a 32-byte to 12-MiB MP4 or WebM file."); return;
    }
    const seq = ++runSeq.current;
    setWorking(true); setError(""); setPreviewWarning(""); setDiffWarning("");
    setReport(null); setImageUrl(""); setDiffUrl("");
    try {
      setPhase("Uploading the local reference clip...");
      const imported = await studioApi.uploadVideo(workspacePath, file);
      if (runSeq.current !== seq) return;
      setPhase(mode === 'timeline' ? "Detecting text changes and caption visibility..." :
        mode === 'text' ? "Reading stable captions with local English OCR..." :
        "Sampling frames and checking object identities...");
      const result = mode === 'timeline'
        ? await studioApi.reconstructTextTimelineVideo(workspacePath, imported.id)
        : mode === 'text'
          ? await studioApi.reconstructTextVideo(workspacePath, imported.id)
          : await studioApi.reconstructMultiVideo(workspacePath, imported.id);
      if (runSeq.current !== seq) return;
      setReport(result);
      onCreated(result);
      if (result.status !== 'experimental-multi') return;
      setPhase("Loading reconstruction comparison...");
      try {
        const image = await studioApi.loadMultiVideoReviewUrl(workspacePath, result.projectId, result.revision);
        if (runSeq.current !== seq) URL.revokeObjectURL(image);
        else setImageUrl(image);
      } catch (cause) {
        if (runSeq.current === seq) {
          setPreviewWarning("Saved, but the comparison image could not be loaded: " +
            (cause instanceof Error ? cause.message : String(cause)));
        }
      }
      // Older backends do not provide a visual difference PNG. Keep the
      // original review usable even if this optional second request fails.
      try {
        const diagnostic = await studioApi.loadMultiVideoDiffUrl(
          workspacePath, result.projectId, result.revision);
        if (runSeq.current !== seq) URL.revokeObjectURL(diagnostic);
        else setDiffUrl(diagnostic);
      } catch {
        if (runSeq.current === seq) setDiffWarning("Mask difference image is unavailable on this backend.");
      }
    } catch (cause) {
      if (runSeq.current === seq) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (runSeq.current === seq) { setWorking(false); setPhase(""); }
    }
  };

  return <section className="border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-3 py-2"
    aria-label="Studio Video to Code prototype">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-xs font-semibold text-[var(--text-main)]">Video → Editable Studio Code
          <span className="ml-2 text-[10px] font-normal text-[var(--text-muted)]">Experimental · shapes / OCR</span>
        </h3>
        <p className="max-w-[680px] text-[11px] text-[var(--text-muted)]">
          Local 1–12-second MP4/WebM, up to 12 MiB. Tracks 2–4 separated high-contrast 2D shapes
          against a stable solid-color background (light or dark). Gradients, occlusion and changing
          backgrounds are not supported for vector reconstruction. Optional local English OCR
          can recover simple stable or changing captions, with approximate font and timing. No exact source recovery.
          Use clips you have permission to process.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(ocrAvailable || ocrTimelineAvailable) && <label className="text-[11px] text-[var(--text-muted)]">
          Extraction mode
          <select aria-label="Video reconstruction mode" className={inputClass + " ml-2"}
            value={mode} disabled={working}
            onChange={event => setMode(event.target.value as 'shapes' | 'text' | 'timeline')}>
            <option value="shapes">Editable SVG shapes</option>
            {ocrAvailable && <option value="text">Editable Text (stable OCR)</option>}
            {ocrTimelineAvailable && <option value="timeline">Caption timeline (changing OCR)</option>}
          </select>
        </label>}
        <label className="text-[11px] text-[var(--text-muted)]">Reference video
          <input aria-label="Video reference file" type="file" accept="video/mp4,video/webm,.mp4,.webm"
            className={inputClass + " ml-2 max-w-[210px]"} disabled={working}
            onChange={e => { setFile(e.target.files?.[0] ?? null); setError(""); }} />
        </label>
        <button type="button" className={buttonClass} disabled={!file || working}
          onClick={() => void reconstruct()}>
          {working ? "Reconstructing..." : "Create editable layers"}
        </button>
      </div>
    </div>
    {phase && <p role="status" className="mt-2 text-xs text-[var(--text-muted)]">{phase}</p>}
    {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
    {report?.status === 'experimental-ocr' && <div className="mt-2 space-y-1 text-xs text-[var(--text-main)]">
      <p role="status">New editable text project {report.projectId}: {report.lines.length} stable
        line(s), average OCR confidence {(report.averageConfidence * 100).toFixed(1)}%.</p>
      <ul className="list-disc pl-4">
        {report.lines.map(line => <li key={line.id}>
          {line.text} ({(line.confidence * 100).toFixed(1)}%)
        </li>)}
      </ul>
      <p className="text-[11px] text-[var(--text-muted)]">
        English-only local OCR. Font and appearance are approximate; review the project in Studio before publishing.
      </p>
    </div>}
    {report?.status === 'experimental-ocr-timeline' && <div className="mt-2 space-y-2 text-xs text-[var(--text-main)]">
      <p role="status">Created editable caption timeline {report.projectId}:
        {" "}{report.captions.length} caption segments at
        {" "}{report.sampleTimes.length} sampled times.</p>
      <ul className="list-disc pl-4">
        {report.captions.map(line => <li key={line.id}>{line.text} — frames
          {" "}{line.startFrame}–{line.endFrame} ({(line.confidence * 100).toFixed(1)}% OCR)
        </li>)}
      </ul>
      <p className="text-[11px] text-[var(--text-muted)]">
        Appearance is approximate. Visibility boundaries are estimated halfway between samples;
        check timing and correct all text before publishing.
      </p>
    </div>}
    {report?.status === 'experimental-multi' && <div className="mt-2 space-y-2 text-xs text-[var(--text-main)]">
      <p role="status">Created project {report.projectId}: {report.objects.length} vector layers,
        {report.sampleTimes.length} tracked frames, sampled foreground similarity
        {" "}{report.measuredForegroundIoU.map(x => (x * 100).toFixed(1) + "%").join(" / ")}.</p>
      <p className="text-[11px] text-[var(--text-muted)]">
        The three preview comparisons show reconstructed mask overlap, not full color/animation fidelity.
        {report.interpolationCheckIoU?.length ? " Additional unseen-frame checks: " +
          report.interpolationCheckIoU.map(x => (x * 100).toFixed(1) + "%").join(" / ") + "." : ""}
        {" "}Position, bounded scale and eligible rotation keyframes are editable in Studio.
      </p>
      {report.timelineValidation?.checks.length ? <details
        className="max-w-[720px] rounded border border-[var(--border-color)] p-2">
        <summary className="cursor-pointer text-[11px] font-medium">
          Timeline QA · {report.timelineValidation.checks.length} additional frames
          {" · minimum IoU "}{(report.timelineValidation.minimumForegroundIoU*100).toFixed(1)}%
        </summary>
        <p className="my-1 text-[10px] text-[var(--text-muted)]">
          Checked foreground counts, identity associations, and rendered-mask similarity at
          additional timeline positions. These are sampled checks, not occlusion recovery
          or a guarantee that all video frames match.
        </p>
        <div className="max-h-44 overflow-auto">
          <table aria-label="Video-to-Code timeline QA frames"
            className="w-full text-left text-[10px]">
            <thead><tr><th>Frame</th><th>Mask IoU</th><th>F1</th>
              <th>Identity gap</th></tr></thead>
            <tbody>{report.timelineValidation.checks.map(item=><tr key={item.frame}>
              <td>{item.frame}</td>
              <td>{(item.foregroundIoU*100).toFixed(1)}%</td>
              <td>{(item.foregroundF1*100).toFixed(1)}%</td>
              <td>{item.identityGap.toFixed(3)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </details> : null}
      {report.parityReport?.length ? <details className="max-w-[720px] rounded border border-[var(--border-color)] p-2">
        <summary className="cursor-pointer text-[11px] font-medium">
          Visual parity · {report.parityReport.length} checked frames
          {" · mean mask F1 "}{(report.parityReport.reduce((sum, f) =>
            sum + f.foregroundF1, 0) / report.parityReport.length * 100).toFixed(1)}%
        </summary>
        <p className="mt-1 text-[10px] text-[var(--text-muted)]">
          Bounded foreground-mask similarity and RGB pixel error.
          Holdout frames were not used as animation keyframes. These scores do not measure
          semantic correctness or all frames of the video.
        </p>
        <div className="mt-1 overflow-x-auto">
          <table className="w-full text-left text-[10px]" aria-label="Video source versus reconstructed frames">
            <thead><tr>
              <th className="pr-3">Frame</th><th className="pr-3">Type</th>
              <th className="pr-3">IoU</th><th className="pr-3">Precision</th>
              <th className="pr-3">Recall</th><th className="pr-3">F1</th>
              <th>RGB error</th>
            </tr></thead>
            <tbody>{report.parityReport.map(frame => <tr key={frame.frame}>
              <td className="pr-3">{frame.frame}</td>
              <td className="pr-3">{frame.sampleType}</td>
              <td className="pr-3">{(frame.foregroundIoU * 100).toFixed(1)}%</td>
              <td className="pr-3">{(frame.foregroundPrecision * 100).toFixed(1)}%</td>
              <td className="pr-3">{(frame.foregroundRecall * 100).toFixed(1)}%</td>
              <td className="pr-3">{(frame.foregroundF1 * 100).toFixed(1)}%</td>
              <td>{(frame.rgbMeanAbsoluteError * 100).toFixed(1)}%</td>
            </tr>)}</tbody>
          </table>
        </div>
      </details> : null}
      {imageUrl && <figure className="max-w-[720px]">
        <img src={imageUrl} alt="Three preview comparisons: original video on the left and reconstructed vector frames on the right"
          className="max-h-72 max-w-full border border-[var(--border-color)] object-contain" />
        <figcaption className="mt-1 text-[10px] text-[var(--text-muted)]">
          Original (left) compared with editable Studio vector reconstruction (right), three sampled times.
        </figcaption>
      </figure>}
      {diffUrl && <details className="max-w-[720px] rounded border border-[var(--border-color)] p-2">
        <summary className="cursor-pointer text-[11px] font-medium">
          Show mask difference heatmap
        </summary>
        <p className="my-1 text-[10px] text-[var(--text-muted)]">
          Red = missing source area, cyan = extra reconstruction, grey = overlap.
          Three sampled keyframes only; no full-video parity claim.
        </p>
        <img src={diffUrl}
          alt="Mask difference heatmap showing missed red pixels, extra cyan pixels and grey overlap for three video frames"
          className="max-h-72 max-w-full object-contain" />
      </details>}
      {diffWarning && <p className="text-[10px] text-[var(--text-muted)]">{diffWarning}</p>}
      {previewWarning && <p role="alert" className="text-[11px] text-yellow-400">{previewWarning}</p>}
    </div>}
  </section>;
}
