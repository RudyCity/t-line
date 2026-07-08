import { createProxyMiddleware } from 'http-proxy-middleware';
import zlib from 'zlib';
import path from 'path';
import fs from 'fs';
import { TLINE_HELPER_CODE } from './tline-helper-code';

let currentProxyTarget = '';

const sanitizeHeaders = (proxyHeaders: any) => {
  const headers = { ...proxyHeaders };
  
  // Case-insensitive deletion of security headers
  for (const key of Object.keys(headers)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey === 'content-security-policy' ||
      lowerKey === 'content-security-policy-report-only' ||
      lowerKey === 'x-frame-options' ||
      lowerKey === 'frame-options'
    ) {
      delete headers[key];
    }
  }

  // Find location redirect header case-insensitively
  let locationKey = 'location';
  let redirectUrl = '';
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === 'location') {
      locationKey = key;
      redirectUrl = headers[key] as string;
      break;
    }
  }
  
  if (redirectUrl) {
    try {
      // Check if it's an absolute URL
      const parsedRedirect = new URL(redirectUrl);
      const targetOrigin = parsedRedirect.origin;
      const targetPath = parsedRedirect.pathname + parsedRedirect.search + parsedRedirect.hash;
      headers[locationKey] = `/api/preview-proxy${targetPath}${targetPath.includes('?') ? '&' : '?'}target=${encodeURIComponent(targetOrigin)}`;
    } catch (e) {
      // If it's already a relative path, let the browser handle it relative to <base> tag
    }
  }
  return headers;
};

export const previewProxy = createProxyMiddleware({
  pathFilter: (path, req) => {
    // Only proxy if request path begins with /api/preview-proxy
    const url = (req as any).originalUrl || req.url || path;
    return url.startsWith('/api/preview-proxy');
  },
  target: 'http://localhost',
  changeOrigin: true,
  secure: false, // Support self-signed certificates and dev https setups
  ws: true,
  pathRewrite: {
    '^/api/preview-proxy': '',
  },
  router: (req) => {
    const urlParams = new URL(req.url || '', `http://${req.headers.host}`);
    let target = urlParams.searchParams.get('target');
    if (!target) {
      const cookies = req.headers.cookie || '';
      const match = cookies.match(/tline_proxy_target=([^;]+)/);
      if (match) {
        target = decodeURIComponent(match[1]);
      }
    }
    if (target) {
      currentProxyTarget = target.replace(/\/$/, '');
    }
    return currentProxyTarget || 'http://localhost';
  },
  selfHandleResponse: true,
  on: {
    proxyReq: (proxyReq, req, res) => {
      const urlParams = new URL(req.url || '', `http://${req.headers.host}`);
      const target = urlParams.searchParams.get('target');
      if (target) {
        res.setHeader('Set-Cookie', `tline_proxy_target=${encodeURIComponent(target)}; Path=/; SameSite=Lax`);
      }
      // Strip the 'target' param before forwarding to avoid confusing the target server
      try {
        const parsedPath = new URL(proxyReq.path, 'http://localhost');
        parsedPath.searchParams.delete('target');
        proxyReq.path = parsedPath.pathname + (parsedPath.search || '');
      } catch (e) {}
      // Force target to send uncompressed content so we can modify the HTML safely
      proxyReq.setHeader('accept-encoding', 'identity');
    },
    proxyRes: (proxyRes, req, res) => {
      const contentType = proxyRes.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        let body = Buffer.from([]);
        proxyRes.on('data', (chunk) => {
          body = Buffer.concat([body, chunk]);
        });
        proxyRes.on('end', () => {
          const contentEncoding = proxyRes.headers['content-encoding'] || '';
          let decompressedBody = body;
          try {
            if (contentEncoding.includes('gzip')) {
              decompressedBody = zlib.gunzipSync(body);
            } else if (contentEncoding.includes('deflate')) {
              decompressedBody = zlib.inflateSync(body);
            } else if (contentEncoding.includes('br')) {
              decompressedBody = zlib.brotliDecompressSync(body);
            }
          } catch (decompressError) {
            console.error('[Preview Proxy] Failed to decompress body:', decompressError);
          }

          let html = decompressedBody.toString('utf8');

          // Strip http-equiv="content-security-policy" meta tags case-insensitively
          html = html.replace(/<meta\s+[^>]*http-equiv=["']content-security-policy["'][^>]*>/gi, '');

          const baseTag = `<base href="/api/preview-proxy/">`;
          // Inject the current proxy target as a global variable so the helper script
          // can correctly resolve relative URLs against the real target origin
          const targetVar = `<script>window.__TLINE_PROXY_TARGET__="${currentProxyTarget}";</script>`;
          const helperScript = `<script src="/api/preview-proxy/tline-helper.js"></script>`;
          
          // Robust case-insensitive head, html, or doctype tag injection
          const headMatch = html.match(/<head\b[^>]*>/i);
          if (headMatch && headMatch.index !== undefined) {
            const insertIndex = headMatch.index + headMatch[0].length;
            html = html.slice(0, insertIndex) + `\n  ${baseTag}\n  ${targetVar}\n  ${helperScript}` + html.slice(insertIndex);
          } else {
            const htmlMatch = html.match(/<html\b[^>]*>/i);
            if (htmlMatch && htmlMatch.index !== undefined) {
              const insertIndex = htmlMatch.index + htmlMatch[0].length;
              html = html.slice(0, insertIndex) + `\n  ${baseTag}\n  ${targetVar}\n  ${helperScript}` + html.slice(insertIndex);
            } else {
              const doctypeMatch = html.match(/<!doctype\s+html[^>]*>/i);
              if (doctypeMatch && doctypeMatch.index !== undefined) {
                const insertIndex = doctypeMatch.index + doctypeMatch[0].length;
                html = html.slice(0, insertIndex) + `\n  ${baseTag}\n  ${targetVar}\n  ${helperScript}` + html.slice(insertIndex);
              } else {
                html = baseTag + targetVar + helperScript + html;
              }
            }
          }
          
          const headers = sanitizeHeaders(proxyRes.headers);
          delete headers['content-length'];
          delete headers['content-encoding'];
          res.writeHead(proxyRes.statusCode || 200, headers);
          res.end(html);
        });
      } else {
        const headers = sanitizeHeaders(proxyRes.headers);
        res.writeHead(proxyRes.statusCode || 200, headers);
        proxyRes.pipe(res);
      }
    },
    error: (err: any, req, res) => {
      // ECONNABORTED / ECONNRESET / EPIPE = browser navigated away mid-request.
      // This is completely normal and expected — silently ignore to avoid log spam.
      if (err.code === 'ECONNABORTED' || err.code === 'ECONNRESET' || err.code === 'EPIPE') {
        return;
      }
      console.error('[Preview Proxy Error]:', err);
      const response = res as any;
      if (response.headersSent) return;
      if (typeof response.writeHead === 'function') {
        response.writeHead(502, { 'Content-Type': 'text/html' });
        response.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Web Preview Offline</title>
            <script>
              try {
                const theme = localStorage.getItem('tline-theme') || 'default';
                const accent = localStorage.getItem('tline-accent-color') || '#6366f1';
                const themes = {
                  default: { bgMain: '#05070c', textMain: '#f8fafc', bgCard: 'rgba(17, 24, 39, 0.45)', border: 'rgba(255, 255, 255, 0.06)', textMuted: '#94a3b8' },
                  dracula: { bgMain: '#1e1f29', textMain: '#f8f8f2', bgCard: 'rgba(40, 42, 54, 0.5)', border: 'rgba(98, 114, 164, 0.2)', textMuted: '#6272a4' },
                  cyberpunk: { bgMain: '#0b0813', textMain: '#f8fafc', bgCard: 'rgba(26, 15, 46, 0.45)', border: 'rgba(50, 24, 85, 0.55)', border: 'rgba(255, 0, 127, 0.15)', textMuted: '#ff007f' },
                  forest: { bgMain: '#070d0a', textMain: '#f0fdf4', bgCard: 'rgba(16, 28, 21, 0.45)', border: 'rgba(16, 185, 129, 0.1)', textMuted: '#86efac' },
                  nord: { bgMain: '#2e3440', textMain: '#eceff4', bgCard: 'rgba(46, 52, 64, 0.5)', border: 'rgba(76, 86, 106, 0.3)', textMuted: '#d8dee9' },
                  light: { bgMain: '#f8fafc', textMain: '#0f172a', bgCard: 'rgba(255, 255, 255, 0.7)', border: 'rgba(0, 0, 0, 0.08)', textMuted: '#64748b' }
                };
                const preset = themes[theme] || themes.default;
                const root = document.documentElement;
                root.style.setProperty('--bg-main', preset.bgMain);
                root.style.setProperty('--text-main', preset.textMain);
                root.style.setProperty('--bg-card', preset.bgCard);
                root.style.setProperty('--border-color', preset.border || preset.borderColor || 'rgba(255,255,255,0.06)');
                root.style.setProperty('--text-muted', preset.textMuted);
                root.style.setProperty('--accent-color', accent);
              } catch(e) {}
            </script>
            <style>
              body { background: var(--bg-main, #0b0f19); color: var(--text-main, #f3f4f6); font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { max-width: 420px; width: 85%; background: var(--bg-card, rgba(17, 24, 39, 0.45)); border: 1px solid var(--border-color, rgba(255, 255, 255, 0.06)); border-radius: 12px; padding: 32px 24px; text-align: center; }
              .icon { font-size: 32px; margin-bottom: 16px; display: inline-block; }
              h1 { font-size: 20px; font-weight: 700; margin: 0 0 8px; background: linear-gradient(135deg, var(--accent-color, #a855f7), var(--accent-color, #6366f1)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
              p { color: var(--text-muted, #9ca3af); font-size: 13px; line-height: 1.5; margin: 0 0 20px; }
              code { background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; color: var(--accent-color, #e9d5ff); font-family: monospace; }
              .btn { background: linear-gradient(135deg, var(--accent-color, #a855f7), var(--accent-color, #6366f1)); color: white; border: none; padding: 10px 24px; font-size: 13px; font-weight: 600; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
              .btn:hover { transform: translateY(-1px); }
            </style>
          </head>
          <body>
            <div class="card">
              <span class="icon">🌐</span>
              <h1>Web Preview Offline</h1>
              <p>Pratinjau web saat ini offline di <strong>${currentProxyTarget}</strong>.<br><br>Jalankan server pengembangan Anda (seperti <code>npm run dev</code>) di terminal, lalu klik tombol di bawah.</p>
              <button class="btn" onclick="window.location.reload()">Segarkan Koneksi</button>
            </div>
          </body>
          </html>
        `);
      }
    }
  }
});
