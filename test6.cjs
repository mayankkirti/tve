const { execSync } = require('child_process');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
try {
  const filter = `color=c=red:d=10[red]; color=c=blue:d=10[blue]; [blue]format=rgba,fade=t=out:st=0:d=0:alpha=1,fade=t=in:st=2:d=1:alpha=1,fade=t=out:st=5:d=0.01:alpha=1,fade=t=in:st=7:d=1:alpha=1[blue_faded]; [red][blue_faded]overlay=0:0`;
  execSync(`"${ffmpegInstaller.path}" -f lavfi -i "color=c=black:d=10" -filter_complex "${filter}" -y test_fade.mp4`);
  console.log("Success");
} catch(e) { console.error(e.message); }
