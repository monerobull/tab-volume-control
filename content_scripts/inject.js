const script = document.createElement('script')
script.textContent = `
(function() {
  // The extension is a *multiplier* on top of whatever volume the site itself
  // sets, so a site's own volume slider (e.g. YouTube) keeps working:
  //   output volume = siteVolume * TVC_FACTOR
  var TVC_FACTOR = 1
  // Inactive until an explicit setting arrives, so we never alter a site that
  // the user hasn't configured.
  var TVC_ACTIVE = false
  var gains = []

  function clamp(v) {
    v = Number(v)
    if (isNaN(v)) return 0
    return v < 0 ? 0 : v > 1 ? 1 : v
  }

  var desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume')
  var origGet = desc.get
  var origSet = desc.set

  // The site's intended (unscaled) volume for an element. Lazily initialised
  // from the real volume the first time we need it, which — by the
  // intended-before-scale invariant — is always still the site's own value.
  function getIntended(el) {
    if (el.__tvcIntended === undefined) {
      el.__tvcIntended = origGet.call(el)
    }
    return el.__tvcIntended
  }

  // Re-assert the scaled volume on a plain element. Web Audio elements are
  // handled by their gain node instead, so they are skipped here.
  function reapply(el) {
    if (el.__tvcWebAudio) return
    origSet.call(el, clamp(getIntended(el) * TVC_FACTOR))
  }

  Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
    get: function() {
      if (this.__tvcWebAudio) return origGet.call(this)
      return getIntended(this)
    },
    set: function(v) {
      if (this.__tvcWebAudio) { origSet.call(this, v); return }
      this.__tvcIntended = Number(v)
      origSet.call(this, TVC_ACTIVE ? clamp(this.__tvcIntended * TVC_FACTOR) : Number(v))
    },
    configurable: true,
    enumerable: desc.enumerable
  })

  function setAllGains(vol) {
    for (var i = 0; i < gains.length; i++) {
      gains[i].gain.value = vol
    }
  }

  function applyAll() {
    if (!TVC_ACTIVE) return
    document.querySelectorAll('audio, video').forEach(reapply)
  }

  window.addEventListener('message', function(e) {
    if (e.source !== window || !e.data) return
    if (e.data.type === '__TVC_SET_VOLUME__') {
      TVC_FACTOR = e.data.volume
      TVC_ACTIVE = true
      setAllGains(TVC_FACTOR)
      applyAll()
    }
  })

  var OrigAudioContext = window.AudioContext || window.webkitAudioContext
  if (OrigAudioContext) {
    // When an element is routed into a Web Audio graph, hand the graph the
    // site's *unscaled* intended volume and let the gain node apply the
    // factor — otherwise the factor would be applied twice.
    var origCreateSource = OrigAudioContext.prototype.createMediaElementSource
    if (origCreateSource) {
      OrigAudioContext.prototype.createMediaElementSource = function(el) {
        if (el) {
          var intended = getIntended(el)
          el.__tvcWebAudio = true
          try { origSet.call(el, intended) } catch (err) {}
        }
        return origCreateSource.apply(this, arguments)
      }
    }

    window.AudioContext = function() {
      // Forward any constructor options (e.g. { sampleRate, latencyHint }).
      var ctx = Reflect.construct(OrigAudioContext, arguments)
      var gain = ctx.createGain()
      gain.gain.value = TVC_ACTIVE ? TVC_FACTOR : 1
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
    reapply(this)
    return origPlay.apply(this, arguments)
  }

  if (document.readyState !== 'loading') {
    applyAll()
  } else {
    document.addEventListener('DOMContentLoaded', applyAll)
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
            reapply(els[k])
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
