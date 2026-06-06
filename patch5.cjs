const fs = require('fs');
let code = fs.readFileSync('src/server/renderer.ts', 'utf8');

const regex = /if \(!config\.bypassOverlays && config\.overlayEffect[\s\S]*?finalBgOut = '\[bgdark\]'?;\s*\}/;

const repl = `    const overlayNoiseLevel = config.overlayEffect && (config.overlayEffect.includes('Grain') || config.overlayEffect.includes('Scratches') || config.overlayEffect.includes('Glitch')) ? 50 : 15;
    
    // We create a master audio-reactive mask if we need it    let needsAudioMask = (!config.bypassOverlays && ((config.overlayEffect && config.overlayEffect !== 'None') || config.brightnessEnabled));    if (needsAudioMask) {
        // Create an audio reactive mask that flashes white with the beat
        filterComplex += \`[0:a]showwaves=s=256x256:mode=p2p:colors=white,boxblur=40:5,scale=\${config.width}x\${config.height}[a_mask];\`;
    }

    if (!config.bypassOverlays && config.overlayEffect && config.overlayEffect !== 'None') {
        filterComplex += \`color=c=black:s=\${config.width}x\${config.height}:r=\${config.fps},noise=alls=\${overlayNoiseLevel}:allf=t+u[olay_base];\`;
        filterComplex += \`[olay_base][a_mask]blend=all_mode=multiply[olay_reactive];\`;
        filterComplex += \`\${finalBgOut}[olay_reactive]blend=all_mode=screen:all_opacity=0.35[bgw_noise];\`;
        finalBgOut = '[bgw_noise]';
    }

    // Audio-reactive brightness
    if (!config.bypassOverlays && config.brightnessEnabled) {
        const brIntensity = (config.brightnessLevel || 50) / 100;
        filterComplex += \`\${finalBgOut}[a_mask]blend=all_mode=screen:all_opacity=\${brIntensity * 0.7}[bgw_bright];\`;
        finalBgOut = '[bgw_bright]';
    }

    if (config.overlayOpacity !== undefined) {
         filterComplex += \`\${finalBgOut}colorchannelmixer=rr=\${1-config.overlayOpacity/100}:gg=\${1-config.overlayOpacity/100}:bb=\#{1-config.overlayOpacity/100}[bgdark];\`;
         finalBgOut = '[bgdark]';
    }`;

code = code.replace(regex, repl);
fs.writeFileSync('src/server/renderer.ts', code);
console.log('Audio reactive overlays patched - super hack2');