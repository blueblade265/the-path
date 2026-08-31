# Icons needed here

Referenced by `../manifest.json` and `../index.html`'s `apple-touch-icon` link — nothing
renders an icon until these three files actually exist at these exact paths:

- `icon-192.png` — 192×192, PNG. Used for the home-screen icon on Android and (via the
  `apple-touch-icon` link tag in index.html) on iOS.
- `icon-512.png` — 512×512, PNG. Used for splash screens and higher-res launcher contexts.
- `icon-maskable-512.png` — 512×512, PNG, **maskable**: Android can crop this into a
  circle/squircle/rounded-square depending on the device's icon shape, so keep the actual
  logo content within the center ~80% "safe zone" — anything near the edges may get cut
  off. `icon-512.png` above should NOT have this safe-zone padding (it's shown as-is,
  never cropped); this maskable version is a separate export, not a reused file.

Background should be the app's near-black (`#0d0e0a`, matching `theme_color` in
`manifest.json`) unless the icon art itself is meant to bleed to the edge.
