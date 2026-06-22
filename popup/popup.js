let preMute = {}

function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

const saveVolumes = debounce(volumes => {
  browser.storage.local.set({ volumes })
}, 300)

const savePreMute = debounce(data => {
  browser.storage.local.set({ preMute: data })
}, 300)

document.addEventListener('DOMContentLoaded', async () => {
  const tabList = document.getElementById('tab-list')
  const status = document.getElementById('status')

  let tabs
  try {
    tabs = await browser.tabs.query({ currentWindow: true })
  } catch {
    status.textContent = 'Error accessing tabs'
    return
  }

  const validTabs = tabs.filter(t =>
    t.url && (t.url.startsWith('http://') || t.url.startsWith('https://'))
  )

  if (validTabs.length === 0) {
    status.textContent = 'No supported tabs found'
    return
  }

  const data = await browser.storage.local.get(['volumes', 'preMute'])
  const volumes = data.volumes || {}
  preMute = data.preMute || {}

  // Send a volume to every tab in this window sharing the host, so all tabs
  // of the same site update live (settings are keyed by host, not by tab).
  function broadcast(host, vol) {
    for (const t of validTabs) {
      let h
      try {
        h = new URL(t.url).hostname
      } catch {
        continue
      }
      if (h === host) {
        browser.tabs.sendMessage(t.id, { type: 'setVolume', volume: vol }).catch(() => {})
      }
    }
  }

  const probes = []

  for (const tab of validTabs) {
    let hostname
    try {
      hostname = new URL(tab.url).hostname
    } catch {
      continue
    }

    const savedVolume = volumes[hostname] !== undefined ? volumes[hostname] : 1

    const item = document.createElement('div')
    item.className = 'tab-item'

    const icon = document.createElement('img')
    icon.className = 'tab-icon'
    icon.src = tab.favIconUrl || '../icons/icon.svg'
    icon.onerror = () => { icon.src = '../icons/icon.svg' }

    const info = document.createElement('div')
    info.className = 'tab-info'

    const title = document.createElement('div')
    title.className = 'tab-title'
    title.textContent = tab.title || 'Untitled'

    const url = document.createElement('div')
    url.className = 'tab-url'
    url.textContent = hostname

    info.appendChild(title)
    info.appendChild(url)

    const control = document.createElement('div')
    control.className = 'volume-control'

    const muteBtn = document.createElement('button')
    muteBtn.className = 'mute-btn'
    muteBtn.textContent = savedVolume === 0 ? '🔇' : '🔊'
    muteBtn.title = savedVolume === 0 ? 'Unmute' : 'Mute'

    const slider = document.createElement('input')
    slider.type = 'range'
    slider.className = 'volume-slider'
    slider.min = 0
    slider.max = 100
    slider.value = savedVolume * 100

    const label = document.createElement('span')
    label.className = 'volume-label'
    label.textContent = Math.round(slider.value) + '%'

    function updateVolume(vol) {
      slider.value = vol * 100
      label.textContent = Math.round(vol * 100) + '%'
      muteBtn.textContent = vol === 0 ? '🔇' : '🔊'
      muteBtn.title = vol === 0 ? 'Unmute' : 'Mute'

      broadcast(hostname, vol)
    }

    slider.addEventListener('input', () => {
      const vol = Number(slider.value) / 100
      updateVolume(vol)
      volumes[hostname] = vol
      saveVolumes(volumes)
      // Remember the last audible level so unmute restores it, even when the
      // user reaches 0 by dragging the slider rather than clicking mute.
      if (vol > 0) {
        preMute[hostname] = vol
        savePreMute(preMute)
      }
    })

    muteBtn.addEventListener('click', () => {
      const current = Number(slider.value) / 100
      if (current === 0) {
        const restore = preMute[hostname] !== undefined ? preMute[hostname] : 1
        updateVolume(restore)
        volumes[hostname] = restore
        saveVolumes(volumes)
      } else {
        preMute[hostname] = current
        savePreMute(preMute)
        updateVolume(0)
        volumes[hostname] = 0
        saveVolumes(volumes)
      }
    })

    control.appendChild(muteBtn)
    control.appendChild(slider)
    control.appendChild(label)

    item.appendChild(icon)
    item.appendChild(info)
    item.appendChild(control)

    tabList.appendChild(item)

    if (tab.audible) {
      item.style.borderLeftColor = '#00a048'
    } else {
      probes.push(
        browser.tabs.sendMessage(tab.id, { type: 'getMediaInfo' }).then(response => {
          if (response && response.hasAudio) {
            item.style.borderLeftColor = '#0060df'
            return true
          }
          return false
        }).catch(() => false)
      )
    }
  }

  const anyAudio = await Promise.all(probes).then(results => results.some(Boolean))

  if (!anyAudio && !validTabs.some(t => t.audible)) {
    status.textContent = 'No audio detected in open tabs'
  }
})
