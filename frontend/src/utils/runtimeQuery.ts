declare global {
  interface Window {
    __TLINE_DETACHED_QUERY__?: string;
  }
}

export function getRuntimeSearchParams(): URLSearchParams {
  const search = window.location.search || window.__TLINE_DETACHED_QUERY__ || '';
  return new URLSearchParams(search);
}
