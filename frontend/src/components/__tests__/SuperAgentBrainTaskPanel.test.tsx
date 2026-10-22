import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { SuperAgentBrainTaskPanel } from '../SuperAgentBrainTaskPanel';

let tasks:any[];
const base='/api/superagent/brain/sessions/session_testing/tasks';
beforeEach(()=>{
 tasks=[];
 vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
  const url=String(input),method=init?.method||'GET';
  const body=init?.body?JSON.parse(String(init.body)):{};
  let status=200,data:any={};
  if(url===base&&method==='GET')data={tasks};
  else if(url===base&&method==='POST'){
   const task={taskId:'task_0123456789abcdefabcd',title:body.title,status:'pending',
    agents:body.agentIds,assignedTo:null,checkpoints:[],handoffs:[],updatedAt:new Date().toISOString()};
   tasks=[task];data=task;status=201;
  }else{
   const task=tasks[0];
   if(!task){status=404;data={error:'Not found'};}
   else if(url.endsWith('/claim')){
    task.assignedTo=body.agentId;task.status='running';
    data={task, scratchPath:'brain/scratch/agents/'+body.agentId};
   }else if(url.endsWith('/checkpoint')){
    const c={version:task.checkpoints.length+1,at:new Date().toISOString(),agentId:body.agentId,
      note:body.note,nextStep:body.nextStep,artifactPaths:body.artifactPaths};
    task.checkpoints.push(c);data={checkpoint:c};
   }else if(url.endsWith('/transfer')){
    task.assignedTo=body.toAgent;data={task};
   }else if(url.endsWith('/status')){
    task.status=body.status;task.assignedTo=null;data=task;
   }else data=task;
  }
  return {ok:status<400,status,json:async()=>data};
 }));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('Brain multi-agent task dashboard',()=>{
 it('creates, claims, checkpoints and resumes a task without changing projects',async()=>{
  render(<SuperAgentBrainTaskPanel sessionId="session_testing"/>);
  await waitFor(()=>expect(screen.getByText(/No tasks/)).toBeTruthy());
  fireEvent.click(screen.getByText('Create task'));
  fireEvent.change(screen.getByLabelText('Brain task title'),{target:{value:'Analyze source'}});
  fireEvent.click(screen.getByRole('button',{name:'Create'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Analyze source'})).toBeTruthy());
  fireEvent.click(screen.getByRole('button',{name:'Claim'}));
  await waitFor(()=>expect(screen.getByText('running')).toBeTruthy());
  fireEvent.click(screen.getByText('Checkpoint / handoff'));
  fireEvent.change(screen.getByLabelText('Brain checkpoint note'),{target:{value:'Analysis finished'}});
  fireEvent.change(screen.getByLabelText('Brain checkpoint next step'),{target:{value:'Review changes'}});
  fireEvent.click(screen.getByRole('button',{name:'Save checkpoint'}));
  await waitFor(()=>expect(screen.getAllByText('Analysis finished').length).toBeGreaterThan(1));
  expect(tasks[0].checkpoints).toHaveLength(1);
  expect(tasks[0].checkpoints[0].agentId).toBe('main');
 });
});
