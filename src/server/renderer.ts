import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export interface JobConfig {
  channelName: string;
  songName: string;
  artistName: string;
  albumName: string;
  style: string;
  fps: number;
  width: number;
  height: number;
  audioPath: string; // local file paths
  bgPaths: string[];
  logoPath?: string;
}

export interface RenderJobState {
  id: string;
  progress: number;
  timemark?: string;
  status: 'rendering' | 'completed' | 'error';
  error?: string;
  outputPath?: string;
}

export const jobs: Record<string, RenderJobState> = {};

export async function startRenderJob(id: string, config: JobConfig) {
  jobs[id] = { id, progress: 0, status: 'rendering' };
  const outputPath = path.join(process.cwd(), 'uploads', `${id}.mp4`);
  
  try {
    console.log("Starting render job", id);
    try {
       const asize = fs.statSync(config.audioPath).size;
       console.log("Audio size:", asize);
    } catch(e) { console.log("Audio size err:", e); }
    try {
       if (config.bgPaths.length > 0) {
          const bgsize = fs.statSync(config.bgPaths[0]).size;
          console.log("Bg size:", bgsize);
       }
    } catch(e) { console.log("Bg size err:", e); }
    
    let totalSeconds = 0;
    try {
        const out = execSync(`${ffmpegInstaller.path} -i "${config.audioPath}" 2>&1 || true`).toString();
        const match = out.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (match) {
            totalSeconds = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
            console.log("Parsed audio duration:", totalSeconds, "seconds");
        }
    } catch(e) { console.log("FFmpeg duration parse error:", e); }

    let command = ffmpeg();
    
    // Inputs
    command = command.input(config.audioPath);
    
    // Make sure we have a background
    const bgScale = `scale=${config.width}:${config.height}:force_original_aspect_ratio=decrease,pad=${config.width}:${config.height}:(ow-iw)/2:(oh-ih)/2`;
    
    if (config.bgPaths.length > 0) {
      const bgPath = config.bgPaths[0];
      const bgExt = bgPath.toLowerCase();
      const isBgVideo = bgExt.endsWith('.mp4') || bgExt.endsWith('.webm') || bgExt.endsWith('.mov');
      
      if (isBgVideo) {
         command = command.input(bgPath).inputOptions(['-stream_loop', '-1']);
      } else {
         command = command.input(bgPath).inputOptions(['-loop', '1']);
      }
    } else {
      command = command.input(`color=c=black:s=${config.width}x${config.height}`).inputFormat('lavfi');
    }

    if (config.logoPath) {
      command = command.input(config.logoPath).inputOptions(['-loop', '1']);
    }
    
    // Choose Visualizer
    let vizFilter = '';
    switch (config.style) {
        case 'minimal-fast':
            vizFilter = `showwaves=s=${config.width}x${Math.floor(config.height*0.3)}:mode=p2p:colors=white:draw=full`;
            break;
        case 'psychedelic':
            vizFilter = `showcqt=s=${config.width}x${config.height}:bar_h=${Math.floor(config.height*0.2)}:axis_h=0:sonicg=4:sono_g=4:sono_v=10`;
            break;
        case 'indian-ambient':
            vizFilter = `showfreqs=s=${config.width}x${config.height}:mode=bar:ascale=log:fscale=log:colors=orange`;
            break;
        case 'party-flash':
        case 'chillout-flash':
             vizFilter = `avectorscope=s=${config.width}x${config.height}:draw=line:zoom=2:rate=${config.fps}`;
             break;
        default:
            vizFilter = `showwaves=s=${config.width}x${config.height}:mode=cline:colors=white`;
    }

    // Compose complex filter
    let filterComplex = '';
    let lastOut = '0:a';
    
    filterComplex += `[1:v]${bgScale},format=yuv420p[bg];`;
    filterComplex += `[0:a]${vizFilter}[viz];`;
    
    // Blend background and visualizer based on style
    if (config.style === 'psychedelic') {
        filterComplex += `[bg][viz]blend=all_mode=addition[bgviz];`;
    } else if (config.style === 'minimal-fast') {
        filterComplex += `[bg][viz]overlay=(W-w)/2:H-h-50[bgviz];`;
    } else {
        filterComplex += `[bg][viz]overlay=(W-w)/2:(H-h)/2[bgviz];`;
    }

    // Add Logo
    if (config.logoPath) {
       filterComplex += `[2:v]scale=120:120[logo];`;
       filterComplex += `[bgviz][logo]overlay=W-w-50:50[final1];`;
    } else {
       filterComplex += `[bgviz]copy[final1];`;
    }
    
    // Removed drawtext to prevent system font issues on minimal Azure App Service images
    filterComplex += `[final1]copy[outv];`;

    command = command
      .complexFilter(filterComplex)
      .outputOptions([
        '-map', '[outv]',
        '-map', '0:a:0',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-threads', '1',
        '-r', String(config.fps),
        '-c:a', 'aac',
        '-b:a', '128k',
        '-shortest'
      ])
      .output(outputPath)
      .on('progress', (progress) => {
          if (progress.percent && !isNaN(progress.percent) && progress.percent > 0) {
              jobs[id].progress = Math.floor(Math.min(99, progress.percent));
          } else if (progress.timemark && totalSeconds > 0) {
              const p = progress.timemark.split(':');
              if (p.length === 3) {
                  const secs = parseInt(p[0]) * 3600 + parseInt(p[1]) * 60 + parseFloat(p[2]);
                  jobs[id].progress = Math.floor(Math.min(99, (secs / totalSeconds) * 100));
              }
          }
          if (progress.timemark) {
              jobs[id].timemark = progress.timemark;
          }
      })
      .on('end', (stdout, stderr) => {
          if (jobs[id].status === 'error') return;
          console.log("FFmpeg finished. Stderr:", stderr);
          jobs[id].progress = 100;
          jobs[id].status = 'completed';
          jobs[id].outputPath = outputPath;
          
          // Cleanup input files to save space
          try {
            if (fs.existsSync(config.audioPath)) fs.unlinkSync(config.audioPath);
            config.bgPaths.forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });
            if (config.logoPath && fs.existsSync(config.logoPath)) fs.unlinkSync(config.logoPath);
          } catch(e) { console.error("Cleanup error", e); }
      })
      .on('error', (err, stdout, stderr) => {
          console.error("FFmpeg error:", err);
          console.error("FFmpeg stderr:", stderr);
          jobs[id].status = 'error';
          jobs[id].error = err.message;
          
          try {
            if (fs.existsSync(config.audioPath)) fs.unlinkSync(config.audioPath);
            config.bgPaths.forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });
            if (config.logoPath && fs.existsSync(config.logoPath)) fs.unlinkSync(config.logoPath);
          } catch(e) {}
      });

    command.run();

  } catch (error: any) {
    jobs[id].status = 'error';
    jobs[id].error = error.message;
  }
}
