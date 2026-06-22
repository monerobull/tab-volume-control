// Resolves a tab's *top-level* host for any frame that asks. Content scripts
// run in every frame (all_frames), but a cross-origin iframe only knows its
// own host. The background sees sender.tab.url, so it can answer with the
// volume the user actually set for the tab's top-level site.
function hostOf(url) {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (message && message.type === 'getVolume') {
    const host = sender.tab && hostOf(sender.tab.url)
    if (!host) return Promise.resolve({ volume: null })
    return browser.storage.local.get('volumes').then(data => {
      const volumes = data.volumes || {}
      const volume = volumes[host] !== undefined ? volumes[host] : null
      return { volume }
    })
  }
})
