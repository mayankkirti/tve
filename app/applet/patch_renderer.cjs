const fs = require('fs');
let code = fs.readFileSync('src/server/renderer.ts', 'utf8');

const target = "filterComplex += `${prevBgOut}[scaled_bg${seg.bgIndex}]overlay=enable='between(t,${seg.start},${seg.end})'${nextOut};`;";

const overlayReplacement = `
        const isFade = config.bgMediaStyle === 'random-crossfade' || config.bgMediaStyle === 'soft-crossfade' || (config.bgMediaStyle === 'mix-cuts' && (seg.end - seg.start) > 4);
        if (isFade) {
           filterComplex += \`[scaled_bg\${seg.bgIndex}]format=yuva420p,fade=t=in:st=\${seg.start}:d=1:alpha=1,fade=t=out:st=\${seg.end-1}:d=1:alpha=1[faded\${sid}];\`;
           filterComplex += \`\${prevBgOut}[faded\${sid}]overlay=enable='between(t,\${seg.start},\${seg.end})'\${nextOut};\`;
        } else {
           filterComplex += \`\${prevBgOut}[scaled_bg\${seg.bgIndex}]overlay=enable='between(t,\${seg.start},\${seg.end})'\${nextOut};\`;
        }`;

code = code.replace(target, overlayReplacement);

// also let's implement bypassOverlays and overlayEffect
// currently we have: filterComplex += `[0:a]${vizFilter}[viz];`;
// we can append noise filter for film grain

const vizTarget = "filterComplex += `[0:a]${vizFilter}[viz];`;";
const vizRepl = `filterComplex += \`[0:a]\${vizFilter}[viz];\`;
    if (!config.bypassOverlays && config.overlayEffect && config.overlayEffect !== 'None') {
        // generic noise/glitch for now
        filterComplex += \`color=c=black:s=\${config.width}x\${config.height}:r=\${config.fps},noise=alls=20:allf=t+u[noise];\`;
        let darkOut = '[bg]';
        if (config.overlayOpacity !== undefined) {
             let currentAlpha = config.overlayOpacity / 100;
             filterComplex += \`\${finalBgOut}colorchannelmixer=rr=\${1-currentAlpha}:gg=\${1-currentAlpha}:bb=\${1-currentAlpha}[bgdarkx];\`;
             darkOut = '[bgdarkx]';
        }
        filterComplex += \`\${darkOut}[noise]blend=all_mode=screen:all_opacity=0.15[bgdark];\`;
        finalBgOut = '[bgdark]';
    }`;

code = code.replace(vizTarget, vizRepl);

fs.writeFileSync('src/server/renderer.ts', code);
console.log("Done");
