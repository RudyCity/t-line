import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, CornerDownRight, RefreshCw } from 'lucide-react';
import { getAuthHeader } from './SuperAgentConsoleUtils';

type TaskCheckpoint = { version:number; at:string; agentId:string; note:string; nextStep:string; artifactPaths:string[] };
type CapabilityStatus = { agentId: string; expiresAt: string; generation: number; revoked: boolean; expired: boolean };
type BrainTask = {
  taskId:string; title:string; status:'pending'|'running'|'blocked'|'completed'|'cancelled';
  agents:string[]; assignedTo:string|null; updatedAt:string; checkpoints:TaskCheckpoint[];
  handoffs:Array<{at:string;from:string;to:string;artifact:string;inbox:string;sha256:string}>;
  delegationJobs?:Array<{jobId:string;agentId:string;cli:string;at:string}>;
};
const request = async <T,>(url:string,body?:Record<string,unknown>):Promise<T>=>{
 const response=await fetch(url,{
  method:body?'POST':'GET',
  headers:body?{...getAuthHeader(),'Content-Type':'application/json'}:getAuthHeader(),
  ...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error || 'Brain task request rejected ('+response.status+')');
 return data as T;
};
export function SuperAgentBrainTaskPanel({sessionId}:{sessionId:string}){
 const [tasks,setTasks]=useState<BrainTask[]>([]);
 const [jobs,setJobs]=useState<Array<{jobId:string;status:string;completionState:string;cli:string}>>([]);
 const [capabilities,setCapabilities]=useState<CapabilityStatus[]>([]);
 const [approved,setApproved]=useState(false);
 const [freshCredential,setFreshCredential]=useState<{agentId:string;value:string}|null>(null);
 const [createdCredentials,setCreatedCredentials]=useState<{taskId:string;tokens:Record<string,string>}|null>(null);
 const [current,setCurrent]=useState('');
 const [title,setTitle]=useState('');
 const [members,setMembers]=useState('main, agy, claude');
 const [actor,setActor]=useState('main');
 const [target,setTarget]=useState('agy');
 const [note,setNote]=useState('');
 const [nextStep,setNextStep]=useState('');
 const [artifact,setArtifact]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [tick,setTick]=useState(0);
 const base=sessionId?'/api/superagent/brain/sessions/'+encodeURIComponent(sessionId)+'/tasks':'';
 const reload=useCallback(()=>setTick(x=>x+1),[]);
 useEffect(()=>{
  let active=true;setTasks([]);setCurrent('');setError('');
  if(!base)return()=>{active=false;};
  request<{jobs:Array<{jobId:string;status:string;completionState:string;cli:string}>}>(
   base.replace(/\/tasks$/,'')+'/jobs').then(result=>{
    if(active)setJobs(Array.isArray(result.jobs)?result.jobs:[]);
   }).catch(()=>{if(active)setJobs([]);});
  request<{tasks:BrainTask[]}>(base).then(result=>{
   if(!active)return;
   const available=Array.isArray(result.tasks)?result.tasks:[];
   setTasks(available);
   setCurrent(previous=>available.some(t=>t.taskId===previous)?previous:available[0]?.taskId||'');
  }).catch(e=>{if(active)setError(e.message);});
  return()=>{active=false;};
 },[base,tick]);
 useEffect(()=>{
  if(!base||!tasks.some(t=>t.status==='running'))return;
  const interval=setInterval(reload,12000);
  return()=>clearInterval(interval);
 },[base,reload,tasks]);
 useEffect(()=>{setFreshCredential(null);setCreatedCredentials(null);setApproved(false);},[sessionId]);
 useEffect(()=>{setFreshCredential(null);setApproved(false);},[current]);
 useEffect(()=>{
   if(!base||!current){setCapabilities([]);return;}
   let live=true;
   request<{agents:CapabilityStatus[]}>(base+'/'+encodeURIComponent(current)+'/credentials')
     .then(data=>{if(live)setCapabilities(data.agents||[]);})
     .catch(()=>{if(live)setCapabilities([]);});
   return()=>{live=false;};
 },[base,current,tick]);
 const selected=tasks.find(task=>task.taskId===current);
 const changeCapability=async(action:'rotate'|'revoke',agentId:string)=>{
   if(!approved||!taskUrl)return;
   setBusy(true);setError('');setNotice('');
   try {
     const result=await request<{agentCredential?:string}>(taskUrl+'/credentials/'+encodeURIComponent(agentId)+'/'+action,{confirm:true});
     setFreshCredential(action==='rotate'&&result.agentCredential?{agentId,value:result.agentCredential}:null);
     setApproved(false);setNotice(action==='rotate'?'Copy the replacement credential now. It will not be shown again.':'Agent credential revoked.');
     reload();
   }catch(e:any){setError(e?.message||'Credential operation rejected');}
   finally{setBusy(false);}
 };
 const perform=async(url:string,body:Record<string,unknown>,message:string)=>{
  setBusy(true);setError('');setNotice('');
  try {await request(url,body);setNotice(message);reload();}
  catch(e:any){setError(e.message||'Brain operation failed');}
  finally {setBusy(false);}
 };
 const taskUrl=current?base+'/'+encodeURIComponent(current):'';
 return <section aria-label="Brain task dashboard" className="border-b border-[var(--border-color)] p-3 space-y-2">
  <div className="flex items-center gap-2 text-xs font-semibold">
   <ClipboardList size={15}/> Multi-agent tasks
   <span className="text-[var(--text-muted)] font-normal">{tasks.length}</span>
   <button type="button" onClick={reload} aria-label="Refresh Brain tasks" className="ml-auto p-1 rounded hover:bg-[var(--bg-card)]"><RefreshCw size={13}/></button>
  </div>
  {error&&<p role="alert" className="text-[11px] text-red-400">{error}</p>}
  {notice&&<p role="status" className="text-[11px] text-emerald-400">{notice}</p>}
  <details className="rounded border border-[var(--border-color)]">
   <summary className="p-2 cursor-pointer text-[11px]">Create task</summary>
   <form className="p-2 flex flex-col gap-2" onSubmit={e=>{
    e.preventDefault();
    setBusy(true);setError('');setNotice('');
    void request<BrainTask&{credentials?:Record<string,string>}>(base,{title,agentIds:members.split(',').map(x=>x.trim()).filter(Boolean)})
      .then(data=>{setCurrent(data.taskId);setCreatedCredentials(data.credentials?{taskId:data.taskId,tokens:data.credentials}:null);
        setNotice('Task created. Copy the one-time credentials before closing this panel.');reload();})
      .catch(e=>setError(e?.message||'Task creation failed'))
      .finally(()=>setBusy(false));
   }}>
    <input value={title} onChange={e=>setTitle(e.target.value)} aria-label="Brain task title" placeholder="Research or experiment goal"
     maxLength={160} className="text-xs p-1 rounded border border-[var(--border-color)] bg-[var(--bg-card)]"/>
    <input value={members} onChange={e=>setMembers(e.target.value)} aria-label="Brain task agent members"
     placeholder="main, agy, claude" className="text-xs p-1 rounded border border-[var(--border-color)] bg-[var(--bg-card)]"/>
    <button type="submit" disabled={!sessionId||!title.trim()||busy} className="self-start rounded border border-[var(--border-color)] px-2 py-1 text-xs disabled:opacity-40">Create</button>
   </form>
  </details>
  {tasks.length===0&&<p className="text-[11px] text-[var(--text-muted)]">No tasks. Creating one will allocate isolated agent scratch when claimed.</p>}
  <div className="flex gap-1 flex-wrap max-h-20 overflow-y-auto">
    {tasks.map(t=><button key={t.taskId} type="button" onClick={()=>{setCurrent(t.taskId);setActor(t.assignedTo||t.agents[0]||'main');setCreatedCredentials(null);}}
     className={`rounded px-2 py-1 text-[11px] border border-[var(--border-color)] ${current===t.taskId?'bg-[var(--color-primary-glow)] text-[var(--color-primary)]':'bg-[var(--bg-card)]'}`}
     title={t.taskId}>{t.title.slice(0,42)}</button>)}
  </div>
  {createdCredentials&&createdCredentials.taskId===current&&<div role="status" className="rounded border border-[var(--border-color)] p-2 text-[11px]">
    <p className="font-semibold">One-time task agent credentials. Copy now; not stored in browser storage.</p>
    {Object.entries(createdCredentials.tokens).map(([agentId,token])=><div key={agentId}>
      <strong>{agentId}</strong><code className="break-all block select-all">{token}</code>
    </div>)}
    <button className="underline mt-1" type="button" onClick={()=>setCreatedCredentials(null)}>Clear credentials</button>
  </div>}
  {selected&&<div className="space-y-2">
    <div className="flex flex-wrap justify-between gap-1 items-center text-[11px]">
      <span className="font-medium">{selected.status}</span>
      <span className="font-mono text-[var(--text-muted)]">{selected.assignedTo||'unclaimed'}</span>
    </div>
    <div className="text-[11px] text-[var(--text-muted)]">
      Members: {selected.agents.join(', ')} · Checkpoints: {selected.checkpoints.length} · Handoffs: {selected.handoffs.length}
    </div>
    {(selected.delegationJobs||[]).slice(-5).map(ref=>{
      const job=jobs.find(j=>j.jobId===ref.jobId);
      return <div key={ref.jobId} className="p-2 rounded bg-[var(--bg-card)] text-[11px] flex gap-2 justify-between">
        <span className="truncate">{ref.cli} · {ref.agentId}</span>
        <span aria-label="Brain delegated job status" className="shrink-0">
          {job ? job.status+' · '+job.completionState : 'unavailable / refresh'}
        </span>
      </div>;
    })}
    <details className="rounded border border-[var(--border-color)]">
      <summary className="p-2 cursor-pointer text-[11px]">Agent credentials</summary>
      <div className="space-y-2 p-2 text-[11px]">
        {capabilities.length===0&&<p className="text-[var(--text-muted)]">No remote agent credentials for this task.</p>}
        {capabilities.map(c=><div key={c.agentId} className="flex gap-2 items-center justify-between flex-wrap">
          <span>{c.agentId} · {c.revoked?'revoked':c.expired?'expired':'active'} · v{c.generation}</span>
          <span className="text-[var(--text-muted)]">{new Date(c.expiresAt).toLocaleString()}</span>
          <button type="button" disabled={!approved||busy} onClick={()=>void changeCapability('rotate',c.agentId)}
           className="rounded border px-2 py-1 border-[var(--border-color)] disabled:opacity-40">Rotate</button>
          <button type="button" disabled={!approved||busy||c.revoked} onClick={()=>void changeCapability('revoke',c.agentId)}
           className="rounded border px-2 py-1 border-[var(--border-color)] disabled:opacity-40">Revoke</button>
        </div>)}
        <label className="flex items-center gap-1"><input type="checkbox" aria-label="Confirm Brain credential operation" checked={approved}
          onChange={e=>setApproved(e.target.checked)}/> Confirm changing this task's agent credentials</label>
        {freshCredential&&<div role="status" className="rounded border border-[var(--border-color)] p-2">
          <p>New {freshCredential.agentId} credential — shown once</p>
          <code className="block break-all select-all">{freshCredential.value}</code>
          <button type="button" onClick={()=>setFreshCredential(null)} className="underline">Clear displayed credential</button>
        </div>}
      </div>
    </details>
    <div className="flex gap-2 items-end flex-wrap">
      <label className="text-[11px]">Agent
       <select aria-label="Brain active agent" value={selected.agents.includes(actor)?actor:(selected.agents[0]||'')}
        onChange={e=>setActor(e.target.value)} className="block border rounded border-[var(--border-color)] bg-[var(--bg-card)] p-1">
        {selected.agents.map(a=><option value={a} key={a}>{a}</option>)}
       </select>
      </label>
      <button type="button" disabled={!!selected.assignedTo||busy||selected.status==='completed'}
       onClick={()=>void perform(taskUrl+'/claim',{agentId:actor},'Task claimed')}
       className="border rounded border-[var(--border-color)] px-2 py-1 text-[11px] disabled:opacity-40">Claim</button>
      <button type="button" disabled={selected.assignedTo!==actor||busy||selected.status!=='running'}
       onClick={()=>void perform(taskUrl+'/status',{agentId:actor,status:'completed'},'Task completed')}
       className="border rounded border-[var(--border-color)] px-2 py-1 text-[11px] disabled:opacity-40">Complete</button>
    </div>
    <details className="border rounded border-[var(--border-color)]">
     <summary className="p-2 text-[11px] cursor-pointer">Checkpoint / handoff</summary>
     <div className="p-2 space-y-2">
      <textarea aria-label="Brain checkpoint note" value={note} onChange={e=>setNote(e.target.value)} rows={2}
       placeholder="Verified findings" className="w-full p-1 text-xs border border-[var(--border-color)] rounded bg-[var(--bg-card)]"/>
      <input aria-label="Brain checkpoint next step" value={nextStep} onChange={e=>setNextStep(e.target.value)}
       placeholder="Next action" className="w-full p-1 text-xs border border-[var(--border-color)] rounded bg-[var(--bg-card)]"/>
      <button type="button" disabled={!note.trim()||busy||selected.assignedTo!==actor||selected.status!=='running'}
       onClick={()=>void perform(taskUrl+'/checkpoint',{agentId:actor,note,nextStep,artifactPaths:[]},'Checkpoint saved')}
       className="px-2 py-1 rounded border border-[var(--border-color)] text-[11px] disabled:opacity-40">Save checkpoint</button>
      <div className="flex flex-wrap items-end gap-2">
       <label className="text-[11px]">Transfer to
        <select aria-label="Brain handoff recipient" value={selected.agents.includes(target)?target:selected.agents[0]||''}
         onChange={e=>setTarget(e.target.value)} className="block p-1 rounded border border-[var(--border-color)] bg-[var(--bg-card)]">
         {selected.agents.map(a=><option value={a} key={a}>{a}</option>)}
        </select>
       </label>
       <button type="button" disabled={busy||selected.assignedTo!==actor||target===actor||selected.status!=='running'}
        onClick={()=>void perform(taskUrl+'/transfer',{agentId:actor,toAgent:target},'Task ownership transferred')}
        className="px-2 py-1 rounded border border-[var(--border-color)] text-[11px] disabled:opacity-40">Transfer task</button>
      </div>
      <input aria-label="Brain artifact handoff path" value={artifact} onChange={e=>setArtifact(e.target.value)}
       placeholder="artifacts/report.pdf" className="w-full p-1 text-xs rounded border border-[var(--border-color)] bg-[var(--bg-card)]"/>
      <button type="button" disabled={!artifact.startsWith('artifacts/')||busy||selected.assignedTo!==actor||target===actor}
       onClick={()=>void perform(taskUrl+'/handoff',{agentId:actor,toAgent:target,filePath:artifact},'Verified copy delivered to agent inbox')}
       className="px-2 py-1 rounded border border-[var(--border-color)] text-[11px] disabled:opacity-40">Share artifact</button>
     </div>
    </details>
    {selected.checkpoints.at(-1)&&<div className="bg-[var(--bg-card)] rounded p-2 text-[11px]">
      <div className="flex gap-1 items-center font-medium"><CheckCircle2 size={12}/> Last checkpoint · v{selected.checkpoints.at(-1)!.version}</div>
      <p className="mt-1 whitespace-pre-wrap break-words">{selected.checkpoints.at(-1)!.note}</p>
      <div className="text-[var(--text-muted)] flex items-start gap-1 mt-1"><CornerDownRight size={12}/>{selected.checkpoints.at(-1)!.nextStep}</div>
    </div>}
  </div>}
 </section>;
}
