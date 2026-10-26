import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { studioApi } from '../studioApi';

describe('Studio Studio authenticated client', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'tline-only-token');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.removeItem('token');
  });
  it('uploads and reconstructs small video through authenticated paths and reads private review', async () => {
    const videoId = 'video-' + 'a'.repeat(64);
    const projectId = 'studio-' + 'b'.repeat(20);
    const input = new Uint8Array(48).fill(97);
    const file = new File([input], 'local.mp4', { type: 'video/mp4' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => input.buffer });
    const report = { status: 'experimental-multi', projectId, revision: 2,
      objects: [{ id: 'subject-1' }, { id: 'subject-2' }],
      measuredForegroundIoU: [.9, .91, .92], interpolationCheckIoU: [.85, .86] };
    const mock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: videoId, bytes: 48, format: 'mp4' }), {
        status: 201, headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(report), {
        status: 201, headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(input, {
        status: 200, headers: { 'Content-Type': 'image/png' },
      }));
    vi.stubGlobal('fetch', mock);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:private-review');
    await expect(studioApi.uploadVideo('D:/studio', file)).resolves.toMatchObject({ id: videoId });
    await expect(studioApi.reconstructMultiVideo('D:/studio', videoId)).resolves.toMatchObject({
      projectId, revision: 2,
    });
    await expect(studioApi.loadMultiVideoReviewUrl('D:/studio', projectId, 2))
      .resolves.toBe('blob:private-review');
    const routes = mock.mock.calls.map(call => call[0]) as string[];
    expect(routes[0]).toContain('/videos?workspace=');
    expect(routes[1]).toContain('/reconstruct/multi?workspace=');
    expect(routes[2]).toContain('/projects/' + projectId + '/reconstruction-review.png?revision=2&workspace=');
    expect(routes.every(route => !route.includes('tline-only-token'))).toBe(true);
    expect(mock.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer tline-only-token' });
    expect(JSON.parse(mock.mock.calls[0][1].body).base64).toBe(btoa('a'.repeat(48)));
    expect(() => studioApi.reconstructMultiVideo('D:/studio', '../escape')).toThrow(/Invalid/);
    await expect(studioApi.loadMultiVideoReviewUrl('D:/studio', '../escape', 2)).rejects.toThrow(/Invalid/);
    await expect(studioApi.uploadVideo('D:/studio', new File([input], 'bad.txt', { type: 'text/plain' })))
      .rejects.toThrow(/MP4 or WebM/);
    expect(mock).toHaveBeenCalledTimes(3);
  });
  it('fetches read-only occlusion evidence through authenticated workspace scope and validates PNG',async()=>{
    const videoId='video-'+'a'.repeat(64);
    const png=new Uint8Array([137,80,78,71,13,10,26,10,...Array(24).fill(0)]);
    const base64=btoa(String.fromCharCode(...png));
    const payload={status:'review-only',frame:54,dimensions:{width:160,height:90},
      observations:[{frame:42,objectCount:2},{frame:54,objectCount:1},{frame:66,objectCount:2}],
      note:'Read-only evidence',previewPngBase64:base64};
    const fetchMock=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(payload),{
      status:200,headers:{'Content-Type':'application/json'},
    })).mockResolvedValueOnce(new Response(JSON.stringify({...payload,previewPngBase64:btoa('bad')}),{
      status:200,headers:{'Content-Type':'application/json'},
    }));
    vi.stubGlobal('fetch',fetchMock);
    const makeUrl=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:p8-evidence');
    const evidence=await studioApi.inspectOcclusionEvidence('D:/studio',videoId,54);
    expect(evidence.status).toBe('review-only');
    expect(evidence.previewUrl).toBe('blob:p8-evidence');
    expect(evidence.observations.map(o=>o.objectCount)).toEqual([2,1,2]);
    expect(JSON.stringify(evidence)).not.toContain('previewPngBase64');
    const [route,init]=fetchMock.mock.calls[0] as [string,RequestInit];
    expect(route).toContain('/reconstruct/multi/evidence?workspace=');
    expect(route).not.toContain('tline-only-token');
    expect(init.headers).toMatchObject({Authorization:'Bearer tline-only-token'});
    expect(JSON.parse(init.body as string)).toEqual({videoId,frame:54});
    await expect(studioApi.inspectOcclusionEvidence('D:/studio',videoId,54))
      .rejects.toThrow(/Invalid Studio evidence PNG/);
    expect(makeUrl).toHaveBeenCalledTimes(1);
    await expect(studioApi.inspectOcclusionEvidence('D:/studio','../escape',54))
      .rejects.toThrow(/Invalid Studio evidence request/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("previews a token-bound recovery with authenticated PNG and requires explicit approval body",async()=>{
    const videoId="video-"+"a".repeat(64),token="b".repeat(64);
    const png=new Uint8Array([137,80,78,71,13,10,26,10,...Array(24).fill(0)]);
    const base64=btoa(String.fromCharCode(...png));
    const preview={status:"recovery-candidate",frame:54,beforeToAfter:[0,1],
      mergedProbeFrames:[54],flaggedForegroundIoU:.51,token,
      previewPngBase64:base64,note:"Inferred interpolation"};
    const saved={status:"experimental-multi",projectId:"studio-"+"a".repeat(20),
      revision:2,recovery:{frame:54,manuallyConfirmed:true,mergedProbeFrames:[54],
        flaggedForegroundIoU:.51}};
    const mock=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(preview),{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify(saved),{status:201}));
    vi.stubGlobal("fetch",mock);
    vi.spyOn(URL,"createObjectURL").mockReturnValue("blob:preview");
    const candidate=await studioApi.previewOcclusionRecovery("D:/studio",videoId,54,[0,1]);
    expect(candidate).toMatchObject({token,previewUrl:"blob:preview"});
    expect(JSON.stringify(candidate)).not.toContain("previewPngBase64");
    const project=await studioApi.approveOcclusionRecovery("D:/studio",videoId,54,[0,1],token);
    expect(project).toMatchObject(saved);
    expect(mock).toHaveBeenCalledTimes(2);
    const routes=mock.mock.calls.map(call=>call[0]) as string[];
    expect(routes.every(path=>path.includes("/reconstruct/multi/recovery?workspace="))).toBe(true);
    expect(routes.every(path=>!path.includes("tline-only-token"))).toBe(true);
    const postBodies=mock.mock.calls.map(call=>JSON.parse(call[1].body));
    expect(postBodies).toEqual([
      {videoId,frame:54,beforeToAfter:[0,1],previewOnly:true},
      {videoId,frame:54,beforeToAfter:[0,1],previewOnly:false,
        candidateToken:token,acknowledgement:"APPROVE_MANUAL_RECOVERY"},
    ]);
    expect(mock.mock.calls[1][1].headers).toMatchObject({Authorization:"Bearer tline-only-token"});
    await expect(studioApi.previewOcclusionRecovery("D:/studio",videoId,54,[0,0]))
      .rejects.toThrow(/distinct/);
    expect(()=>studioApi.approveOcclusionRecovery("D:/studio",videoId,54,[0,1],"bad"))
      .toThrow(/Invalid approved/);
    expect(mock).toHaveBeenCalledTimes(2);
  });
  it('reconstructs text only through authorized video ID and workspace scope', async () => {
    const id = 'video-' + 'e'.repeat(64);
    const report = { status:'experimental-ocr', projectId:'studio-'+'a'.repeat(20),
      revision:2,lines:[{id:'ocr-caption-1',text:'STUDIO',confidence:.96}],averageConfidence:.96 };
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify(report), {
      status: 201, headers: { 'Content-Type':'application/json' },
    }));
    vi.stubGlobal('fetch',mock);
    expect(await studioApi.reconstructTextVideo('D:/studio',id)).toMatchObject(report);
    const [route,init] = mock.mock.calls[0] as [string,RequestInit];
    expect(route).toContain('/reconstruct/text?workspace=');
    expect(route).not.toContain('tline-only-token');
    expect(init.headers).toMatchObject({Authorization:'Bearer tline-only-token'});
    expect(JSON.parse(init.body as string).videoId).toBe(id);
    expect(() => studioApi.reconstructTextVideo('D:/studio','../outside')).toThrow(/Invalid/);
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('uses authenticated workspace-scoped route for changing text timeline', async () => {
    const id='video-'+'c'.repeat(64);
    const mock=vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status:'experimental-ocr-timeline',projectId:'studio-'+'d'.repeat(20),revision:2,
      captions:[{text:'STUDIO',startFrame:0,endFrame:40}],
    }),{status:201,headers:{'Content-Type':'application/json'}}));
    vi.stubGlobal('fetch',mock);
    expect((await studioApi.reconstructTextTimelineVideo('D:/studio',id)).captions).toHaveLength(1);
    const [url,init]=mock.mock.calls[0] as [string,RequestInit];
    expect(url).toContain('/reconstruct/text-timeline?workspace=');
    expect(url).not.toContain('tline-only-token');
    expect(init.headers).toMatchObject({Authorization:'Bearer tline-only-token'});
    expect(JSON.parse(init.body as string).videoId).toBe(id);
    expect(()=>studioApi.reconstructTextTimelineVideo('D:/studio','../untrusted')).toThrow(/Invalid/);
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('renders Code-to-Video using scoped authorization and downloads MP4 privately', async () => {
    const projectId = 'studio-' + 'a'.repeat(20);
    const videoId = 'codevideo-' + 'b'.repeat(24);
    const response = { id: videoId, bytes: 2000, width: 640, height: 360, fps: 4,
      frameCount: 4, source: 'studio' };
    const mock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 201,
        headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(new Uint8Array(2000), {
        status: 200, headers: { 'Content-Type': 'video/mp4' },
      }));
    vi.stubGlobal('fetch', mock);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:code-video');
    expect(await studioApi.codeToVideo('D:/demo', {
      projectId, width: 640, height: 360, fps: 4, durationSeconds: 1,
    })).toEqual(response);
    expect(await studioApi.loadCodeVideo('D:/demo', videoId)).toBe('blob:code-video');
    expect(mock.mock.calls[0][0]).toContain('/code-to-video?workspace=');
    expect(mock.mock.calls[1][0]).toContain('/code-videos/' + videoId + '.mp4?workspace=');
    for (const [, init] of mock.mock.calls) {
      expect(init.headers).toMatchObject({ Authorization: 'Bearer tline-only-token' });
    }
    expect(mock.mock.calls.every(call => !call[0].includes('tline-only-token'))).toBe(true);
    expect(() => studioApi.codeToVideo('D:/demo', {
      html: '<html></html>', width: 640, height: 360, fps: 4, durationSeconds: 1,
    })).toThrow(/Trust/);
    await expect(studioApi.loadCodeVideo('D:/demo', '../secret')).rejects.toThrow(/Invalid/);
    expect(mock).toHaveBeenCalledTimes(2);
  });
  it('supports workspace-scoped queued Code-to-Video create/poll/cancel with audio asset', async () => {
    const projectId = 'studio-' + 'c'.repeat(20);
    const id = 'codejob-' + 'd'.repeat(24);
    const state = { id, status:'queued', framesCompleted:0, frameCount:0,
      queuedAt:'2026-10-25T00:00:00Z' };
    const mock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(state), {
      status:202, headers:{'Content-Type':'application/json'},
    })).mockResolvedValueOnce(new Response(JSON.stringify({...state,status:'running',frameCount:24}), {
      status:200, headers:{'Content-Type':'application/json'},
    })).mockResolvedValueOnce(new Response(JSON.stringify({...state,status:'cancelled'}), {
      status:200, headers:{'Content-Type':'application/json'},
    }));
    vi.stubGlobal('fetch',mock);
    const args = {projectId, audioAssetId:'audio-'+'a'.repeat(64),
      width:640,height:360,fps:12,durationSeconds:2};
    expect((await studioApi.queueCodeVideo('D:/studio',args)).status).toBe('queued');
    expect((await studioApi.inspectCodeVideo('D:/studio',id)).status).toBe('running');
    expect((await studioApi.cancelCodeVideo('D:/studio',id)).status).toBe('cancelled');
    const routes=mock.mock.calls.map(call=>call[0] as string);
    expect(routes[0]).toContain('/code-to-video/jobs?workspace=');
    expect(routes[1]).toContain('/code-to-video/jobs/'+id+'?workspace=');
    expect(routes[2]).toContain('/code-to-video/jobs/'+id+'/cancel?workspace=');
    expect(routes.every(route=>!route.includes('tline-only-token'))).toBe(true);
    expect(mock.mock.calls.every(call=>
      (call[1] as RequestInit).headers &&
      ((call[1] as RequestInit).headers as Record<string,string>).Authorization === 'Bearer tline-only-token'
    )).toBe(true);
    expect(JSON.parse(mock.mock.calls[0][1].body).audioAssetId).toBe(args.audioAssetId);
    expect(() => studioApi.inspectCodeVideo('D:/studio','../bad')).toThrow(/Invalid/);
    expect(() => studioApi.cancelCodeVideo('D:/studio','../bad')).toThrow(/Invalid/);
    expect(mock).toHaveBeenCalledTimes(3);
  });
  it('lists durable Code-to-Video history through authenticated workspace scope', async () => {
    const id = 'codejob-' + 'f'.repeat(24);
    const data = [{id, status:'interrupted', framesCompleted:9, frameCount:60,
      queuedAt:'2026-10-25T00:00:00.000Z'}];
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify(data), {
      status:200, headers:{'Content-Type':'application/json'},
    }));
    vi.stubGlobal('fetch',mock);
    expect(await studioApi.listCodeVideoJobs('D:/studio')).toEqual(data);
    const [url,init] = mock.mock.calls[0] as [string,RequestInit];
    expect(url).toContain('/code-to-video/jobs?workspace=');
    expect(url).not.toContain('tline-only-token');
    expect(init.headers).toMatchObject({Authorization:'Bearer tline-only-token'});
  });
  it('downloads authenticated SVG/GSAP source without exposing access tokens', async () => {
    const id = 'studio-' + 'a'.repeat(20);
    const html = '<!doctype html><svg id="studio-stage"></svg>';
    const fetchMock = vi.fn().mockResolvedValue(new Response(html, {
      status: 200, headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': String(html.length),
      },
    }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(studioApi.exportCodeHtml('D:/studio code', id, 'scroll')).resolves.toBe(html);
    const [route, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(route).toContain('/projects/' + id + '/code.html?trigger=scroll&workspace=');
    expect(route).not.toContain('tline-only-token');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tline-only-token' });
    await expect(studioApi.exportCodeHtml('D:/studio', id, 'evil' as 'click')).rejects.toThrow('Unsupported Studio code trigger');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(studioApi.exportCodeHtml('D:/studio', '../secret')).rejects.toThrow('Invalid Studio');
  });
  it('fetches authenticated Next/React TSX and rejects malformed response', async () => {
    const id = 'studio-' + 'd'.repeat(20);
    const valid = '"use client";<iframe sandbox="allow-scripts" />';
    const mock = vi.fn().mockResolvedValueOnce(new Response(valid, {
      status: 200, headers: { 'Content-Length': String(valid.length) },
    })).mockResolvedValueOnce(new Response('bad', { status: 200 }));
    vi.stubGlobal('fetch', mock);
    await expect(studioApi.exportCodeReact('D:/studio', id, 'hover')).resolves.toBe(valid);
    const [route, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(route).toContain('/projects/' + id + '/code.tsx?trigger=hover');
    expect(route).not.toContain('tline-only-token');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tline-only-token' });
    await expect(studioApi.exportCodeReact('D:/studio', id)).rejects.toThrow('Invalid Studio React source');
  });
  it('fetches direct editable JSX as an authenticated source and rejects iframe output', async () => {
    const id = 'studio-' + 'e'.repeat(20);
    const valid = `"use client";
function StudioAnimation(){ return <svg><g data-studio-id={"shape-1"}><path d={"M0 0"} /></g></svg> }`;
    const mock = vi.fn()
      .mockResolvedValueOnce(new Response(valid, {
        status: 200, headers: { 'Content-Length': String(valid.length) },
      }))
      .mockResolvedValueOnce(new Response('"use client";<iframe srcDoc="unsafe" />', { status: 200 }));
    vi.stubGlobal('fetch', mock);
    await expect(studioApi.exportCodeEditableReact('D:/studio', id, 'hover'))
      .resolves.toBe(valid);
    const [route, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(route).toContain('/projects/' + id + '/code.editable.tsx?trigger=hover');
    expect(route).not.toContain('tline-only-token');
    expect(init.headers).toMatchObject({Authorization:'Bearer tline-only-token'});
    await expect(studioApi.exportCodeEditableReact('D:/studio', id))
      .rejects.toThrow(/Invalid direct editable/);
    await expect(studioApi.exportCodeEditableReact('D:/studio', '../outside'))
      .rejects.toThrow(/Invalid Studio/);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('refuses malformed or oversized HTML source instead of downloading it', async () => {
    const id = 'studio-' + 'b'.repeat(20);
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('<video></video>', { status: 200 }))
      .mockResolvedValueOnce(new Response('<!doctype html><svg id="studio-stage"></svg>', {
        status: 200, headers: { 'Content-Length': String(5 * 1024 * 1024) },
      }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(studioApi.exportCodeHtml('D:/studio', id)).rejects.toThrow('Invalid Studio');
    await expect(studioApi.exportCodeHtml('D:/studio', id)).rejects.toThrow('exceeds 4 MB');
  });

  it('passes T-Line auth with workspace routing and no secret in URLs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(studioApi.list('D:/my workspace')).resolves.toEqual([]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('workspace=D%3A%2Fmy%20workspace');
    expect(url).not.toContain('tline-only-token');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tline-only-token' });
  });
  it('sends prompt and revision through authorized T-Line routes, not arbitrary URLs', async () => {
    const motionId = 'motion-' + 'a'.repeat(20);
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ project: { id: motionId } }), {
      status: 202, headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    await studioApi.quality('D:/studio', motionId);
    await studioApi.generate('D:/studio', 'Buat video promo', 640, {
      imageAssetId: 'asset-' + 'b'.repeat(64), audioAssetId: 'audio-' + 'c'.repeat(64), audioGain: 0.6,
    });
    await studioApi.revise('D:/studio', motionId, 'Bikin transisinya lebih cepat', 1280, {
      audioAssetId: 'audio-' + 'd'.repeat(64),
    });
    expect(fetchMock.mock.calls[0][0]).toContain('/projects/' + motionId + '/quality?workspace=');
    expect(fetchMock.mock.calls[1][0]).toContain('/generate?workspace=');
    expect(fetchMock.mock.calls[2][0]).toContain('/projects/' + motionId + '/revise?workspace=');
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)).toMatchObject({
      prompt: 'Buat video promo', width: 640, imageAssetId: 'asset-' + 'b'.repeat(64),
      audioAssetId: 'audio-' + 'c'.repeat(64), audioGain: 0.6,
    });
    expect(JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string)).toMatchObject({
      audioAssetId: 'audio-' + 'd'.repeat(64),
    });
    expect((fetchMock.mock.calls[2][1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer tline-only-token',
    });
    expect(() => studioApi.revise('D:/studio', '../secret', 'change')).toThrow('Invalid Studio');
    expect(() => studioApi.quality('D:/studio', '../secret')).toThrow('Invalid Studio');
  });

  it('forwards multi-scene image IDs, loop mode, and opt-in narration only in authenticated body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', {
      status: 202, headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const ids = ['a', 'b', 'c'].map(hex => 'asset-' + hex.repeat(64));
    await studioApi.generate('D:/studio', 'Video 3 scenes', 640, {
      sceneImageAssetIds: ids, audioAssetId: 'audio-' + 'f'.repeat(64), audioLoop: true,
      voiceoverText: 'Voice-over', voiceoverGain: 0.8,
    });
    const [uri, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(uri).not.toContain('Voice-over');
    expect(request.headers).toMatchObject({ Authorization: 'Bearer tline-only-token' });
    expect(JSON.parse(request.body as string)).toMatchObject({
      sceneImageAssetIds: ids, audioLoop: true, voiceoverText: 'Voice-over', voiceoverGain: 0.8,
    });
  });

  it('submits one revision-guarded model vision repair using authenticated POST', async () => {
    const id = 'motion-' + 'd'.repeat(20);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ changed: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await studioApi.visionRepair('D:/studio', id, 5, 640);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/projects/' + id + '/vision-repair');
    expect(url).not.toContain('baseRevision');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tline-only-token' });
    expect(JSON.parse(init.body as string)).toEqual({ baseRevision: 5, width: 640 });
    expect(() => studioApi.visionRepair('D:/studio', '../bad', 5, 640)).toThrow();
  });

  it('requests optional multimodal review explicitly and downloads scoped subtitle text', async () => {
    const id = 'motion-' + 'c'.repeat(20);
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('vision-review')) {
        return new Response(JSON.stringify({ passed: true, issues: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('1\n00:00:00,000 --> 00:00:02,000\nHello\n',
        { status: 200, headers: { 'Content-Type': 'application/x-subrip' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    await studioApi.visionReview('D:/studio', id);
    const captions = await studioApi.captions('D:/studio', id);
    expect(captions).toContain('Hello');
    expect(fetchMock.mock.calls[0][0]).toContain('/projects/' + id + '/vision-review');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer tline-only-token' });
    expect(fetchMock.mock.calls[1][0]).toContain('/projects/' + id + '/captions.srt');
    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({ Authorization: 'Bearer tline-only-token' });
    expect(() => studioApi.visionReview('D:/studio', '../outside')).toThrow();
  });
  it('limits authenticated rendered frame snapshots to PNG and known Studio IDs', async () => {
    const id = 'motion-' + 'b'.repeat(20);
    const png = { type: 'image/png', size: 128 } as Blob;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, blob: async () => png });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview-frame');
    expect(await studioApi.loadFrameSnapshot('D:/studio', id, 45)).toBe('blob:preview-frame');
    expect(fetchMock.mock.calls[0][0]).toContain('/projects/' + id + '/frames/45.png');
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer tline-only-token' });
    await expect(studioApi.loadFrameSnapshot('D:/studio', id, -1)).rejects.toThrow('frame');
    await expect(studioApi.loadFrameSnapshot('D:/studio', '../secret', 45)).rejects.toThrow('identifier');
  });

  it('rejects media larger than 64 MB before downloading it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, {
      status: 200, headers: { 'Content-Length': String(70 * 1024 * 1024) },
    }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(studioApi.loadPreview('D:/studio', 'motionjob-' + 'a'.repeat(24))).rejects.toThrow('64 MB');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('uploads bounded image data with T-Line authorization and downloads authenticated Blob previews', async () => {
    const assetId = 'asset-' + 'b'.repeat(64);
    const payload = new Uint8Array(40).fill(123);
    const file = new File([payload], 'image.png', { type: 'image/png' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => payload.buffer });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: assetId, width: 10, height: 4, bytes: 40 }), {
        status: 201, headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(payload, {
        status: 200, headers: { 'Content-Type': 'image/png' },
      }));
    const objectUrl = vi.fn().mockReturnValue('blob:motion-test');
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(objectUrl);
    await expect(studioApi.uploadImage('D:/studio', file)).resolves.toMatchObject({ id: assetId });
    const [uploadPath, uploadInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(uploadPath).toContain('/assets?workspace=');
    expect(uploadInit.headers).toMatchObject({ Authorization: 'Bearer tline-only-token' });
    expect(JSON.parse(uploadInit.body as string).base64).toBe(btoa(String.fromCharCode(...payload)));
    expect(await studioApi.loadImageUrl('D:/studio', assetId)).toBe('blob:motion-test');
    expect(objectUrl).toHaveBeenCalledTimes(1);
    await expect(studioApi.loadImageUrl('D:/studio', '../../secret')).rejects.toThrow('Invalid Studio asset');
  });

  it('authorizes bounded WAV uploads and authenticated audio Blob responses', async () => {
    const audioId = 'audio-' + 'd'.repeat(64);
    const payload = new Uint8Array(64).fill(100);
    const file = new File([payload], 'beat.wav', { type: 'audio/wav' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => payload.buffer });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: audioId, seconds: 1, bytes: 64 }), {
        status: 201, headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(payload, {
        status: 200, headers: { 'Content-Type': 'audio/wav' },
      }));
    const objectUrl = vi.fn().mockReturnValue('blob:audio-test');
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(objectUrl);
    await expect(studioApi.uploadAudio('D:/studio', file)).resolves.toMatchObject({ id: audioId });
    const [uploadPath, uploadInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(uploadPath).toContain('/audio?workspace=');
    expect(uploadInit.headers).toMatchObject({ Authorization: 'Bearer tline-only-token' });
    expect(await studioApi.loadAudioUrl('D:/studio', audioId)).toBe('blob:audio-test');
    await expect(studioApi.loadAudioUrl('D:/studio', '../secret')).rejects.toThrow('Invalid Studio audio');
  });

  it('routes palettes, mockups, saas-promo, charts, vectorization, and deliverables bundles through authenticated endpoints', async () => {
    const motionId = 'motion-' + 'f'.repeat(20);
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/palettes')) return new Response(JSON.stringify({ palettes: [{ id: 'cyber', name: 'Cyberpunk' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/mockups')) return new Response(JSON.stringify({ mockups: [{ id: 'macbook', name: 'MacBook Pro' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/saas-promo')) return new Response(JSON.stringify({ project: { id: motionId }, job: { id: 'motionjob-' + '1'.repeat(24) } }), { status: 202, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/bundle')) return new Response(JSON.stringify({ bundlePath: 'D:/bundle.zip', files: ['preview.mp4'], sizeBytes: 1024 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/trace-image')) return new Response(JSON.stringify({ pathData: 'M0,0', d: 'M0,0', width: 100, height: 100 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/vectorize')) return new Response(JSON.stringify({ id: motionId, revision: 2 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/mockup')) return new Response(JSON.stringify({ project: { id: motionId, revision: 2 }, layersAdded: 4, deviceType: 'macbook' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/chart')) return new Response(JSON.stringify({ project: { id: motionId, revision: 2 }, layersAdded: 3 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/upscale/targets')) return new Response(JSON.stringify({ currentWidth: 1280, currentHeight: 720, availableTargets: [{ target: '4k', label: '4K', width: 3840, height: 2160, scaleFactor: 3 }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/upscale')) return new Response(JSON.stringify({ id: motionId, revision: 2, width: 3840, height: 2160 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const palettes = await studioApi.palettes('D:/studio');
    expect(palettes.palettes[0].id).toBe('cyber');

    const mockups = await studioApi.mockups('D:/studio');
    expect(mockups.mockups[0].id).toBe('macbook');

    const promo = await studioApi.saasPromo('D:/studio', { product: 'T-Line', palette: 'cyber', device: 'macbook' });
    expect(promo.project.id).toBe(motionId);

    const trace = await studioApi.traceImage('D:/studio', { imageBase64: 'QUJD' });
    expect(trace.d).toBe('M0,0');

    const vectorized = await studioApi.vectorizeLayer('D:/studio', motionId, 1, 'img1');
    expect(vectorized.id).toBe(motionId);

    const attachedMockup = await studioApi.attachMockup('D:/studio', motionId, 1, { device: 'macbook' });
    expect(attachedMockup.deviceType).toBe('macbook');

    const attachedChart = await studioApi.attachChart('D:/studio', motionId, 1, { type: 'benchmark' });
    expect(attachedChart.layersAdded).toBe(3);

    const bundle = await studioApi.exportBundle('D:/studio', motionId);
    expect(bundle.bundlePath).toBe('D:/bundle.zip');

    const manifest = await studioApi.getBundleManifest('D:/studio', motionId);
    expect(manifest.files).toContain('preview.mp4');

    const targets = await studioApi.upscaleTargets('D:/studio', motionId);
    expect(targets.availableTargets[0].target).toBe('4k');

    const upscaled = await studioApi.upscale('D:/studio', motionId, 1, { target: '4k' });
    expect(upscaled.id).toBe(motionId);

    const upscaledJob = await studioApi.upscaleJob('D:/studio', 'motionjob-' + '1'.repeat(24), { target: '4k' });
    expect(upscaledJob.width).toBe(3840);
  });

  it('requires login and rejects invalid scene identifiers before calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    localStorage.removeItem('token');
    await expect(studioApi.list('D:/studio')).rejects.toThrow('Sign in');
    expect(() => studioApi.inspect('D:/studio', '../escape')).toThrow('Invalid Studio');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
