const fs = require('fs');
let code = fs.readFileSync('src/server/renderer.ts', 'utf8');

const sIdx = code.indexOf('const escapeText = (t)');
const eIdx = code.indexOf('addTextOptions.forEach((drawtextStr) =>');
if (sIdx !== -1 && eIdx !== -1) {
  const replaceStr = `
    const escapeText = (t) => t.replace(/'/g, "\\\\\\'").replace(/:/g, "\\\\:");
    const h = config.height;
    const songFS = Math.floor(h * 0.06 * baseTextSize);
    const artistFS = Math.floor(h * 0.035 * baseTextSize);
    const albumFS = Math.floor(h * 0.03 * baseTextSize);
    const channelFS = Math.floor(h * 0.045 * baseTextSize);
    
    if (config.channelName) {
      addTextOptions.push(\`drawtext=fontfile='\${fontPath}':text='\${escapeText(config.channelName)}':fontcolor=white:fontsize=\${channelFS}:x=50:y=100\`);
    }

    let tracksGlobal = [];
    if (config.tracklistRaw) {
      const parseLocal = (timeStr) => {
        const parts = timeStr.split(":").map(Number);
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return 0;
      };
      const tlines = config.tracklistRaw.split("\\n").map(l => l.trim()).filter(Boolean);
      for (const line of tlines) {
        const match = line.match(/^(\\d{1,2}:\\d{2}(?::\\d{2})?)[ \\t]*(?:\\||-|—)?[ \\t]+(.+)$/);
        if (match) {
          const rawTitle = match[2].trim();
          let sName = rawTitle;
          let aName = '';
          if (rawTitle.includes(' - ')) {
            const pts = rawTitle.split(' - ');
            aName = pts[0].trim();
            sName = pts.slice(1).join(' - ').trim();
          }
          tracksGlobal.push({ 
            timeStr: match[1], 
            timeSec: parseLocal(match[1]), 
            songName: sName, 
            artistName: aName 
          });
        }
      }
      tracksGlobal.sort((a,b) => a.timeSec - b.timeSec);
    }
    
    const songY = 'H - 50 - th';
    const artistY = \`H - 50 - \${songFS} - 10 - th\`;
    const albumYWithTracks = \`H - 50 - \${songFS} - 10 - \${artistFS} - 10 - th\`;
    const albumYNoTracks = \`H - 50 - \${songFS} - 10 - th\`;
    
    if (tracksGlobal.length > 0) {
      for (let i=0; i<tracksGlobal.length; i++) {
        const trk = tracksGlobal[i];
        const startT = trk.timeSec;
        const endT = tracksGlobal[i+1] ? tracksGlobal[i+1].timeSec : 999999;
        const enable = \`enable='between(t,\${startT},\${endT})':\`;
        
        if (trk.songName) {
           addTextOptions.push(\`drawtext=\${enable}fontfile='\${fontPath}':text='\${escapeText(trk.songName)}':fontcolor=white:fontsize=\${songFS}:x=50:y=\${songY}\`);
        }
        if (trk.artistName) {
           addTextOptions.push(\`drawtext=\${enable}fontfile='\${fontPath}':text='\${escapeText(trk.artistName)}':fontcolor=white:fontsize=\${artistFS}:x=50:y=\${artistY}\`);
        }
      }
      if (config.albumName) {
        // Draw album above the track lines
        addTextOptions.push(\`drawtext=fontfile='\${fontPath}':text='\${escapeText(config.albumName)}':fontcolor=white:fontsize=\${albumFS}:x=50:y=\${albumYWithTracks}:fontstyle=italic\`);
      }
    } else {
      // Static single track if no tracklist
      if (config.songName) {
         addTextOptions.push(\`drawtext=fontfile='\${fontPath}':text='\${escapeText(config.songName)}':fontcolor=white:fontsize=\${songFS}:x=50:y=\${songY}\`);
      }
      if (config.artistName) {
         addTextOptions.push(\`drawtext=fontfile='\${fontPath}':text='\${escapeText(config.artistName)}':fontcolor=white:fontsize=\${artistFS}:x=50:y=\${artistY}\`);
      }
      if (config.albumName) {
         addTextOptions.push(\`drawtext=fontfile='\${fontPath}':text='\${escapeText(config.albumName)}':fontcolor=white:fontsize=\${albumFS}:x=50:y=\${albumYNoTracks}:fontstyle=italic\`);
      }
    }
\n`;

  code = code.substring(0, sIdx) + replaceStr + code.substring(eIdx);
  fs.writeFileSync('src/server/renderer.ts', code);
  console.log('patched successfully');
} else {
  console.log('not found');
}
