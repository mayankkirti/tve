const fs = require('fs');

let content = fs.readFileSync('src/server/renderer.ts', 'utf-8');

const target = `      case "indian-ambient":
        vizFilter = \`showfreqs=s=\${config.width}x\${config.height}:mode=bar:ascale=log:fscale=log:colors=orange\`;
        break;`;
const replace = `      case "indian-ambient":
        // Lightweight golden horizontal waveform (like a party flash but horizontal)
        vizFilter = \`showwaves=s=\${config.width}x\${Math.floor(config.height * 0.3)}:mode=cline:colors=gold\`;
        break;`;

content = content.replace(target, replace);
fs.writeFileSync('src/server/renderer.ts', content);
