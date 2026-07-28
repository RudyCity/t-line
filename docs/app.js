// Hallmark Anti-AI-slop Interactive Script for t-line Landing Page

document.addEventListener('DOMContentLoaded', () => {
  // 1. Header scroll border threshold
  const header = document.querySelector('header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 30) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }

  // 2. Interactive Console Simulator
  const simulatorContent = document.getElementById('simulator-content');
  const simBtns = document.querySelectorAll('.sim-btn');

  const simulatedOutputs = {
    superagent: `
<div class="term-line"><span class="term-prompt">PS D:\\Projects\\t-line&gt;</span> bunx superagent --server --multi</div>
<div class="term-line"><span class="term-info">[SuperAgent]</span> Multi-Agent HTTP & SSE engine active on port 7888</div>
<div class="term-line"><span class="term-info">[SuperAgent Bridge]</span> WebSocket client connected (Workspace: "D:/Projects/t-line")</div>
<div class="term-line"><span class="term-info">[SuperAgent Proxy]</span> POST /api/init -&gt; 200 OK (Session: sess_178522455)</div>
<div class="term-line"><span class="term-success">[SuperAgent Session] Session active. 45 REST proxy endpoints available</span></div>
<div class="term-line"><span class="term-info">[RMemory L1]</span> Loaded 14 workspace invariants & agent rules</div>
<div class="term-line"><span class="term-success">[Subagents] Spawning parallel workers: [researcher, coder, reviewer]</span></div>
<div class="term-line"><span class="term-prompt">PS D:\\Projects\\t-line&gt;</span> <span class="term-muted">_</span></div>
    `,
    terminals: `
<div class="term-line"><span class="term-prompt">PS D:\\Projects\\t-line&gt;</span> bun run dev</div>
<div class="term-line"><span class="term-info">[PTY Backend]</span> Spawned WinPTY process (PID: 14292) [PowerShell 7.4.1]</div>
<div class="term-line"><span class="term-info">[Express Server]</span> Listening on http://localhost:3999</div>
<div class="term-line"><span class="term-info">[Vite DevServer]</span> Ready in 240ms at http://localhost:5773</div>
<div class="term-line"><span class="term-success">[xterm.js WebGL] Canvas addon attached (GPU acceleration active)</span></div>
<div class="term-line"><span class="term-prompt">PS D:\\Projects\\t-line&gt;</span> <span class="term-muted">_</span></div>
    `,
    worktrees: `
<div class="term-line"><span class="term-prompt">PS D:\\Projects\\t-line&gt;</span> git worktree list</div>
<div class="term-line">D:/Projects/t-line         15a98b8 [main]</div>
<div class="term-line">D:/Projects/t-line-feat    9715b5d [feature/superagent-ui] <span class="term-warn">* DIRTY (3 modified files)</span></div>
<div class="term-line"><span class="term-info">[t-line Indexer]</span> Detected 1 dirty worktree. Updating sidebar weights...</div>
<div class="term-line"><span class="term-success">[t-line Checkpoint] Snapshot taken at refs/tline/checkpoints/feat-178522</span></div>
<div class="term-line"><span class="term-prompt">PS D:\\Projects\\t-line&gt;</span> <span class="term-muted">_</span></div>
    `,
    tunnels: `
<div class="term-line"><span class="term-prompt">PS D:\\Projects\\t-line&gt;</span> cloudflared tunnel --url http://localhost:3999</div>
<div class="term-line"><span class="term-info">[Cloudflare Tunnel]</span> Connection registered (ID: 8a4c11b0-9f2e)</div>
<div class="term-line"><span class="term-success">[Share URL] https://tline-dev-share.trycloudflare.com</span></div>
<div class="term-line"><span class="term-info">[ACL Logger]</span> Incoming request from 182.253.11.4 -&gt; Granted</div>
<div class="term-line"><span class="term-prompt">PS D:\\Projects\\t-line&gt;</span> <span class="term-muted">_</span></div>
    `
  };

  if (simulatorContent) {
    simulatorContent.innerHTML = simulatedOutputs.superagent.trim();
  }

  simBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.getAttribute('data-category');

      simBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (simulatorContent && simulatedOutputs[category]) {
        simulatorContent.innerHTML = simulatedOutputs[category].trim();
      }
    });
  });

  // 3. Tab switching for installation code blocks
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');

      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
    });
  });
});
