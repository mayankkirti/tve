const fs = require('fs');

let content = fs.readFileSync('src/server/renderer.ts', 'utf-8');

const target1 = `    if (config.bgPaths.length > 0) {
      const bgPath = config.bgPaths[0];
      const bgExt = bgPath.toLowerCase();
      const isBgVideo =
        bgExt.endsWith(".mp4") ||
        bgExt.endsWith(".webm") ||
        bgExt.endsWith(".mov");

      if (isBgVideo) {
        command = command.input(bgPath).inputOptions(["-stream_loop", "-1"]);
      } else {
        command = command.input(bgPath).inputOptions(["-loop", "1"]);
      }
    } else {
      command = command
        .input(\`color=c=black:s=\${config.width}x\${config.height}\`)
        .inputFormat("lavfi");
    }

    if (config.logoPath && !fs.existsSync(config.logoPath)) {
      config.logoPath = undefined;
    }

    if (config.logoPath) {
      command = command.input(config.logoPath).inputOptions(["-loop", "1"]);
    }`;

const replace1 = `    let numBgInputs = 0;
    if (config.bgPaths.length > 0) {
      for (const bgPath of config.bgPaths) {
        const bgExt = bgPath.toLowerCase();
        const isBgVideo = bgExt.endsWith(".mp4") || bgExt.endsWith(".webm") || bgExt.endsWith(".mov");
        if (isBgVideo) { command = command.input(bgPath).inputOptions(["-stream_loop", "-1"]); } 
        else { command = command.input(bgPath).inputOptions(["-loop", "1"]); }
        numBgInputs++;
      }
    } else {
      command = command.input(\`color=c=black:s=\${config.width}x\${config.height}:r=\${config.fps}\`).inputFormat("lavfi");
      numBgInputs++;
    }

    if (config.logoPath && !fs.existsSync(config.logoPath)) {
      config.logoPath = undefined;
    }

    const logoInputIndex = numBgInputs + 1;
    if (config.logoPath) {
      command = command.input(config.logoPath).inputOptions(["-loop", "1"]);
    }`;

content = content.replace(target1, replace1);

const target2 = `    // Compose complex filter
    let filterComplex = "";
    let lastOut = "0:a";

    filterComplex += \`[1:v]\${bgScale},format=yuv420p[bg];\`;
    filterComplex += \`[0:a]\${vizFilter}[viz];\`;`;

const replace2 = `    // Compose complex filter
    let filterComplex = "";
    let lastOut = "0:a";

    if (config.bgPaths.length > 1) {
      filterComplex += \`color=c=black:s=\${config.width}x\${config.height}:r=\${config.fps}[base];\`;
      let prevBgOut = "[base]";
      
      const parseTime = (timeStr) => {
        const parts = timeStr.split(':').map(Number);
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return 0;
      };
      
      let tracks = [];
      if (config.tracklistRaw) {
        const lines = config.tracklistRaw.split('\\n').map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          const match = line.match(/^(\\d{1,2}:\\d{2}(?::\\d{2})?)[ \\t]*(?:\\||-|—)?[ \\t]+(.+)$/);
          if (match) tracks.push({ timeSeconds: parseTime(match[1]) });
        }
        tracks.sort((a, b) => a.timeSeconds - b.timeSeconds);
      }
      
      const K = config.bgPaths.length;
      let segments = [];
      if (tracks.length > 0) {
        for (let i = 0; i < tracks.length; i++) {
          segments.push({
            start: tracks[i].timeSeconds,
            end: tracks[i+1] ? tracks[i+1].timeSeconds : totalSeconds || 999999,
            bgIndex: i % K
          });
        }
        if (tracks[0].timeSeconds > 0) {
          segments.unshift({ start: 0, end: tracks[0].timeSeconds, bgIndex: (K - 1) % K });
        }
      } else {
        segments.push({ start: 0, end: 999999, bgIndex: 0 });
      }
      
      for (let i = 0; i < numBgInputs; i++) {
        filterComplex += \`[\${i+1}:v]\${bgScale},format=yuv420p[scaled_bg\${i}];\`;
      }
      
      let sid = 0;
      for (const seg of segments) {
        const nextOut = \`[base\${sid}]\`;
        filterComplex += \`\${prevBgOut}[scaled_bg\${seg.bgIndex}]overlay=enable='between(t,\${seg.start},\${seg.end})'\${nextOut};\`;
        prevBgOut = nextOut;
        sid++;
      }
      
      filterComplex += \`\${prevBgOut}copy[bg];\`;
    } else {
      filterComplex += \`[1:v]\${bgScale},format=yuv420p[bg];\`;
    }

    filterComplex += \`[0:a]\${vizFilter}[viz];\`;`;

content = content.replace(target2, replace2);

const target3 = `    // Add Logo
    if (config.logoPath) {
      const sizeVal = config.logoSize || 100;
      const targetW = Math.floor(120 * (sizeVal / 100));
      const w = targetW + (targetW % 2); 
      filterComplex += \`[2:v]scale=\${w}:-1[logo];\`;
      filterComplex += \`[bgviz][logo]overlay=W-w-50:50[final1];\`;`;

const replace3 = `    // Add Logo
    if (config.logoPath) {
      const sizeVal = config.logoSize || 100;
      const targetW = Math.floor(120 * (sizeVal / 100));
      const w = targetW + (targetW % 2); 
      filterComplex += \`[\${logoInputIndex}:v]scale=\${w}:-1[logo];\`;
      filterComplex += \`[bgviz][logo]overlay=W-w-50:50[final1];\`;`;

content = content.replace(target3, replace3);

fs.writeFileSync('src/server/renderer.ts', content);
