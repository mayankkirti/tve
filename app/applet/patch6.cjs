const fs = require('fs');
let code = fs.readFileSync('src/server/renderer.ts', 'utf8');

const s1 = 'filterComplex += `\\${streamName}format=yuva420p,fade=t=in:st=\\${seg.start}:d=1:alpha=1,fade=t=out:st=\\${seg.end - 1}:d=1:alpha=1[faded\\${sid}];`;';
const r1 = 'filterComplex += `\\${streamName}format=yuva420p,fade=t=in:st=\\${seg.start}:d=1:alpha=1[faded\\${sid}];`;';

const s2 = 'filterComplex += `\\${prevBgOut}[faded\\${sid}]overlay=enable=\\\'between(t,\\${seg.start},\\${seg.end})\\\'\\${nextOut};`;';
const r2 = 'filterComplex += `\\${prevBgOut}[faded\\${sid}]overlay=enable=\\\'between(t,\\${seg.start},\\${seg.end + 1})\\\'\\${nextOut};`;';

code = code.replace(s1, r1);
code = code.replace(s2, r2);

// Now for the black overlay issue. The user says: 
// "put the black overlay in background over the image so that rest of the things like visualizer, text and logo should be highlighted"
// We are currently doing `colorchannelmixer` which multiplies by (1 - opacity/100).
// Is that correct? Yes, it reduces brightness, effectively putting a black overlay.
// Why did the user complain? Wait, maybe `colorchannelmixer` didn't work for video backgrounds?
// Or maybe they saw it missing on their side?
// Actually, `filterComplex += \`color=c=black:s=\\${config.width}x\\${config.height}:r=\\${config.fps}[base];\`;` is what we start with, and we overlay the image on it.
// If we just use `blend` or `overlay` with a black rectangle, it's the exact same result visually.
// Let's implement it as overlaying a semi-transparent black rectangle OVER the final background `[bg]`, instead of doing `colorchannelmixer` which is limited.
// Let's replace the Black Overlay section.

const blackOverlaySearch = `    // Black Overlay
    if (config.enableBlackOverlay !== false) {
      const opacity = config.overlayOpacity !== undefined ? config.overlayOpacity : 50;
      if (opacity > 0) {
        filterComplex += \\\`\\${finalBgOut}colorchannelmixer=rr=\\${1 - opacity / 100}:gg=\\${1 - opacity / 100}:bb=\\${1 - opacity / 100}[bgdark];\\\`;
        finalBgOut = "[bgdark]";
      }
    }`;

const blackOverlayReplace = `    // Black Overlay
    if (config.enableBlackOverlay !== false) {
      const opacity = config.overlayOpacity !== undefined ? config.overlayOpacity : 50;
      if (opacity > 0) {
        filterComplex += \\\`color=c=black@\\${opacity / 100}:s=\\${config.width}x\\${config.height}[black_overlay];\\\`;
        filterComplex += \\\`\\${finalBgOut}[black_overlay]overlay=format=auto[bgdark];\\\`;
        finalBgOut = "[bgdark]";
      }
    }`;

code = code.replace(blackOverlaySearch, blackOverlayReplace);

fs.writeFileSync('src/server/renderer.ts', code);
console.log('patched');
