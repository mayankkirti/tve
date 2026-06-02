const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const path = require('path');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const audioPath = 'test_audio.mp3';
const bgPath = 'test_bg.png';
const outputPath = 'output.mp4';
const config = { width: 400, height: 400, fps: 30 };

// Create dummy audio
// fs.writeFileSync(audioPath, '');

fs.writeFileSync('empty_audio.mp3', Buffer.from([]));

let command = ffmpeg()
  .input('empty_audio.mp3')
  .input(`color=c=black:s=${config.width}x${config.height}`)
  .inputFormat('lavfi');

const bgScale = `scale=${config.width}:${config.height}:force_original_aspect_ratio=decrease,pad=${config.width}:${config.height}:(ow-iw)/2:(oh-ih)/2`;
let filterComplex = `[1:v]${bgScale},format=yuv420p[bg];[bg]drawtext=text='hello':fontcolor=white:fontsize=48:x=50:y=100[outv]`;

command = command
  .complexFilter(filterComplex)
  .outputOptions([
    '-map', '[outv]',
    '-map', '0:a:0',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '28',
    '-threads', '2',
    '-r', String(config.fps),
    '-c:a', 'aac',
    '-shortest'
  ])
  .output(outputPath)
  .on('end', () => console.log('FFmpeg done, size:', fs.statSync(outputPath).size))
  .on('error', (err, stdout, stderr) => console.log('FFmpeg err:', err, 'stderr:', stderr))
  .run();
