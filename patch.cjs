const fs = require('fs');
const file = 'src/hooks/useRenderQueue.ts';
let code = fs.readFileSync(file, 'utf8');

function replaceFetch(str) {
  let modified = str.replace(/fetch\(`(\/api\/[\w\/${}-]+)`,\s*\{/g, `fetch(\`$1\`, {
      headers: { Authorization: \`Bearer \${localStorage.getItem('auth_token')}\`, ...(\`$1\` !== "/api/upload-chunk" ? { 'Content-Type': 'application/json' } : {}) }, `);
      
  modified = modified.replace(/fetch\("(\/api\/[a-zA-Z0-9-/$]*)"(?:,\s*\{([\s\S]*?)\})?/g, (match, url, optionsStr) => {
     let authHeader = `Authorization: \`Bearer \${localStorage.getItem('auth_token')}\``;
     if (!optionsStr) {
         return `fetch("${url}", { headers: { ${authHeader} } })`;
     } else {
         if (optionsStr.includes('headers: {')) {
             return match.replace('headers: {', `headers: { ${authHeader}, `);
         } else {
             return match.replace('{', `{ headers: { ${authHeader} }, `);
         }
     }
  });

  return modified;
}
console.log("Processing...");
code = replaceFetch(code);
fs.writeFileSync(file, code);
console.log("Done.");
