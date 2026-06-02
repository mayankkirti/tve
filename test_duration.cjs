const { execSync } = require('child_process');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const out = execSync(`${ffmpegInstaller.path} -i package.json 2>&1 || true`).toString();
const match = out.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
console.log(match);
