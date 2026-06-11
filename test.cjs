const { execSync } = require('child_process');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
try {
  // Let's create a 1sec sine wave to test
  execSync(`"${ffmpegInstaller.path}" -f lavfi -i "sine=frequency=1000:duration=1" -f wav test.wav -y`);
  const out = execSync(`"${ffmpegInstaller.path}" -v quiet -i test.wav -filter_complex "highpass=f=200,lowpass=f=4000,aformat=channel_layouts=mono,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-" -f null - 2>&1`).toString();
  console.log(out.substring(0, 1000));
} catch(e) { console.error(e.message); }
