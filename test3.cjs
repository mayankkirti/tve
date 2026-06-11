const { execSync } = require('child_process');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
try {
  const out = execSync(`"${ffmpegInstaller.path}" -v quiet -i test.wav -filter_complex "aresample=8000,asetnsamples=800,highpass=f=200,lowpass=f=2000,aformat=channel_layouts=mono,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-" -f null - 2>&1`).toString();
  const lines = out.split('\n');
  console.log(`Produced ${lines.length} lines. Example:`);
  console.log(lines.slice(0, 10).join('\n'));
} catch(e) { console.error(e.message); }
