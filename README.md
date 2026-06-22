# Tab Volume Control

A lightweight Firefox extension to set the audio volume of individual websites. Volumes are remembered per site (by hostname) and re-applied automatically on future visits.

## Features

- Per-site volume control from 0–100%, saved automatically
- Mute / unmute with one click (restores your previous level)
- Works with both plain `<audio>`/`<video>` elements and sites that use the Web Audio API
- Acts as a multiplier on top of the site's own volume control, so a site's
  built-in slider (e.g. YouTube's) keeps working alongside it
- Embedded cross-origin players (e.g. iframes) inherit the parent page's setting
- Visual indicator for tabs that are currently producing audio
- Leaves a site's audio untouched until you actually set a volume for it

## Install (temporary, for development)

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on…**.
3. Select the `manifest.json` file in this repository.

The add-on stays loaded until Firefox is restarted.

## Usage

Click the toolbar icon to open the popup. It lists the open tabs in the current
window that support volume control. Drag a slider to set that site's volume, or
click the speaker icon to mute/unmute. Changes apply immediately to every open
tab of the same site and are remembered for next time.

## How it works

- A content script injects a small page-context script (`content_scripts/inject.js`)
  that hooks `HTMLMediaElement` and the Web Audio API. It intercepts the
  element's `volume` property so the chosen level is applied as a multiplier
  (`output = siteVolume × extensionVolume`), letting a site's own volume control
  keep functioning, and uses a Web Audio gain node for sites that route audio
  through the Web Audio API.
- A background script (`background.js`) resolves the requesting frame's
  **top-level** host, so cross-origin iframes get the volume set for the page
  they're embedded in.
- Settings are stored with `browser.storage.local`, keyed by hostname.

## Permissions

- `tabs` — list open tabs and their titles/favicons in the popup
- `storage` — remember per-site volume settings
- `<all_urls>` — apply volume on any site you visit

## Notes

Volume is capped at 100%. Boosting above 100% would require routing all media
through a custom Web Audio gain node, which silently mutes cross-origin media
that lacks CORS headers — so it is intentionally not implemented.

## License

MIT
