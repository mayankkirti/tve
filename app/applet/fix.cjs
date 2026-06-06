const fs = require('fs');
let code = fs.readFileSync('src/server/renderer.ts', 'utf8');

code = code.replace(/const K = config\.bgPaths\.length;\s*let segments = \[\];\s*const K = numBgInputs;/m, 'let segments = [];\\n      const K = numBgInputs;');

fs.writeFileSync('src/server/renderer.ts', code);
console.log('Fixed compile errors');
