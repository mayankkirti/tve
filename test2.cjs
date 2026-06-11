const { execSync } = require('child_process');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
try {
  console.time('analyze');
  execSync(`"${ffmpegInstaller.path}" -f lavfi -i "sine=frequency=1000:duration=180" -f wav test.wav -y`);
  const out = execSync(`"${ffmpegInstaller.path}" -v quiet -i test.wav -filter_complex "highpass=f=200,lowpass=f=2000,aformat=channel_layouts=mono,astats=metadata=1:reset=1:length=0.2,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-" -f null - 2>&1`).toString();
  console.timeEnd('analyze');
  const lines = out.split('\n');
  console.log(`Produced ${lines.length} lines. Example:`);
  console.log(lines.slice(0, 4).join('\n'));
} catch(e) { console.error(e.message); }
