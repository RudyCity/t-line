export const TLINE_HELPER_CODE = `(function() {
  // Only run if we are inside an iframe OR if running under the preview proxy path
  var isProxied = window.location.pathname.indexOf('/api/preview-proxy') === 0;
  if (window.self === window.top && !isProxied) return;

  // Persist tabId in sessionStorage to survive page reloads and redirects
  if (window.__TLINE_TAB_ID__) {
    try {
      sessionStorage.setItem('tline_tab_id', window.__TLINE_TAB_ID__);
    } catch(e) {}
  }

  console.log('[t-line-helper] Initialized and listening for commands...');

  // ----------------------------------------------------
  // 0. JS Navigation Interceptor (for SPAs and Google-style navigation)
  // ----------------------------------------------------
  function getProxyTarget() {
    // Injected by backend per-page: window.__TLINE_PROXY_TARGET__ = "https://www.google.com"
    if (window.__TLINE_PROXY_TARGET__) return window.__TLINE_PROXY_TARGET__;
    // Fallback: read from cookie set by proxy backend
    try {
      var match = document.cookie.match(/tline_proxy_target=([^;]+)/);
      if (match) return decodeURIComponent(match[1]);
    } catch(e) {}
    return null;
  }

  function getRealCurrentUrl() {
    var proxyTarget = getProxyTarget();
    if (!proxyTarget) return window.location.href;
    var path = window.location.pathname;
    var prefix = '/api/preview-proxy';
    var subPath = path.indexOf(prefix) === 0 ? path.substring(prefix.length) : path;
    if (subPath && subPath.charAt(0) !== '/') {
      subPath = '/' + subPath;
    }
    var targetBase = proxyTarget.replace(/[/]$/, '');
    return targetBase + subPath + window.location.search + window.location.hash;
  }

  function proxyNavigateUrl(url) {
    try {
      if (!url) return null;
      var urlStr = String(url);
      if (urlStr.indexOf('/api/preview-proxy') >= 0) {
        return url;
      }
      if (urlStr.indexOf('ipc.localhost') >= 0 || urlStr.indexOf('tauri.localhost') >= 0 || /^tauri:/i.test(urlStr)) {
        return url;
      }
      if (/^(wss?:|data:|blob:)/i.test(urlStr)) {
        return url;
      }
      var realBase = getRealCurrentUrl();
      var absoluteUrl = new URL(urlStr, realBase).href;
      if (/^https?:\\/\\//i.test(absoluteUrl)) {
        var parsedUrl = new URL(absoluteUrl);
        var targetOrigin = parsedUrl.origin;
        var targetPath = parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
        var sep = targetPath.indexOf('?') >= 0 ? '&' : '?';
        return '/api/preview-proxy' + targetPath + sep + 'target=' + encodeURIComponent(targetOrigin);
      }
    } catch(e) {}
    return null;
  }

  // Override window.fetch to route API calls through the proxy
  try {
    var _origFetch = window.fetch;
    window.fetch = function(input, init) {
      var url = '';
      if (typeof input === 'string') {
        url = input;
      } else if (input && typeof input === 'object' && 'url' in input) {
        url = input.url;
      } else if (input && typeof input.toString === 'function') {
        url = input.toString();
      }
      
      if (url) {
        var proxied = proxyNavigateUrl(url);
        if (proxied) {
          if (typeof input === 'string') {
            input = proxied;
          } else if (input && typeof input === 'object' && 'url' in input) {
            try {
              var reqClone = new Request(proxied, input);
              input = reqClone;
            } catch(reqErr) {
              try {
                var clonedInput = input.clone();
                Object.defineProperty(clonedInput, 'url', { value: proxied, writable: true });
                input = clonedInput;
              } catch(cloneErr) {}
            }
          }
        }
      }
      return _origFetch.call(this, input, init);
    };
  } catch (e) {
    console.warn('[t-line-helper] Could not override fetch:', e);
  }

  // Override window.XMLHttpRequest to route API calls through the proxy
  try {
    var _origXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
      var xhr = new _origXHR();
      var _origOpen = xhr.open;
      xhr.open = function(method, url, async, user, password) {
        var proxied = proxyNavigateUrl(url);
        return _origOpen.call(xhr, method, proxied || url, async !== false, user, password);
      };
      return xhr;
    };
  } catch (e) {
    console.warn('[t-line-helper] Could not override XMLHttpRequest:', e);
  }

  // Override Location.prototype.href setter
  try {
    var _locProto = Location.prototype;
    var _origHrefDesc = Object.getOwnPropertyDescriptor(_locProto, 'href');
    if (_origHrefDesc && _origHrefDesc.set) {
      Object.defineProperty(_locProto, 'href', {
        get: _origHrefDesc.get,
        set: function(url) {
          var proxied = proxyNavigateUrl(url);
          _origHrefDesc.set.call(this, proxied || url);
        },
        configurable: true
      });
    }

    // Override location.assign
    var _origAssign = _locProto.assign;
    _locProto.assign = function(url) {
      var proxied = proxyNavigateUrl(url);
      return _origAssign.call(this, proxied || url);
    };

    // Override location.replace
    var _origReplace = _locProto.replace;
    _locProto.replace = function(url) {
      var proxied = proxyNavigateUrl(url);
      return _origReplace.call(this, proxied || url);
    };
  } catch(e) {
    console.warn('[t-line-helper] Could not override location methods:', e);
  }

  // Override history.pushState / replaceState for SPA navigation
  try {
    var _origPushState = history.pushState;
    history.pushState = function(state, title, url) {
      if (url) {
        var proxied = proxyNavigateUrl(String(url));
        if (proxied) return _origPushState.call(this, state, title, proxied);
      }
      return _origPushState.apply(this, arguments);
    };

    var _origReplaceState = history.replaceState;
    history.replaceState = function(state, title, url) {
      if (url) {
        var proxied = proxyNavigateUrl(String(url));
        if (proxied) return _origReplaceState.call(this, state, title, proxied);
      }
      return _origReplaceState.apply(this, arguments);
    };
  } catch(e) {
    console.warn('[t-line-helper] Could not override history methods:', e);
  }

  // ----------------------------------------------------
  // 1. Error Interception (Console, Global Errors, Promises)
  // ----------------------------------------------------
  function sendPreviewEvent(type, payload) {
    // 1. Send via postMessage to parent iframe (if any)
    try {
      window.parent.postMessage({ type: type, payload: payload }, '*');
    } catch (e) {}

    // 2. Send via HTTP POST to Express backend if we are running in the proxy
    if (isProxied) {
      try {
        var tabId = window.__TLINE_TAB_ID__;
        if (!tabId) {
          try {
            tabId = sessionStorage.getItem('tline_tab_id');
          } catch(e) {}
        }
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/preview-proxy/event', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify({ type: type, payload: payload, tabId: tabId || null }));
      } catch (e) {}
    }
  }

  function sendErrorToParent(errorData) {
    sendPreviewEvent('tline-error', errorData);
  }

  // Hook global uncaught errors
  window.addEventListener('error', function(e) {
    sendErrorToParent({
      message: e.message || 'Unknown JavaScript error',
      filename: e.filename || '',
      lineno: e.lineno || 0,
      colno: e.colno || 0,
      stack: e.error ? e.error.stack : null
    });
  });

  // Hook unhandled promise rejections
  window.addEventListener('unhandledrejection', function(e) {
    const reason = e.reason;
    sendErrorToParent({
      message: reason ? (reason.message || String(reason)) : 'Unhandled Promise Rejection',
      filename: reason && reason.fileName ? reason.fileName : '',
      lineno: reason && reason.lineNumber ? reason.lineNumber : 0,
      colno: reason && reason.columnNumber ? reason.columnNumber : 0,
      stack: reason && reason.stack ? reason.stack : null
    });
  });

  // Intercept console.error calls
  const originalConsoleError = console.error;
  console.error = function() {
    originalConsoleError.apply(console, arguments);
    const argsArray = Array.prototype.slice.call(arguments);
    const message = argsArray.map(function(arg) {
      if (arg instanceof Error) return arg.stack || arg.message;
      if (typeof arg === 'object') {
        try { return JSON.stringify(arg); } catch(e) { return String(arg); }
      }
      return String(arg);
    }).join(' ');

    sendErrorToParent({
      message: message,
      filename: 'console.error',
      lineno: 0,
      colno: 0,
      stack: null
    });
  };

  // ----------------------------------------------------
  // 2. Element Inspection & Picker
  // ----------------------------------------------------
  let isInspectMode = false;
  let highlightEl = null;

  function createHighlightEl() {
    if (highlightEl) return highlightEl;
    highlightEl = document.createElement('div');
    highlightEl.id = 'tline-inspect-highlight';
    highlightEl.style.position = 'fixed';
    highlightEl.style.border = '2px solid #a855f7'; // Purple focus border
    highlightEl.style.backgroundColor = 'rgba(168, 85, 247, 0.15)';
    highlightEl.style.pointerEvents = 'none';
    highlightEl.style.zIndex = '99999999';
    highlightEl.style.transition = 'all 0.1s ease-out';
    document.body.appendChild(highlightEl);
    return highlightEl;
  }

  function removeHighlightEl() {
    if (highlightEl && highlightEl.parentNode) {
      highlightEl.parentNode.removeChild(highlightEl);
    }
    highlightEl = null;
  }

  function getCssSelector(el) {
    if (!(el instanceof Element)) return '';
    const path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
      let selector = el.nodeName.toLowerCase();
      if (el.id) {
        selector += '#' + el.id;
        path.unshift(selector);
        break; // Unique path reached
      } else {
        let sibling = el;
        let nth = 1;
        while (sibling = sibling.previousElementSibling) {
          if (sibling.nodeName.toLowerCase() === el.nodeName.toLowerCase()) {
            nth++;
          }
        }
        if (nth > 1) {
          selector += ':nth-of-type(' + nth + ')';
        }
      }
      path.unshift(selector);
      el = el.parentNode;
    }
    return path.join(' > ');
  }

  function getImportantStyles(el) {
    const styles = window.getComputedStyle(el);
    const keys = [
      'display', 'position', 'flex-direction', 'align-items', 'justify-content',
      'margin', 'padding', 'width', 'height', 'box-sizing', 'top', 'left',
      'opacity', 'z-index'
    ];
    const res = {};
    keys.forEach(function(k) {
      res[k] = styles.getPropertyValue(k);
    });
    return res;
  }

  function onMouseOver(e) {
    if (!isInspectMode) return;
    e.stopPropagation();
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.id === 'tline-inspect-highlight') return;

    const rect = target.getBoundingClientRect();
    const highlight = createHighlightEl();
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';
    highlight.style.top = rect.top + 'px';
    highlight.style.left = rect.left + 'px';
  }

  function onClick(e) {
    if (!isInspectMode) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.target;
    const payload = {
      tagName: target.tagName ? target.tagName.toLowerCase() : '',
      id: target.id || '',
      classes: target.classList ? Array.from(target.classList) : [],
      outerHTML: target.outerHTML ? target.outerHTML.substring(0, 3000) : '', // Safety limit
      computedStyles: target instanceof Element ? getImportantStyles(target) : {},
      selectorPath: target instanceof Element ? getCssSelector(target) : ''
    };

    sendPreviewEvent('tline-element-selected', payload);

    disableInspectMode();
  }

  function enableInspectMode() {
    isInspectMode = true;
    createHighlightEl();
    window.addEventListener('mouseover', onMouseOver, true);
    window.addEventListener('click', onClick, true);
    console.log('[t-line-helper] Element picker enabled.');
  }

  function disableInspectMode() {
    isInspectMode = false;
    removeHighlightEl();
    window.removeEventListener('mouseover', onMouseOver, true);
    window.removeEventListener('click', onClick, true);
    console.log('[t-line-helper] Element picker disabled.');
  }

  // ----------------------------------------------------
  // 2.5. Link and Form Submission Interceptor (to keep browsing in proxy)
  // ----------------------------------------------------
  window.addEventListener('click', function(e) {
    if (isInspectMode) return;

    let target = e.target;
    while (target && target.tagName !== 'A') {
      target = target.parentNode;
    }

    if (target && target.tagName === 'A') {
      const href = target.getAttribute('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        let absoluteUrl;
        try {
          absoluteUrl = new URL(href, window.location.href).href;
        } catch (err) {
          return;
        }

        if (/^https?:\\/\\//i.test(absoluteUrl)) {
          e.preventDefault();
          try {
            const parsedUrl = new URL(absoluteUrl);
            const targetOrigin = parsedUrl.origin;
            const targetPath = parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
            var sep = targetPath.indexOf('?') >= 0 ? '&' : '?';
            var newUrl = '/api/preview-proxy' + targetPath + sep + 'target=' + encodeURIComponent(targetOrigin);
            window.location.href = newUrl;
          } catch (err) {
            console.error('[t-line-helper] Failed to navigate via proxy:', err);
          }
        }
      }
    }
  }, true);

  window.addEventListener('submit', function(e) {
    const form = e.target;
    if (!form) return;
    const action = form.getAttribute('action');
    if (action) {
      let absoluteUrl;
      try {
        absoluteUrl = new URL(action, window.location.href).href;
      } catch (err) {
        return;
      }

      if (/^https?:\\/\\//i.test(absoluteUrl)) {
        e.preventDefault();
        try {
          const parsedUrl = new URL(absoluteUrl);
          const targetOrigin = parsedUrl.origin;
          const targetPath = parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
          document.cookie = 'tline_proxy_target=' + encodeURIComponent(targetOrigin) + '; path=/; SameSite=Lax';
          form.setAttribute('action', '/api/preview-proxy' + targetPath);
          form.submit();
        } catch (err) {
          console.error('[t-line-helper] Failed to submit form via proxy:', err);
        }
      }
    }
  }, true);

  // ----------------------------------------------------
  // 3. Parent Message Listener
  // ----------------------------------------------------
  window.addEventListener('message', function(e) {
    const data = e.data;
    if (!data) return;

    if (data.type === 'tline-start-inspect') {
      enableInspectMode();
    } else if (data.type === 'tline-stop-inspect') {
      disableInspectMode();
    }
  });


  // Send an initial handshake/ready message to the parent frame
  sendPreviewEvent('tline-ready', null);

  // Notify parent of the current real URL (so URL bar stays in sync after navigation)
  function notifyUrlChanged() {
    var proxyTarget = getProxyTarget();
    if (proxyTarget) {
      try {
        var realUrl = new URL(window.location.pathname + window.location.search + window.location.hash, proxyTarget + '/').href;
        sendPreviewEvent('tline-url-changed', { url: realUrl });
      } catch(e) {}
    }
  }
  notifyUrlChanged();
})();
`;
