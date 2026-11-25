# Coords HUD

A Minecraft-style readout in a corner of your view:

```
XYZ: 12.345 / 1.000 / -4.200
Facing: North-East (+X +Z)
```

- **XYZ** is where you stand: X and Z under your head, Y at your feet (the bottom of your own body, so it's right
  when you jump, fly or sit).
- **Facing** is which way your head points round the vertical (looking up or down doesn't change it). The compass
  name is in 45 degree steps. The axes are one axis (`+X`) when you look along it, give or take 22.5 degrees, and two
  (`+X +Z`) on the diagonals between.
- Only you see your HUD. It's attached to your head, not synced.
- On a desktop it sits in a corner of the window. In VR, where a headset has no window edges, it sits a set distance
  from the middle of your view (`vr-edge`). Each has its own corner, as Fire-V-Player's controls do.

## Add it to a world

Hosted at <https://coords-hud.firer.at>: `snippet.js` with the kit bundles in `bundles/<platform>/coordshud` next to it.
Paste `snippet.html` into `Assets/WebRoot/index.html` between the snippet section comments.
Every setting is optional; see the top of `snippet.js` for what each one does.

## Build the kit

In Unity: **Tools > Coords HUD > Build Bundles** builds `Builds/CoordsHud/<platform>/coordshud` (windows, android,
linux, osx). Bump `BUNDLE_VERSION` in `snippet.js` whenever you rebuild, since the app caches bundles by URL.
The builder is `Assets/CoordsHud/Editor/CoordsHudBuilder.cs`.

## Notes

- Desktop corner: the HUD takes the window's corner from the camera when the app puts it under the camera. If it
  doesn't, it uses the corner Fire-V-Player's desktop controls use. If it sits wrong in your window, set
  `desktop-edge="x y"` (metres at 50 cm, from the middle of the view to the HUD's outer edges).
- It's drawn 50 cm in front of your eyes, so a wall closer than that hides it.
