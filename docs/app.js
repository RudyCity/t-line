// t-line Landing Page Interactive Script

document.addEventListener('DOMContentLoaded', () => {
  // 1. Scroll Effect for Header
  const header = document.querySelector('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // 2. Interactive Terminal Simulator
  const simulatorContent = document.getElementById('simulator-content');
  const controlButtons = document.querySelectorAll('.control-btn');

  // Pre-configured simulated outputs
  const simulatedOutputs = {
    terminals: `
<div class="terminal-line"><span class="terminal-prompt">PS D:\\Projects\\t-line-demo&gt;</span> t-line term spawn --shell powershell</div>
<div class="terminal-line"><span class="terminal-info">[PTY Server]</span> Initializing native PTY shell process tree...</div>
<div class="terminal-line"><span class="terminal-info">[PTY Server]</span> GPU Canvas Renderer initialized successfully via @xterm/addon-canvas</div>
<div class="terminal-line">Windows PowerShell</div>
<div class="terminal-line">Copyright (C) Microsoft Corporation. All rights reserved.</div>
<div class="terminal-line"></div>
<div class="terminal-line"><span class="terminal-prompt">PS D:\\Projects\\t-line-demo&gt;</span> npm run dev</div>
<div class="terminal-line">&gt; t-line-demo@2.4.0 dev</div>
<div class="terminal-line">&gt; vite</div>
<div class="terminal-line"></div>
<div class="terminal-line"><span class="terminal-success">  ➜  Local:   http://localhost:5173/</span></div>
<div class="terminal-line"><span class="terminal-success">  ➜  Network: use --host to expose</span></div>
<div class="terminal-line"></div>
<div class="terminal-line"><span class="terminal-info">[PTY Server]</span> Auto-polled process name resolved: "vite.exe" (PID: 14208)</div>
<div class="terminal-line"><span class="terminal-info">[PTY Server]</span> Synchronized tab title indicator: "vite" <span class="terminal-cursor"></span></div>
    `,
    worktrees: `
<div class="terminal-line"><span class="terminal-prompt">PS D:\\Projects\\t-line-demo&gt;</span> t-line worktree list</div>
<div class="terminal-line">Retrieving active Git Worktrees for repository...</div>
<div class="terminal-line"></div>
<div class="wt-list">
  <div class="wt-item dirty">
    <div>
      <strong>🌿 feat-auth</strong> 
      <span style="display:block; font-size:0.75rem; color:var(--text-muted)">D:/Projects/t-line-demo/feat-auth</span>
    </div>
    <span class="wt-badge amber">⚠️ Dirty (3 changes)</span>
  </div>
  
  <div class="wt-item">
    <div>
      <strong>🌿 main</strong> 
      <span style="display:block; font-size:0.75rem; color:var(--text-muted)">D:/Projects/t-line-demo/main</span>
    </div>
    <span class="wt-badge purple">✓ Clean</span>
  </div>
  
  <div class="wt-item">
    <div>
      <strong>🌿 hotfix-cors</strong> 
      <span style="display:block; font-size:0.75rem; color:var(--text-muted)">D:/Projects/t-line-demo/hotfix-cors</span>
    </div>
    <span class="wt-badge purple">✓ Clean</span>
  </div>
</div>
<div class="terminal-line"></div>
<div class="terminal-line"><span class="terminal-success">[Git Worktree]</span> Dirty-first sorting applied. Workspaces with changes floated to top.</div>
<div class="terminal-line"><span class="terminal-prompt">PS D:\\Projects\\t-line-demo&gt;</span> <span class="terminal-cursor"></span></div>
    `,
    tunnels: `
<div class="terminal-line"><span class="terminal-prompt">PS D:\\Projects\\t-line-demo&gt;</span> t-line tunnel share --port 3999</div>
<div class="terminal-line"><span class="terminal-info">[Cloudflare]</span> Authenticating Cloudflare Tunnel session token...</div>
<div class="terminal-line"><span class="terminal-info">[Cloudflare]</span> Spawning secure daemon listener...</div>
<div class="terminal-line"><span class="terminal-success">[Cloudflare] Tunnel established successfully!</span></div>
<div class="terminal-line"></div>
<div class="terminal-line"><span class="terminal-info">🌐 Public URL:</span> <a href="#" style="color:var(--accent-purple); text-decoration:underline">https://tline-secure-share.trycloudflare.com</a></div>
<div class="terminal-line"><span class="terminal-info">🛡️ Access ACL:</span> Active Protection Enabled</div>
<div class="terminal-line"></div>
<div class="terminal-line"><span class="terminal-success">[ACL Connection log]</span></div>
<div class="terminal-line">16:01:05 [OK] WebSockets authorized for remote agent (IP: 182.253.12.8)</div>
<div class="terminal-line">16:01:22 <span class="terminal-warn">[BLOCKED]</span> Connection rejected from unauthorized endpoint (IP: 45.138.89.2)</div>
<div class="terminal-line"><span class="terminal-prompt">PS D:\\Projects\\t-line-demo&gt;</span> <span class="terminal-cursor"></span></div>
    `,
    tauri: `
<div class="terminal-line"><span class="terminal-prompt">PS D:\\Projects\\t-line-demo&gt;</span> npm run tauri</div>
<div class="terminal-line">&gt; t-line-desktop@2.0.0 tauri</div>
<div class="terminal-line">&gt; tauri dev</div>
<div class="terminal-line"></div>
<div class="terminal-line"><span class="terminal-info">[Tauri]</span> Compiling Rust native desktop client...</div>
<div class="terminal-line"><span class="terminal-info">[Tauri]</span> Initializing tauri-plugin-single-instance lock check...</div>
<div class="terminal-line"><span class="terminal-success">[Tauri]</span> Single-instance acquired. Startup diagnostics OK (Node.js LTS detected).</div>
<div class="terminal-line"><span class="terminal-info">[Tauri]</span> Spawning desktop wrapper windows...</div>
<div class="terminal-line"><span class="terminal-success">[Tauri] Combined Memory Footprint: 88 MB RAM</span></div>
<div class="terminal-line"><span class="terminal-info">[Tauri]</span> System tray dynamic context menu registered. Close-to-tray ready.</div>
<div class="terminal-line"><span class="terminal-prompt">PS D:\\Projects\\t-line-demo&gt;</span> <span class="terminal-cursor"></span></div>
    `
  };

  // Change terminal output on click
  controlButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons
      controlButtons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      button.classList.add('active');
      
      // Load corresponding simulated content
      const category = button.getAttribute('data-category');
      if (simulatedOutputs[category]) {
        // Simple typing loader transition
        simulatorContent.innerHTML = `<div class="terminal-line"><span class="terminal-info">Loading console state...</span> <span class="terminal-cursor"></span></div>`;
        setTimeout(() => {
          simulatorContent.innerHTML = simulatedOutputs[category].trim();
        }, 150);
      }
    });
  });

  // Load initial content (terminals)
  if (simulatorContent) {
    simulatorContent.innerHTML = simulatedOutputs.terminals.trim();
  }

  // 3. Quick Start Installation Code Tabs
  const installTabBtns = document.querySelectorAll('.install-tab-btn');
  const installPanels = document.querySelectorAll('.install-content-panel');

  installTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active classes
      installTabBtns.forEach(b => b.classList.remove('active'));
      installPanels.forEach(p => p.classList.remove('active'));
      
      // Add active classes
      btn.classList.add('active');
      const targetPanel = document.getElementById(btn.getAttribute('data-target'));
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
    });
  });

  // 4. Copy-to-Clipboard Code Utility
  const copyButtons = document.querySelectorAll('.code-copy-btn');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const codeBlock = btn.previousElementSibling;
      if (codeBlock) {
        const codeText = codeBlock.textContent.trim();
        navigator.clipboard.writeText(codeText).then(() => {
          // Visual copy feedback
          const originalText = btn.textContent;
          btn.textContent = 'Copied! ✓';
          btn.style.background = 'var(--accent-green)';
          btn.style.borderColor = 'var(--accent-green)';
          btn.style.color = '#fff';
          
          setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
            btn.style.borderColor = '';
            btn.style.color = '';
          }, 2000);
        }).catch(err => {
          console.error('Failed to copy text: ', err);
        });
      }
    });
  });

  // 5. 3D Card Hover Perspective Effect (Hero Image Container)
  const previewContainer = document.querySelector('.hero-preview-container');
  const previewImg = document.querySelector('.hero-preview');
  
  if (previewContainer && previewImg) {
    previewContainer.addEventListener('mousemove', (e) => {
      const rect = previewContainer.getBoundingClientRect();
      const x = e.clientX - rect.left; // x position inside element
      const y = e.clientY - rect.top;  // y position inside element
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((centerY - y) / centerY) * 4; // Max tilt: 4 degrees
      const rotateY = ((x - centerX) / centerX) * 4;
      
      previewImg.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
    });
    
    previewContainer.addEventListener('mouseleave', () => {
      previewImg.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
    });
  }
});
