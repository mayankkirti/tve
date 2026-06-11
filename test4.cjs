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

const data = analyzeAudio('test.wav');
console.log("Analyzed data points:", data.length);
