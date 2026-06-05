const fs = require('fs');

let content = fs.readFileSync('src/server/renderer.ts', 'utf-8');

const targetStr = `    // Add Logo
    if (config.logoPath) {
      filterComplex += \`[2:v]scale=120:120[logo];\`;
      filterComplex += \`[bgviz][logo]overlay=W-w-50:50[final1];\`;
    } else {
      filterComplex += \`[bgviz]copy[final1];\`;
    }

    // Removed drawtext to prevent system font issues on minimal Azure App Service images
    filterComplex += \`[final1]copy[outv]\`;`;

const replacementStr = `    // Add Logo
    if (config.logoPath) {
      const sizeVal = config.logoSize || 100;
      const targetW = Math.floor(120 * (sizeVal / 100));
      const w = targetW + (targetW % 2); 
      filterComplex += \`[2:v]scale=\${w}:-1[logo];\`;
      filterComplex += \`[bgviz][logo]overlay=W-w-50:50[final1];\`;
    } else {
      filterComplex += \`[bgviz]copy[final1];\`;
    }

    const fontPath = path.join(process.cwd(), "public", "font.ttf").replace(/\\\\/g, "/");
    let prevOut = "[final1]";
    let filterIndex = 1;
    const tracklistFileCleanup = path.join(process.cwd(), \`tracklist_\${id}.txt\`);

    const addTextOptions = [];
    const baseTextSize = (config.textSize || 100) / 100;
    
    // helper to escape text for ffmpeg
    const escapeText = (t) => t.replace(/'/g, "\\\\\\'").replace(/:/g, "\\\\:");

    if (config.channelName) addTextOptions.push(\`drawtext=fontfile='\${fontPath}':text='\${escapeText(config.channelName)}':fontcolor=white:fontsize=\${Math.floor(40 * baseTextSize)}:x=50:y=100\`);
    if (config.albumName) addTextOptions.push(\`drawtext=fontfile='\${fontPath}':text='\${escapeText(config.albumName)}':fontcolor=white:fontsize=\${Math.floor(30 * baseTextSize)}:x=50:y=150\`);
    if (config.songName) addTextOptions.push(\`drawtext=fontfile='\${fontPath}':text='\${escapeText(config.songName)}':fontcolor=white:fontsize=\${Math.floor(50 * baseTextSize)}:x=50:y=h-200\`);
    if (config.artistName) addTextOptions.push(\`drawtext=fontfile='\${fontPath}':text='By \${escapeText(config.artistName)}':fontcolor=white:fontsize=\${Math.floor(30 * baseTextSize)}:x=50:y=h-150\`);

    if (config.tracklistRaw) {
       fs.writeFileSync(tracklistFileCleanup, config.tracklistRaw);
       addTextOptions.push(\`drawtext=fontfile='\${fontPath}':textfile='\${tracklistFileCleanup.replace(/\\\\/g, "/")}\':fontcolor=white:fontsize=\${Math.floor(24 * baseTextSize)}:x=w-400:y=200\`);
    }

    addTextOptions.forEach((drawtextStr) => {
       const nextOut = \`[t\${filterIndex}]\`;
       filterComplex += \`\${prevOut}\${drawtextStr}\${nextOut};\`;
       prevOut = nextOut;
       filterIndex++;
    });

    filterComplex += \`\${prevOut}format=yuv420p[outv]\`;`;

content = content.replace(targetStr, replacementStr);

const errorTarget = `          if (config.logoPath && fs.existsSync(config.logoPath))
            fs.unlinkSync(config.logoPath);
        } catch (e) {`;
const errorReplacement = `          if (config.logoPath && fs.existsSync(config.logoPath))
            fs.unlinkSync(config.logoPath);
          const tracklistFileCleanup = path.join(process.cwd(), \`tracklist_\${id}.txt\`);
          if (fs.existsSync(tracklistFileCleanup)) fs.unlinkSync(tracklistFileCleanup);
        } catch (e) {`;

content = content.replace(errorTarget, errorReplacement);
content = content.replace(`          if (config.logoPath && fs.existsSync(config.logoPath))
            fs.unlinkSync(config.logoPath);
        } catch (e) {}`, `          if (config.logoPath && fs.existsSync(config.logoPath))
            fs.unlinkSync(config.logoPath);
          const tracklistFileCleanup = path.join(process.cwd(), \`tracklist_\${id}.txt\`);
          if (fs.existsSync(tracklistFileCleanup)) fs.unlinkSync(tracklistFileCleanup);
        } catch (e) {}`);

fs.writeFileSync('src/server/renderer.ts', content);
