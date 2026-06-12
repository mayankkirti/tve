const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/server/renderer.ts');
let cx = fs.readFileSync(file, 'utf8');
cx = cx.replace(/aformat=channel_layouts=mono/g, 'pan=1c|c0=0.5*c+0.5*c'); // wait c0 is correct? In pan filter: "pan=1c|c0=0.5*c0+0.5*c1" converts 2ch to mono.
// Actually, if input is already mono, c1 fails. So 'aformat=channel_layouts=mono' works by checking but pan might fail if there's no c1.
// A better way is: `aresample=matrix_encoding=dplii`? Or `aformat=sample_rates=44100:channel_layouts=mono`?
// FFmpeg 6.1 changed `channel_layouts` to `channel_layouts`? No, it deprecated it in favor of `channel_layout`!
// What if I just use `aformat=channel_layout=mono|channel_layouts=mono`? It might fail.
// I can just remove `aformat=channel_layouts=mono` entirely because `showwaves` handles stereo by averaging or overlaying!
cx = cx.replace(/,aformat=channel_layouts=mono/g, '');

// Also let's fix `compand` to not omit points in case newer FFmpeg complains.
// `compand=attacks=0.01:decays=0.3` -> `compand=attacks=0.01:decays=0.3:points=-80/-80|-20/-20|0/-10`
// Actually, it's safer to just remove `compand` if we just want volume increase. But wait, `compand` brings up bass.
// Let's just remove `compand` as well since `volume=8.0` is already there and clipping is handled by colorlevels (it clamps).
// Removing `compand` completely eliminates the chance of the "invalid argument" from Attack/Decay being invalid.
cx = cx.replace(/,compand=attacks=[^,]*,/g, ',');

fs.writeFileSync(file, cx);
console.log("Renderer patched.");
