const fs = require('fs');
let code = fs.readFileSync('src/server/renderer.ts', 'utf8');

const s1 = 'filterComplex += `${streamName}format=yuva420p,fade=t=in:st=${seg.start}:d=1:alpha=1,fade=t=out:st=${seg.end - 1}:d=1:alpha=1[faded${sid}];`;';
const r1 = 'filterComplex += `${streamName}format=yuva420p,fade=t=in:st=${seg.start}:d=1:alpha=1[faded${sid}];`;';

const s2 = "filterComplex += `${prevBgOut}[faded${sid}]overlay=enable='between(t,${seg.start},${seg.end})'${nextOut};`;";
const r2 = "filterComplex += `${prevBgOut}[faded${sid}]overlay=enable='between(t,${seg.start},${seg.end + 1})'${nextOut};`;";

const s3 = 'const opacity = config.overlayOpacity !== undefined ? config.overlayOpacity : 50;\n      if (opacity > 0) {\n        filterComplex += `${finalBgOut}colorchannelmixer=rr=${1 - opacity / 100}:gg=${1 - opacity / 100}:bb=${1 - opacity / 100}[bgdark];`;\n        finalBgOut = "[bgdark]";\n      }';
const r3 = 'const opacity = config.overlayOpacity !== undefined ? config.overlayOpacity : 50;\n      if (opacity > 0) {\n        filterComplex += `color=c=black@${opacity / 100}:s=${config.width}x${config.height},format=yuva420p[black_overlay];`;\n        filterComplex += `${finalBgOut}[black_overlay]overlay=format=auto[bgdark];`;\n        finalBgOut = "[bgdark]";\n      }';

code = code.replace(s1, r1);
code = code.replace(s2, r2);
code = code.replace(s3, r3);

fs.writeFileSync('src/server/renderer.ts', code);
console.log('patched successfully');
