import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach,describe,expect,it} from 'vitest';
import {resolveRuntimeTarget} from '../src/superAgentRuntimeTarget';

const tmp: string[] = [];
afterEach(() => {for(const dir of tmp.splice(0))fs.rmSync(dir,{force:true,recursive:true});});
function stage() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'one-runtime-stage-'));
  tmp.push(root);
  const profile=path.join(root,'core');
  fs.mkdirSync(profile);
  return {root,profile};
}
describe('one T-Line backend with selectable SuperAgent target',()=>{
  it('uses the primary runtime by default without a second backend',()=>{
    const result=resolveRuntimeTarget({},'/unused');
    expect(result).toEqual({
      selected:'primary',corePort:7888,ownerMode:'legacy',
      startupOnly:true,backendCount:1,autoStartCoreAllowed:true,
      temporary:false
    });
  });
  it('accepts a verified staging profile as a startup-only testing target',()=>{
    const {root,profile}=stage();
    const result=resolveRuntimeTarget({
      TLINE_SUPERAGENT_RUNTIME:'testing',
      TLINE_SUPERAGENT_CORE_PORT:'58922',
      TLINE_SUPERAGENT_OWNER_MODE:'supervised-external',
      SUPERAGENT_CONFIG_DIR:profile,
    },root);
    expect(result.selected).toBe('testing');
    expect(result.backendCount).toBe(1);
    expect(result.autoStartCoreAllowed).toBe(false);
    expect(result.startupOnly).toBe(true);
    expect(result.temporary).toBe(true);
  });
  it('preserves explicit supervised-external opt-in from older installs',()=>{
    const {root,profile}=stage();
    expect(resolveRuntimeTarget({
      TLINE_SUPERAGENT_CORE_PORT:'58922',
      TLINE_SUPERAGENT_OWNER_MODE:'supervised-external',
      SUPERAGENT_CONFIG_DIR:profile,
    },root).selected).toBe('testing');
  });
  it('rejects testing without a distinct supervised owner or a private profile',()=>{
    const {root,profile}=stage();
    const base={
      TLINE_SUPERAGENT_RUNTIME:'testing',
      TLINE_SUPERAGENT_CORE_PORT:'58922',
      TLINE_SUPERAGENT_OWNER_MODE:'supervised-external',
      SUPERAGENT_CONFIG_DIR:profile
    };
    for(const port of ['6759','6789','7888','9877']){
      expect(()=>resolveRuntimeTarget({...base,TLINE_SUPERAGENT_CORE_PORT:port},root)).toThrow();
    }
    expect(()=>resolveRuntimeTarget({...base,TLINE_SUPERAGENT_OWNER_MODE:'legacy'},root)).toThrow();
    expect(()=>resolveRuntimeTarget({...base,SUPERAGENT_CONFIG_DIR:root},root)).toThrow();
    expect(()=>resolveRuntimeTarget({...base,SUPERAGENT_CONFIG_DIR:path.join(root,'..')},root)).toThrow();
    expect(()=>resolveRuntimeTarget({...base,SUPERAGENT_CONFIG_DIR:path.join(root,'missing')},root)).toThrow();
    expect(()=>resolveRuntimeTarget({...base,SUPERAGENT_CONFIG_DIR:'relative-profile'},root)).toThrow();
    expect(()=>resolveRuntimeTarget({...base,SUPERAGENT_CONFIG_DIR:os.homedir()},root)).toThrow();
  });
  it('rejects accidentally using test state as primary profile',()=>{
    const {root,profile}=stage();
    expect(()=>resolveRuntimeTarget({
      TLINE_SUPERAGENT_RUNTIME:'primary',
      SUPERAGENT_CONFIG_DIR:profile,
    },root)).toThrow(/staging/);
  });
  it('refuses unsupported modes and implicit production/test reclassification',()=>{
    const {root,profile}=stage();
    expect(()=>resolveRuntimeTarget({TLINE_SUPERAGENT_RUNTIME:'foobar'},root)).toThrow();
    expect(()=>resolveRuntimeTarget({
      TLINE_SUPERAGENT_RUNTIME:'primary',
      TLINE_SUPERAGENT_CORE_PORT:'58922',
      TLINE_SUPERAGENT_OWNER_MODE:'supervised-external',
      SUPERAGENT_CONFIG_DIR:profile
    },root)).toThrow();
  });
  it('refuses a symlinked profile when platform permits symlinks',()=>{
    const {root,profile}=stage();
    const alias=path.join(root,'alias');
    try {fs.symlinkSync(profile,alias,process.platform==='win32'?'junction':'dir');}
    catch {return;} // Windows profiles without privilege cannot make symlinks
    expect(()=>resolveRuntimeTarget({
      TLINE_SUPERAGENT_RUNTIME:'testing',
      TLINE_SUPERAGENT_CORE_PORT:'58922',
      TLINE_SUPERAGENT_OWNER_MODE:'supervised-external',
      SUPERAGENT_CONFIG_DIR:alias
    },root)).toThrow();
  });
});
