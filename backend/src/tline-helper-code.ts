export const TLINE_HELPER_CODE = `(function() {
  // Only run if we are inside an iframe
  if (window.self === window.top) return;

  console.log('[t-line-helper] Initialized and listening for commands...');

  // ----------------------------------------------------
  // 1. Error Interception (Console, Global Errors, Promises)
  // ----------------------------------------------------
  function sendErrorToParent(errorData) {
    window.parent.postMessage({
      type: 'tline-error',
      payload: errorData
    }, '*');
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
      tagName: target.tagName.toLowerCase(),
      id: target.id || '',
      classes: Array.from(target.classList),
      outerHTML: target.outerHTML.substring(0, 3000), // Safety limit
      computedStyles: getImportantStyles(target),
      selectorPath: getCssSelector(target)
    };

    window.parent.postMessage({
      type: 'tline-element-selected',
      payload: payload
    }, '*');

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
  window.parent.postMessage({ type: 'tline-ready' }, '*');
})();
`;
