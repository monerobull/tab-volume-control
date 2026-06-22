const script = document.createElement('script')
script.textContent = `
(function() {
  var TVC_VOLUME = 1
  // Inactive until an explicit setting arrives. While inactive we must not
  // touch any element's volume, otherwise we clobber the site's own defaults.
  var TVC_ACTIVE = false
  var gains = []

  function setAllGains(vol) {
    for (var i = 0; i < gains.length; i++) {
      gains[i].gain.value = vol
    }
  }

  function applyVolume() {
    if (!TVC_ACTIVE) return
    document.querySelectorAll('audio, video').forEach(function(el) {
      // Elements routed through Web Audio are handled by the gain node;
      // setting .volume here too would attenuate twice.
      if (el.__tvcWebAudio) return
      el.volume = TVC_VOLUME
    })
  }

  window.addEventListener('message', function(e) {
    if (e.source !== window || !e.data) return
    if (e.data.type === '__TVC_SET_VOLUME__') {
      TVC_VOLUME = e.data.volume
      TVC_ACTIVE = true
      setAllGains(TVC_VOLUME)
      applyVolume()
    }
  })

  var OrigAudioContext = window.AudioContext || window.webkitAudioContext
  if (OrigAudioContext) {
    // Tag elements that get routed through Web Audio so the element-volume
    // path skips them, and clear any leftover .volume a prior play() set.
    var origCreateSource = OrigAudioContext.prototype.createMediaElementSource
    if (origCreateSource) {
      OrigAudioContext.prototype.createMediaElementSource = function(el) {
        if (el) {
          el.__tvcWebAudio = true
          try { el.volume = 1 } catch (err) {}
        }
        return origCreateSource.apply(this, arguments)
      }
    }

    window.AudioContext = function() {
      // Forward any constructor options (e.g. { sampleRate, latencyHint }).
      var ctx = Reflect.construct(OrigAudioContext, arguments)
      var gain = ctx.createGain()
      gain.gain.value = TVC_ACTIVE ? TVC_VOLUME : 1
      gain.connect(ctx.destination)
      Object.defineProperty(ctx, 'destination', {
        get: function() { return gain },
        configurable: true
      })
      gains.push(gain)
      return ctx
    }
    window.AudioContext.prototype = OrigAudioContext.prototype

    if (window.webkitAudioContext) {
      window.webkitAudioContext = window.AudioContext
    }
  }

  var origPlay = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function() {
    if (TVC_ACTIVE && !this.__tvcWebAudio) {
      this.volume = TVC_VOLUME
    }
    return origPlay.apply(this, arguments)
  }

  if (document.readyState !== 'loading') {
    applyVolume()
  } else {
    document.addEventListener('DOMContentLoaded', applyVolume)
  }

  var observer = new MutationObserver(function(mutations) {
    if (!TVC_ACTIVE) return
    for (var i = 0; i < mutations.length; i++) {
      for (var j = 0; j < mutations[i].addedNodes.length; j++) {
        var node = mutations[i].addedNodes[j]
        if (node.nodeType === 1) {
          var els = node.matches && (node.matches('audio') || node.matches('video'))
            ? [node]
            : node.querySelectorAll ? node.querySelectorAll('audio, video') : []
          for (var k = 0; k < els.length; k++) {
            if (!els[k].__tvcWebAudio) {
              els[k].volume = TVC_VOLUME
            }
          }
        }
      }
    }
  })

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true })
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      observer.observe(document.body, { childList: true, subtree: true })
    })
  }
})()
`
document.documentElement.appendChild(script)
script.remove()
