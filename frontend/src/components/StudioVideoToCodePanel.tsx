import { useEffect, useRef, useState } from "react";
import { studioApi, type StudioMultiVideoReconstruction } from "../services/studioApi";

interface Props {
  workspacePath: string;
  onCreated: (report: StudioMultiVideoReconstruction) => void;
}
const inputClass = "rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1.5 text-xs text-[var(--text-main)]";
const buttonClass = "rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-overlay-hover)] disabled:opacity-40";

/** Visible only when a connected backend supports the experimental bounded
 * reconstruction. No file path, token, or plaintext video in any URL.
 */
export function StudioVideoToCodePanel({ workspacePath, onCreated }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [working, setWorking] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [previewWarning, setPreviewWarning] = useState("");
  const [report, setReport] = useState<StudioMultiVideoReconstruction | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const runSeq = useRef(0);

  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  useEffect(() => {
    runSeq.current++;
    setFile(null);
    setReport(null);
    setError("");
    setPreviewWarning("");
    setImageUrl("");
  }, [workspacePath]);

  const reconstruct = async () => {
    if (!file || working) return;
    if (file.size < 32 || file.size > 12 * 1024 * 1024) {
      setError("Choose a 32-byte to 12-MiB MP4 or WebM file."); return;
    }
    const seq = ++runSeq.current;
    setWorking(true); setError(""); setPreviewWarning(""); setReport(null); setImageUrl("");
    try {
      setPhase("Uploading the local reference clip...");
      const imported = await studioApi.uploadVideo(workspacePath, file);
      if (runSeq.current !== seq) return;
      setPhase("Sampling frames and checking object identities...");
      const result = await studioApi.reconstructMultiVideo(workspacePath, imported.id);
      if (runSeq.current !== seq) return;
      setReport(result);
      onCreated(result);
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
          <span className="ml-2 text-[10px] font-normal text-[var(--text-muted)]">Experimental · 2–4 shapes</span>
        </h3>
        <p className="max-w-[680px] text-[11px] text-[var(--text-muted)]">
          Local 1–12-second MP4/WebM, up to 12 MiB. Only separated bright 2D shapes on a stable dark background.
          No semantic AI, text recovery or exact video-to-source conversion. Use clips you have permission to process.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
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
    {report && <div className="mt-2 space-y-2 text-xs text-[var(--text-main)]">
      <p role="status">Created project {report.projectId}: {report.objects.length} vector layers,
        sampled foreground similarity {report.measuredForegroundIoU.map(x => (x * 100).toFixed(1) + "%").join(" / ")}.</p>
      <p className="text-[11px] text-[var(--text-muted)]">
        Similarity covers only three sampled foreground masks. All generated keyframes are editable in Studio.
      </p>
      {imageUrl && <figure className="max-w-[720px]">
        <img src={imageUrl} alt="Three sample comparisons: original video on the left and reconstructed vector frames on the right"
          className="max-h-72 max-w-full border border-[var(--border-color)] object-contain" />
        <figcaption className="mt-1 text-[10px] text-[var(--text-muted)]">
          Original (left) compared with editable Studio vector reconstruction (right), three sampled times.
        </figcaption>
      </figure>}
      {previewWarning && <p role="alert" className="text-[11px] text-yellow-400">{previewWarning}</p>}
    </div>}
  </section>;
}
