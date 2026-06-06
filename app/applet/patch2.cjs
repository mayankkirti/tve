const fs = require('fs');
let code = fs.readFileSync('src/server/renderer.ts', 'utf8');

// 1. Fix the fontPath syntax error
code = code.replace(/const fontPath = .+/g, 
  "const fontPath = path.join(process.cwd(), 'public', fontFile).replace(/\\\\\\\\/g, '/');");

// 2. Add Audio-Reactive Overlays and Brightness
const regexOverlays = /if \\(!config\\.bypassOverlays && config\\.overlayEffect[\\s\\S]*?finalBgOut = '\\[bgdark\\]';?\\s*\\}/m;

const replOverlays = `
    const overlayNoiseLevel = config.overlayEffect && (config.overlayEffect.includes('Grain') || config.overlayEffect.includes('Scratches') || config.overlayEffect.includes('Glitch')) ? 50 : 15;
    
    // We create a master audio-reactive mask if we need it
    let needsAudioMask = (!config.bypassOverlays && ((config.overlayEffect && config.overlayEffect !== 'None') || config.brightnessEnabled));
    if (needsAudioMask) {
        // Create an audio reactive mask that flashes white with the beat
        filterComplex += \`[0:a]showwaves=s=256x256:mode=cline:colors=white,scale=\${config.width}x\${config.height},boxblur=40:5[a_mask];\`;
    }

    if (!config.bypassOverlays && config.overlayEffect && config.overlayEffect !== 'None') {
        filterComplex += \`color=c=black:s=\${config.width}x\${config.height}:r=\${config.fps},noise=alls=\${overlayNoiseLevel}:allf=t+u[olay_base];\`;
        // Modulate overlay base with audio mask
        filterComplex += \`[olay_base][a_mask]blend=all_mode=multiply[olay_reactive];\`;
        // Screen onto background
        filterComplex += \`\${finalBgOut}[olay_reactive]blend=all_mode=screen:all_opacity=0.35[bgw_noise];\`;
        finalBgOut = '[bgw_noise]';
    }

    // Audio-reactive brightness
    if (!config.bypassOverlays && config.brightnessEnabled) {
        const brIntensity = (config.brightnessLevel || 50) / 100;
        // Screen the raw a_mask to increase brightness audio-reactively
        filterComplex += \`\${finalBgOut}[a_mask]blend=all_mode=screen:all_opacity=\${brIntensity * 0.5}[bgw_bright];\`;
        finalBgOut = '[bgw_bright]';
    }

    // Global opacity reduction (user black overlay darkness)
    if (config.overlayOpacity !== undefined) {
         let currentAlpha = config.overlayOpacity / 100;
         filterComplex += \`\${finalBgOut}colorchannelmixer=rr=\${1-currentAlpha}:gg=\${1-currentAlpha}:bb=\${1-currentAlpha}[bgdark];\`;
         finalBgOut = '[bgdark]';
    }
`;

code = code.replace(regexOverlays, replOverlays);

fs.writeFileSync('src/server/renderer.ts', code);
console.log('Renderer patched.');
