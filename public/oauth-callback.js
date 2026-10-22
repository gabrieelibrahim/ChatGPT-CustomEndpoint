// Send only to the same-origin opener; remove the code from browser history immediately.
if (window.opener) window.opener.postMessage({ type: 'supergpt-oauth', url: location.href }, location.origin);
history.replaceState(null, '', location.pathname);
