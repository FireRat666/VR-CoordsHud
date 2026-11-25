// Coords HUD as a SideQuest/Altspace Creator SDK snippet.
//
//   <bs-snippet name="coords" title="Coords HUD" single="true" script="https://coords-hud.firer.at/snippet.js"></bs-snippet>
//
// A Minecraft-style readout in a corner of your view: where you're standing (your feet, X Y Z) and which way you're
// facing (North-East (+X +Z) and so on). Only you see yours.
//
// JavaScript can't follow your head every frame, but Visual Scripting can, so this script loads a small kit (an asset
// bundle with a Visual Scripting graph that does the HUD). When the kit starts its graph calls
// window.coordsHudReady(key), and this script answers with the settings.
//
// Bundles: bundles/windows, bundles/android, bundles/linux (and bundles/osx if built) next to this file.
//
// Settings (attributes on the element, all optional; an empty one uses the default):
//   corner              Both corners at once: top-left, top-right, bottom-left, bottom-right.   Default none
//   desktop-corner      The corner on a desktop.                                                 Default top-left
//   vr-corner           The corner in VR.                                                        Default bottom-left
//   decimals            Digits after the point: 0 for whole numbers, up to 6.                    Default 3
//   text-color          "#rrggbb" (or "#rgb", "#rrggbbaa").                                      Default #ffffff
//   text-opacity        0 to 1.                                                                  Default 1
//   background-color    The backdrop's colour.                                                   Default #000000
//   background-opacity  0 (no backdrop) to 1 (solid).                                            Default 0.5
//   scale               Size of the HUD.                                                         Default 1
//   vr-scale            Extra size in VR, on top of scale.                                       Default 1.25
//   north               Which world axis is North: +z, -z, +x or -x. East is 90 degrees clockwise
//                       from it, seen from above (+z North: East is +x).                         Default +z
//   angle               "true": also the compass heading in degrees.                             Default false
//   refresh             Seconds between updates.                                                 Default 0.1
//   vr-edge             VR: "x y", how far the HUD's outer edges are from the middle of your view,
//                       in metres at 50 cm away.                                                 Default 0.2 0.15
//   desktop-edge        Desktop: the same, or "auto" for the window's corner.                    Default auto
//   margin              Desktop, with auto: gap to the window's edges, metres at 50 cm.          Default 0.012
//   show-vr             "false": no HUD in VR.                                                   Default true
//   show-desktop        "false": no HUD on a desktop.                                            Default true
//   toggle-key          A key that shows and hides it on a desktop (a BS.KeyCode name: F3, H, ...), or
//                       "none".                                                                  Default F3
//   hidden              "true": start hidden (the toggle key shows it).                         Default false
//   bundle-base         Folder URL of the kit bundles.                      Default bundles/ next to this file
(() => {
  const SNIPPET_NAME = 'coords';
  const BUNDLE_FILE = 'coordshud';
  // The app caches kit bundles by URL, so bump this whenever the bundles are rebuilt.
  const BUNDLE_VERSION = '1';
  const SET_ID = 'coords-hud-set';
  const LOG = 'Coords HUD (snippet)';

  const CORNERS = {
    'top-left': [-1, 1], 'top-right': [1, 1], 'bottom-left': [-1, -1], 'bottom-right': [1, -1],
  };
  const NORTH = { '+z': 0, '+x': 90, '-z': 180, '-x': 270 };

  const thisScript = document.currentScript;
  const started = new WeakSet();
  const huds = new Map(); // key -> { vars, toggleKey }
  let count = 0;

  const bundleUrls = (el) => {
    const scriptUrl = el.getAttribute('script') || (thisScript && thisScript.src) || location.href;
    const custom = (el.getAttribute('bundle-base') || '').trim();
    const base = new URL(custom || 'bundles/', new URL(scriptUrl, location.href));
    if (!base.pathname.endsWith('/')) base.pathname += '/';
    const url = (platform) => new URL(`${platform}/${BUNDLE_FILE}?v=${BUNDLE_VERSION}`, base).href;
    return { windowsUrl: url('windows'), androidUrl: url('android'), linuxUrl: url('linux'), osxUrl: url('osx'), isScene: false };
  };

  // "#rgb", "#rrggbb" or "#rrggbbaa" -> [r, g, b, a] (0..1), or null.
  const parseColor = (text) => {
    let hex = String(text || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(hex)) hex = hex.split('').map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return null;
    const n = (i) => parseInt(hex.slice(i, i + 2), 16) / 255;
    return [n(0), n(2), n(4), hex.length === 8 ? n(6) : null];
  };

  const readSettings = (el) => {
    const attr = (name) => (el.getAttribute(name) || '').trim();
    const num = (name, fallback, min = -Infinity, max = Infinity) => {
      const n = parseFloat(attr(name));
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    };
    const flag = (name, fallback) => {
      const v = attr(name).toLowerCase();
      return v === '' ? fallback : v === 'true';
    };
    const corner = (name, fallback) => {
      const v = attr(name).toLowerCase();
      if (v && !CORNERS[v]) console.warn(`${LOG}: ${name}="${v}" isn't top-left, top-right, bottom-left or bottom-right`);
      return CORNERS[v] || fallback;
    };
    const pair = (name) => {
      const parts = attr(name).split(/[\s,]+/).map(parseFloat);
      return parts.length === 2 && parts.every((p) => Number.isFinite(p) && p > 0) ? parts : null;
    };
    const color = (name, opacityName, fallback, fallbackAlpha) => {
      const c = parseColor(attr(name));
      if (attr(name) && !c) console.warn(`${LOG}: ${name}="${attr(name)}" isn't a colour like #ff8800`);
      const [r, g, b, a] = c || fallback;
      const alpha = num(opacityName, a !== null ? a : fallbackAlpha, 0, 1);
      return [r, g, b, alpha];
    };

    const both = corner('corner', null);
    const desk = corner('desktop-corner', both || CORNERS['top-left']);
    const vr = corner('vr-corner', both || CORNERS['bottom-left']);
    const text = color('text-color', 'text-opacity', [1, 1, 1, null], 1);
    const bg = color('background-color', 'background-opacity', [0, 0, 0, null], 0.5);
    const north = attr('north').toLowerCase();
    if (north && NORTH[north] === undefined) console.warn(`${LOG}: north="${north}" isn't +z, -z, +x or -x`);
    const vrEdge = pair('vr-edge') || [0.2, 0.15];
    const deskEdge = /^auto$|^$/i.test(attr('desktop-edge')) ? [0, 0] : (pair('desktop-edge') || [0, 0]);

    const vars = {
      Decimals: Math.round(num('decimals', 3, 0, 6)),
      DeskCornerX: desk[0], DeskCornerY: desk[1],
      VrCornerX: vr[0], VrCornerY: vr[1],
      Scale: num('scale', 1, 0.05, 20),
      VrScale: num('vr-scale', 1.25, 0.05, 20),
      TextR: text[0], TextG: text[1], TextB: text[2], TextA: text[3],
      BgR: bg[0], BgG: bg[1], BgB: bg[2], BgA: bg[3],
      NorthYaw: NORTH[north] !== undefined ? NORTH[north] : 0,
      ShowAngle: flag('angle', false) ? 1 : 0,
      Refresh: num('refresh', 0.1, 0, 10),
      VrEdgeX: vrEdge[0], VrEdgeY: vrEdge[1],
      DeskEdgeX: deskEdge[0], DeskEdgeY: deskEdge[1],
      Margin: num('margin', 0.012, 0, 1),
      ShowVR: flag('show-vr', true) ? 1 : 0,
      ShowDesktop: flag('show-desktop', true) ? 1 : 0,
      Visible: flag('hidden', false) ? 0 : 1,
    };
    const keyName = attr('toggle-key') || 'F3';
    const toggleKey = /^(none|false|off)$/i.test(keyName) ? null : BS.KeyCode[keyName];
    if (toggleKey === undefined) console.warn(`${LOG}: toggle-key="${keyName}" isn't a BS.KeyCode name`);
    return { vars, toggleKey: toggleKey === undefined ? null : toggleKey };
  };

  const sendVar = (key, name, value) =>
    BS.Scene.GetInstance().SendToVisualScripting(SET_ID, `${key}|${name}=${value}`);

  const send = async (key) => {
    const hud = huds.get(key);
    if (!hud) return;
    for (const [name, value] of Object.entries(hud.vars)) await sendVar(key, name, value);
  };

  // Called by the kit's graph when it has started, so the settings arrive once it's listening.
  window.coordsHudReady = (key) => {
    send(String(key)).catch((e) => console.warn(`${LOG}: sending settings failed`, e));
    return true;
  };

  const start = async (el) => {
    if (started.has(el)) return;
    started.add(el);
    const key = `coords-${(el.getAttribute('instance') || '').trim() || ++count}`;
    huds.set(key, readSettings(el));
    try {
      const obj = new BS.GameObject({ name: key });
      await obj.Async();
      await obj.AddComponent(new BS.AssetBundle(bundleUrls(el)));
      // "*" = the first prefab in the AssetBundle on this same object.
      await obj.AddComponent(new BS.KitItem({ path: '*' }));
      console.log(`${LOG}: loading ${key} (bundle v${BUNDLE_VERSION})`);
    } catch (e) {
      console.error(`${LOG}: failed to start ${key}`, e);
    }
  };

  const scan = () => document.querySelectorAll(`bs-snippet[name="${SNIPPET_NAME}"]`).forEach(start);

  window.addEventListener('bs-loaded', () => {
    const scene = BS.Scene.GetInstance();
    // The toggle key shows and hides the HUD (desktop players have a keyboard; VR players see it as set).
    scene.On('key-press', (e) => {
      const pressed = e.detail && e.detail.key;
      for (const [key, hud] of huds) {
        if (hud.toggleKey === null || pressed !== hud.toggleKey) continue;
        hud.vars.Visible = hud.vars.Visible ? 0 : 1;
        sendVar(key, 'Visible', hud.vars.Visible).catch(() => {});
      }
    });
    scan();
    // Placements added later, e.g. with document.createElement('bs-snippet').
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  });
})();
