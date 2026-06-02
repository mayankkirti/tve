import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execSync } from 'child_process';
try {
  console.log(execSync(`${ffmpegInstaller.path} -version`).toString());
} catch(e) {
  console.log(e);
}
