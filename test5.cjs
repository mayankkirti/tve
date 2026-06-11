const { execSync } = require('child_process');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

function analyzeAudio(audioPath) {
    const out = execSync(`"${ffmpegInstaller.path}" -v quiet -i "${audioPath}" -filter_complex "aresample=8000,asetnsamples=800,highpass=f=200,lowpass=f=2000,aformat=channel_layouts=mono,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-" -f null - 2>&1`, {maxBuffer: 1024 * 1024 * 50}).toString();
    const lines = out.split('\n');
    let data = [];
    let currentTime = 0;
    for (let line of lines) {
       line = line.trim();
       if (line.startsWith('frame:')) {
           const timeMatch = line.match(/pts_time:([0-9.]+)/);
           if (timeMatch) currentTime = parseFloat(timeMatch[1]);
       } else if (line.startsWith('lavfi.astats.Overall.RMS_level=')) {
           const rmsPart = line.split('=')[1];
           let rms = parseFloat(rmsPart);
           if (rmsPart === '-inf') rms = -100;
           const energy = Math.pow(10, rms / 20);
           data.push({ time: currentTime, energy });
       }
    }
    return data;
}

function getBeatCuts(audioPath, minInterval = 1.5) {
    const data = analyzeAudio(audioPath);
    const cuts = [0];
    let lastCutTime = 0;
    let localSum = 0;
    let localCount = 0;
    
    // Calculate global average to ignore silence
    let globalSum = 0;
    for(const d of data) globalSum += d.energy;
    const globalAvg = globalSum / data.length;

    const windowSize = 20; // 2 seconds (0.1s * 20)
    for (let i = 0; i < data.length; i++) {
        // running average over last 20 frames
        localSum = 0;
        localCount = 0;
        for (let j = Math.max(0, i - windowSize); j < i; j++) {
             localSum += data[j].energy;
             localCount++;
        }
        const localAvg = localCount > 0 ? localSum / localCount : 0;
        const d = data[i];

        if (d.time - lastCutTime >= minInterval) {
            // Cut if energy is spiking significantly above local average and is above global threshold
            if (d.energy > localAvg * 1.5 && d.energy > globalAvg * 0.5) {
                 cuts.push(d.time);
                 lastCutTime = d.time;
            }
        }
    }
    return {cuts, data};
}

const { cuts } = getBeatCuts('test.wav');
console.log("Cuts identified:", cuts.length);
