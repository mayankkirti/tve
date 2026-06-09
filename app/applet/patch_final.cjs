const fs = require('fs');
let code = fs.readFileSync('src/server/renderer.ts', 'utf8');

const target1 = `filterComplex += \`\${streamName}format=yuva420p,fade=t=in:st=\${seg.start}:d=1:alpha=1,fade=t=out:st=\${seg.end - 1}:d=1:alpha=1[faded\${sid}];\`;`;
const rep1 = `filterComplex += \`\${streamName}format=yuva420p,fade=t=in:st=\${seg.start}:d=1:alpha=1[faded\${sid}];\`;`;

const target2 = `filterComplex += \`\${prevBgOut}[faded\${sid}]overlay=enable='between(t,\${seg.start},\${seg.end})'\${nextOut};\`;`;
const rep2 = `filterComplex += \`\${prevBgOut}[faded\${sid}]overlay=enable='between(t,\${seg.start},\${seg.end + 1})'\${nextOut};\`;`;

const target3 = `        filterComplex += \`\${finalBgOut}colorchannelmixer=rr=\${1 - opacity / 100}:gg=\\$\{1 - opacity / 100}:bb=\\$\{1 - opacity / 100}[bgdark];\`;`;
const rep3 = `        filterComplex += \`color=c=black@\${Math.round((opacity/100)*100)/100}:s=\${config.width}x\${config.height},format=yuva420p[black_overlay];\`;\n        filterComplex += \`\${finalBgOut}[black_overlay]overlay=format=auto[bgdark];\`;`;

code = code.replace(target1, rep1);
code = code.replace(target2, rep2);
code = code.replace(target3, rep3);

fs.writeFileSync('src/server/renderer.ts', code);
console.log('Done!');
