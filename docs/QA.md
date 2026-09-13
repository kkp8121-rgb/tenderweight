# TENDERWEIGHT verification

Fresh checks on 2026-09-13, Windows, headless Chromium only. No visible browser was opened. Play at https://kkp8121-rgb.github.io/tenderweight/. Publication evidence for each revision is generated separately in ignored `artifacts/improvement-publication.json` after checking the deployed commit and asset hashes.

## Full play

`node tests/campaign.cjs --hardware` completed all three standard voyages with actual keyboard construction, launch, ballast and transition inputs. Inspection supplied copied state only; no live state setter or state injection was used. The controller computed decisions from the copied physics state and sent ordinary keydown/keyup events.

| Voyage | Rescued | Storm seconds | Peak water | Peak tilt | Grade |
|---|---:|---:|---:|---:|---|
| 작은 무게부터 | 10 | 75 | 0% | .07713 rad | S |
| 서로 다른 방향 | 18 | 125 | 0% | .10260 rad | S |
| 모두를 위한 항구 | 24 | 140 | 12.00% | .31825 rad | A |

All eight storm transitions, 52 residents, final ending, three saved standard records and reload persistence passed. The full campaign's build SHA-256 was `d8a229723edace98448e427907e988831c751a7b425fd536bcc6f5671e841343`. Subsequent changes corrected menus/audio, mobile layout, camera/gantry geometry, resident visual height and explanatory UI; the physics and authored voyages did not change. The final build passed the browser and interaction checks below. The full campaign is not claimed to have run on the later final bundle.

A separate pure-engine trial using only tilt and angular velocity, reacting every .25 seconds in fine mode, also survived all three voyages with S/S/A results. This is simulation evidence, not additional browser campaign evidence.

## Final checks

- `npm test`: 11/11, covering capacity, full refunds without repeat refunds, unique structure IDs after removal/replacement, resident assignments, fixed-step/diagonal input, stage rewards, victory/failure, gentle mode, cabin roof/floor clearance, all-cell gantry clearance and independent occupancy materials.
- `npm run test:browser`: direct `file://` and `/tenderweight/` HTTP subpath; actual keyboard placement/removal, tank movement, copy-only inspection, paused time, pause→guide→back audio remaining suspended, explicit resume, audible sound and mute. No page errors, console errors, failed requests or HTTP errors. Only relative local runtime assets were requested.
- `npm run test:interaction`: ray-picked mouse placement/right-click removal; actual wrong-corner ballast input caused flooding at 13.4833 seconds; Enter retry reset to preparation. Pause→selection→Escape returned to the title.
- Real touch at 390×844 and 844×390: every visible play button was at least 44×44, inside the viewport and hit-tested at its center. Short taps moved one build cell; touch placement/removal/launch and two simultaneous directional touches passed. Releasing both fingers stopped the tank.
- Isolated saved-record fixture checked a later voyage's insufficient-capacity rejection and visible reason, then legal shelter construction and launch. This fixture is not full-play evidence.
- Malformed numeric records were rejected; saved zero volume and gentle mode were preserved; absent AudioContext allowed play. WebGL-unavailable error banner was screenshot- and hit-test-verified above the title UI.
- Visual inspection covered title, keyboard construction, actual storms, both mobile orientations, defeat, ending, hardware shadows and the visible fallback banner.

## Rendering and audio

Sequential performance runs sampled the opening storm, after a two-second warm-up, for six seconds. These short tests are not a claim about every scene on every device.

| Renderer | Pixel count | CPU throttle | Mean frame | p95 |
|---|---:|---:|---:|---:|
| SwiftShader | 400,000 | 1× | 16.666 ms | 16.7 ms |
| SwiftShader | 400,000 | 4× | 24.705 ms | 33.4 ms |
| RTX 3060 Ti, ANGLE D3D11 | 1,296,000 | 1× | 16.666 ms | 16.7 ms |

The earlier full hardware campaign measured 20,436 play frames at 16.681 ms mean / 16.7 ms p95, including the final 24-resident village. Functional browser tests ran concurrently and their frame averages are not used as performance claims.

Final file/subpath audio peaks were .00907/.01937 with mute measured at zero. The full campaign peak was .05662. Pause suspended the audio context. No clipping was measured.

## Package and deployment

`npm run pack` and `npm run test:package` passed. `dist/tenderweight-web.zip` is 543,095 bytes with seven entries. Every entry's SHA-256 matches its release source. Paths use portable forward slashes. The game bundle is 594,235 bytes, SHA-256 `789ff81b4415401e0b913036dec16de83bb5b9f801ab596ffc023f7a2f20cbb1`.

Runtime: classic IIFE, bundled Three.js, procedural audio, relative CSS/art/favicon, no CDN or runtime npm dependencies. Original PNG, source, tools and tests are retained in Git but excluded from the itch.io ZIP. Node modules, reports, local usage helper and ZIP are ignored.

For deployment verification, use main/root GitHub Pages and rerun browser checks with `TENDER_URL` set to the real published URL. Check the actual deployment rather than treating a configured URL as success.

## Placement feedback regression — 2026-09-13

Headless touch-enabled focused input used a safe pointer-lock rejection shim. An actual occupied starter cell and an actual zero-budget cell each displayed a distinct rejection message; structure count and budget were unchanged after both attempts. Evidence: `artifacts/qa-tender-probe.json` and `artifacts/qa-after-budget-feedback.png`. The existing interaction pass also covered both 390×844 and 844×390 layouts.

`artifacts/touch-build-390.png` is a historical baseline, not a fresh before capture.
