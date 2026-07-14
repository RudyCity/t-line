export const TLINE_HELPER_CODE = `(function() {
  // Only run if we are inside an iframe OR if running under the preview proxy path OR inside Tauri native shell
  var isProxied = window.location.pathname.indexOf('/api/preview-proxy') === 0;
  var isTauri = !!(window && (window.__TLINE_NATIVE__ || window.__tauri__ || window.__TAURI__));
  if (window.self === window.top && !isProxied && !isTauri) return;

  // Persist tabId in sessionStorage to survive page reloads and redirects
  if (window.__TLINE_TAB_ID__ && window.__TLINE_TAB_ID__ !== 'null' && window.__TLINE_TAB_ID__ !== 'undefined') {
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
      var match = document.cookie.match(/(?:^|;\s*)tline_proxy_target=([^;]+)/);
      if (match) {
        var val = decodeURIComponent(match[1]);
        if (val && val !== 'null' && val !== 'undefined') return val;
      }
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
        var newUrl = '/api/preview-proxy' + targetPath + sep + 'target=' + encodeURIComponent(targetOrigin);
        var tabId = window.__TLINE_TAB_ID__ || sessionStorage.getItem('tline_tab_id');
        if (tabId && tabId !== 'null' && tabId !== 'undefined') {
          newUrl += '&tabId=' + encodeURIComponent(tabId);
        }
        return newUrl;
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
      var result;
      if (url) {
        var proxied = proxyNavigateUrl(String(url));
        if (proxied) {
          result = _origPushState.call(this, state, title, proxied);
          notifyUrlChanged();
          return result;
        }
      }
      result = _origPushState.apply(this, arguments);
      notifyUrlChanged();
      return result;
    };

    var _origReplaceState = history.replaceState;
    history.replaceState = function(state, title, url) {
      var result;
      if (url) {
        var proxied = proxyNavigateUrl(String(url));
        if (proxied) {
          result = _origReplaceState.call(this, state, title, proxied);
          notifyUrlChanged();
          return result;
        }
      }
      result = _origReplaceState.apply(this, arguments);
      notifyUrlChanged();
      return result;
    };

    try {
      window.addEventListener('popstate', notifyUrlChanged);
      window.addEventListener('hashchange', notifyUrlChanged);
    } catch (err) {}
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

    // 2. Send via Tauri event bus if running inside a Tauri native webview
    if (isTauri) {
      try {
        var tauriTabId = window.__TLINE_TAB_ID__;
        if (!tauriTabId || tauriTabId === 'null' || tauriTabId === 'undefined') {
          try { tauriTabId = sessionStorage.getItem('tline_tab_id'); } catch(e) {}
        }
        if (window.__TAURI__ && window.__TAURI__.event && typeof window.__TAURI__.event.emit === 'function') {
          window.__TAURI__.event.emit('tline-webview-event', { type: type, payload: payload, tabId: tauriTabId || null });
        }
      } catch (e) {}
    }

    // 3. Send via HTTP POST to Express backend if we are running in the proxy
    if (isProxied) {
      try {
        var tabId = window.__TLINE_TAB_ID__;
        if (!tabId || tabId === 'null' || tabId === 'undefined') {
          try {
            var match = document.cookie.match(/(?:^|;\s*)tline_tab_id=([^;]+)/);
            if (match) tabId = decodeURIComponent(match[1]);
          } catch(e) {}
        }
        if (!tabId || tabId === 'null' || tabId === 'undefined') {
          try {
            tabId = sessionStorage.getItem('tline_tab_id');
          } catch(e) {}
        }
        if (tabId && tabId !== 'null' && tabId !== 'undefined') {
          try {
            sessionStorage.setItem('tline_tab_id', tabId);
          } catch(e) {}
        }
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/preview-proxy/event', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify({ type: type, payload: payload, tabId: (tabId && tabId !== 'null' && tabId !== 'undefined') ? tabId : null }));
      } catch (e) {}
    }
  }

  var isSendingError = false;
  var recentErrors = {};
  var errorTimestamps = [];
  var MAX_ERRORS_PER_WINDOW = 15;
  var RATE_LIMIT_WINDOW_MS = 5000;

  function isTauriIPCError(message) {
    if (!message || typeof message !== 'string') return false;
    var msgLower = message.toLowerCase();
    return (
      msgLower.indexOf('postmessage failed') !== -1 ||
      msgLower.indexOf('messages queue full') !== -1 ||
      msgLower.indexOf('0x80070718') !== -1 ||
      msgLower.indexOf('0x80070578') !== -1 ||
      msgLower.indexOf('webview2') !== -1 ||
      msgLower.indexOf('tauri-webview-event') !== -1 ||
      msgLower.indexOf('__tauri__') !== -1
    );
  }

  function shouldThrottleError(message) {
    if (isTauriIPCError(message)) {
      return true;
    }

    var now = Date.now();
    
    // Deduplication within 2 seconds
    if (recentErrors[message] && (now - recentErrors[message] < 2000)) {
      return true;
    }
    recentErrors[message] = now;

    // Prune recentErrors if it grows too large
    for (var k in recentErrors) {
      if (recentErrors.hasOwnProperty(k)) {
        if (now - recentErrors[k] > 5000) {
          delete recentErrors[k];
        }
      }
    }

    // Rate limiting: clean old timestamps
    while (errorTimestamps.length > 0 && (now - errorTimestamps[0] > RATE_LIMIT_WINDOW_MS)) {
      errorTimestamps.shift();
    }

    if (errorTimestamps.length >= MAX_ERRORS_PER_WINDOW) {
      return true;
    }

    errorTimestamps.push(now);
    return false;
  }

  function sendErrorToParent(errorData) {
    if (isSendingError) return;
    isSendingError = true;
    try {
      var msg = errorData.message || '';
      if (!shouldThrottleError(msg)) {
        sendPreviewEvent('tline-error', errorData);
      }
    } catch (e) {
      if (typeof originalConsoleError === 'function') {
        originalConsoleError.call(console, '[t-line-helper] Failed to send error to parent:', e);
      }
    } finally {
      isSendingError = false;
    }
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
    if (typeof originalConsoleError === 'function') {
      originalConsoleError.apply(console, arguments);
    }
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
    highlightEl.style.backgroundColor = 'rgba(168, 85, 247, 0.25)';
    highlightEl.style.pointerEvents = 'none';
    highlightEl.style.zIndex = '99999999';
    highlightEl.style.transition = 'width 0.05s ease-out, height 0.05s ease-out, top 0.05s ease-out, left 0.05s ease-out';
    highlightEl.style.boxShadow = '0 0 8px rgba(168, 85, 247, 0.5)';
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
    
    // Try using @medv/finder equivalent logic or a fast fallback
    try {
      const path = [];
      let current = el;
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let selector = current.nodeName.toLowerCase();
        const id = current.getAttribute('id');
        if (id && !id.match(/^[0-9]/) && !id.includes(':')) {
          selector += '#' + id;
          path.unshift(selector);
          break;
        }
        
        let className = current.getAttribute('class');
        if (className) {
          const cleanClasses = className.trim().split(/\s+/)
            .filter(c => c && !c.includes(':') && !c.includes('[') && !c.includes('/') && !c.match(/^[0-9]/));
          if (cleanClasses.length > 0) {
            selector += '.' + cleanClasses.join('.');
          }
        }

        let sibling = current;
        let nth = 1;
        while (sibling = sibling.previousElementSibling) {
          if (sibling.nodeName.toLowerCase() === current.nodeName.toLowerCase()) {
            nth++;
          }
        }
        
        let hasNextSibling = false;
        let next = current;
        while (next = next.nextElementSibling) {
          if (next.nodeName.toLowerCase() === current.nodeName.toLowerCase()) {
            hasNextSibling = true;
            break;
          }
        }

        if (nth > 1 || hasNextSibling) {
          selector += ':nth-of-type(' + nth + ')';
        }
        
        path.unshift(selector);
        current = current.parentNode;
      }
      return path.join(' > ');
    } catch (e) {
      // Graceful fallback selector
      return el.tagName ? el.tagName.toLowerCase() : 'element';
    }
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
    if (target.getAttribute('id') === 'tline-inspect-highlight') return;

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

    console.log('[t-line-helper] Click detected in inspect mode. Raw event target:', e.target);

    try {
      let target = e.target;
      if (!target) {
        console.warn('[t-line-helper] Click event target is null or undefined.');
        return;
      }

      // Handle clicking the highlight overlay itself (if pointer-events: none is ignored/overridden)
      if (target.id === 'tline-inspect-highlight' || (typeof target.getAttribute === 'function' && target.getAttribute('id') === 'tline-inspect-highlight')) {
        console.log('[t-line-helper] Clicked inspect highlight overlay. Finding underlying element...');
        if (highlightEl) {
          highlightEl.style.display = 'none';
          target = document.elementFromPoint(e.clientX, e.clientY);
          highlightEl.style.display = '';
          console.log('[t-line-helper] Found underlying target under overlay:', target);
        }
      }

      // Traverse up to find the nearest element node (nodeType 1)
      const originalTarget = target;
      while (target && target.nodeType !== 1) {
        target = target.parentNode;
      }

      if (originalTarget !== target) {
        console.log('[t-line-helper] Traversed up from non-element node to nearest Element:', target);
      }

      if (!target || !(target instanceof Element)) {
        console.warn('[t-line-helper] No valid Element found to inspect.');
        disableInspectMode();
        return;
      }

      const payload = {
        tagName: target.tagName ? target.tagName.toLowerCase() : '',
        id: (typeof target.getAttribute === 'function' ? target.getAttribute('id') : '') || '',
        classes: target.classList ? Array.from(target.classList) : [],
        outerHTML: target.outerHTML ? target.outerHTML.substring(0, 3000) : '', // Safety limit
        computedStyles: getImportantStyles(target),
        selectorPath: getCssSelector(target)
      };

      console.log('[t-line-helper] Element selected. Dispatching payload:', payload);

      sendPreviewEvent('tline-element-selected', payload);
    } catch (err) {
      console.error('[t-line-helper] Error in onClick inspect handler:', err);
    } finally {
      disableInspectMode();
    }
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

    var target = e.target;
    while (target && target.tagName !== 'A') {
      target = target.parentNode;
    }

    if (target && target.tagName === 'A') {
      var href = target.getAttribute('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        var proxyTarget = getProxyTarget();
        if (proxyTarget) {
          try {
            var isAbsolute = /^(https?:)?\\/\\//i.test(href);
            if (isAbsolute) {
              var absoluteUrl = new URL(href, window.location.origin).href;
              var parsedTarget = new URL(proxyTarget);
              var parsedUrl = new URL(absoluteUrl);
              
              if (parsedUrl.origin === parsedTarget.origin) {
                var targetPath = parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
                var sep = targetPath.indexOf('?') >= 0 ? '&' : '?';
                var proxyNavigateUrl = '/api/preview-proxy' + targetPath + sep + 'target=' + encodeURIComponent(parsedTarget.origin);
                var tabId = window.__TLINE_TAB_ID__ || sessionStorage.getItem('tline_tab_id');
                if (tabId && tabId !== 'null' && tabId !== 'undefined') {
                  proxyNavigateUrl += '&tabId=' + encodeURIComponent(tabId);
                }
                
                target.setAttribute('href', proxyNavigateUrl);
                sendPreviewEvent('tline-url-changed', { url: absoluteUrl });
              }
            }
          } catch (err) {}
        }
      }
    }
  }, true);

  window.addEventListener('submit', function(e) {
    var form = e.target;
    if (!form) return;
    var action = form.getAttribute('action');
    if (action) {
      var proxyTarget = getProxyTarget();
      if (proxyTarget) {
        try {
          var isAbsolute = /^(https?:)?\\/\\//i.test(action);
          if (isAbsolute) {
            var absoluteUrl = new URL(action, window.location.origin).href;
            var parsedTarget = new URL(proxyTarget);
            var parsedUrl = new URL(absoluteUrl);
            
            if (parsedUrl.origin === parsedTarget.origin) {
              var targetPath = parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
              var sep = targetPath.indexOf('?') >= 0 ? '&' : '?';
              var proxyNavigateUrl = '/api/preview-proxy' + targetPath + sep + 'target=' + encodeURIComponent(parsedTarget.origin);
              var tabId = window.__TLINE_TAB_ID__ || sessionStorage.getItem('tline_tab_id');
              if (tabId && tabId !== 'null' && tabId !== 'undefined') {
                proxyNavigateUrl += '&tabId=' + encodeURIComponent(tabId);
              }
              form.setAttribute('action', proxyNavigateUrl);
              document.cookie = 'tline_proxy_target=' + encodeURIComponent(parsedTarget.origin) + '; path=/; SameSite=Lax';
            }
          }
        } catch (err) {}
      }
    }
  }, true);;

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

  // Periodically send tline-ready until acknowledged to avoid race conditions during initial load (max 10 attempts)
  var isReadyAcked = false;
  var readyAttempts = 0;
  var readyInterval = setInterval(function() {
    readyAttempts++;
    if (isReadyAcked || readyAttempts > 10) {
      clearInterval(readyInterval);
      return;
    }
    sendPreviewEvent('tline-ready', null);
  }, 1000);

  function stopReadyInterval() {
    if (readyInterval) {
      clearInterval(readyInterval);
      readyInterval = null;
    }
  }

  // Stop the interval when we receive acknowledgement or start/stop inspect commands
  window.addEventListener('message', function(e) {
    if (e.data && (e.data.type === 'tline-start-inspect' || e.data.type === 'tline-stop-inspect' || e.data.type === 'tline-ack-ready')) {
      stopReadyInterval();
    }
  });

  // Also send tline-ready if parent pings us
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'tline-ping') {
      sendPreviewEvent('tline-ready', null);
      stopReadyInterval();
    }
  });

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
