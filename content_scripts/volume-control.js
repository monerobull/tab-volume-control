function setVolume(vol) {
  window.postMessage({ type: '__TVC_SET_VOLUME__', volume: vol }, '*')
}

// Ask the background for this tab's top-level-host volume. Doing it via the
// background (rather than reading storage by window.location.hostname) means
// cross-origin iframes inherit the parent page's setting. Failure-tolerant:
// if the background never answers, we simply leave the page untouched.
browser.runtime.sendMessage({ type: 'getVolume' }).then(response => {
  if (response && response.volume !== null && response.volume !== undefined) {
    setVolume(response.volume)
  }
}).catch(() => {})

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'setVolume') {
    setVolume(message.volume)
    sendResponse({ success: true })
  } else if (message.type === 'getMediaInfo') {
    const elements = document.querySelectorAll('audio, video')
    sendResponse({
      type: 'mediaInfo',
      hasAudio: Array.from(elements).some(el => !el.paused),
      count: elements.length
    })
  }
  return true
})
