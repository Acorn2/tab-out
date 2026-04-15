'use strict';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

async function bootTabOut() {
  try {
    await loadScript('config.local.js');
  } catch {
    // Personal config is optional. Continue with defaults.
  }

  await loadScript('app.js');
}

bootTabOut();
