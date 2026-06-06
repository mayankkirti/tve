import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { execSync } from "child_process";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

import { saveJobs, loadJobs } from "./jobStore";

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
  logoSize?: number;
  tracklistRaw?: string;
  textSize?: number;
}

export interface RenderJobState {
  id: string;
  progress: number;
  timemark?: string;
  status: "rendering" | "completed" | "error" | "paused";
  error?: string;
  outputPath?: string;
  uploadedToYouTube?: boolean;
}

export const jobs: Record<string, RenderJobState> = loadJobs();

const activeCommands: Record<string, any> = {};
let activeRenderThreads = 0;
const MAX_CONCURRENT_RENDERS = 2;

async function checkBackpressure() {
  return new Promise<void>((resolve) => {
    const check = () => {
      if (activeRenderThreads < MAX_CONCURRENT_RENDERS) {
        resolve();
      } else {
        setTimeout(check, 1000);
      }
    };
    check();
  });
}


export function pauseRenderJob(id: string) {
  if (activeCommands[id]) {
    try { activeCommands[id].kill('SIGSTOP'); jobs[id].status = 'paused'; } catch (e) {}
  }
}
export function resumeRenderJob(id: string) {
  if (activeCommands[id]) {
    try { activeCommands[id].kill('SIGCONT'); jobs[id].status = 'rendering'; } catch (e) {}
  }
}

export function killRenderJob(id: string) {
  if (activeCommands[id]) {
    try {
      activeCommands[id].kill("SIGKILL");
    } catch (e) {}
    delete activeCommands[id];
  }
}

import { systemConfig } from "./config";

function checkAndFreeDiskSpace() {
  try {
    const uploadsDir = path.join(process.cwd(), "uploads");
    
    // Instead of completely relying on physical free space, we also calculate the logic space used by our uploads folder.
    let totalUsedByApp = 0;
    if (fs.existsSync(uploadsDir)) {
      const uFiles = fs.readdirSync(uploadsDir);
      for (const f of uFiles) {
         totalUsedByApp += fs.statSync(path.join(uploadsDir, f)).size;
      }
    }
    
    const stats = fs.statfsSync(uploadsDir);
    const physicalFreeBytes = stats.bavail * stats.bsize;
    const requiredBufferBytes = 500 * 1024 * 1024; // We physically need at least 500MB free safely
    
    const limitBytes = systemConfig.diskLimitMB * 1024 * 1024;

    if (physicalFreeBytes < requiredBufferBytes || totalUsedByApp > limitBytes) {
      console.log(`Disk management triggered. Used by app: ${Math.round(totalUsedByApp/1024/1024)}MB. Limit: ${systemConfig.diskLimitMB}MB. Physical Free: ${Math.round(physicalFreeBytes/1024/1024)}MB. Attempting cleanup...`);

      // Find oldest videos
      
      let oldestJobId = null;
      let oldestTime = Infinity;
      
      // Try to find an uploaded one first if possible
      for (const jid in jobs) {
         const j = jobs[jid];
         if (j.status === "completed" && j.outputPath && fs.existsSync(j.outputPath)) {
            const st = fs.statSync(j.outputPath);
            const apparentAge = (j as any).uploadedToYouTube ? 0 : st.mtimeMs;
            if (apparentAge < oldestTime) {
               oldestTime = apparentAge;
               oldestJobId = jid;
            }
         }
      }
      
      if (oldestJobId) {
         fs.unlinkSync(jobs[oldestJobId].outputPath!);
         delete jobs[oldestJobId];
         console.log(`Deleted oldest video to free up space: ${oldestJobId}`);
         // Check again
         checkAndFreeDiskSpace();
      }
    }
  } catch(e) {
    console.error("Failed to check disk space", e);
  }
}

export async function startRenderJob(id: string, config: JobConfig) {
  jobs[id] = { id, progress: 0, status: "rendering" };
  const outputPath = path.join(process.cwd(), "uploads", `${id}.mp4`);

  try {
    checkAndFreeDiskSpace();
    
    await checkBackpressure();
    if (jobs[id].status !== "rendering") return; // Job was cancelled while waiting
    activeRenderThreads++;

    console.log("Starting render job", id);

    let finalAudioPath = config.audioPath;
    if (finalAudioPath.startsWith('http')) {
        let downloadUrl = finalAudioPath;
        const driveMatch = finalAudioPath.match(/drive\.google\.com\/file\/d\/([^/]+)/);
        if (driveMatch) {
            downloadUrl = `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
        }
        console.log("Downloading audio from URL:", downloadUrl);
        const res = await fetch(downloadUrl);
        if (!res.ok) throw new Error("Failed to download audio from url: " + res.statusText);
        const buffer = await res.arrayBuffer();
        finalAudioPath = path.join(process.cwd(), "uploads", `temp_${id}.mp3`);
        fs.writeFileSync(finalAudioPath, Buffer.from(buffer));
    }

    try {
      const asize = fs.statSync(finalAudioPath).size;
      console.log("Audio size:", asize);
    } catch (e) {
      console.log("Audio size err:", e);
    }
    try {
      if (config.bgPaths.length > 0) {
        let bgPath = config.bgPaths[0];
        if (!bgPath.startsWith('http')) {
          const bgsize = fs.statSync(bgPath).size;
          console.log("Bg size:", bgsize);
        }
      }
    } catch (e) {
      console.log("Bg size err:", e);
    }

    let totalSeconds = 0;
    try {
      const out = execSync(
        `${ffmpegInstaller.path} -i "${finalAudioPath}" 2>&1 || true`,
      ).toString();
      const match = out.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (match) {
        totalSeconds =
          parseInt(match[1]) * 3600 +
          parseInt(match[2]) * 60 +
          parseFloat(match[3]);
        console.log("Parsed audio duration:", totalSeconds, "seconds");
      }
    } catch (e) {
      console.log("FFmpeg duration parse error:", e);
    }

    let command = ffmpeg();

    // Inputs
    command = command.input(finalAudioPath);

    // Make sure we have a background
    const bgScale = `scale=${config.width}:${config.height}:force_original_aspect_ratio=decrease,pad=${config.width}:${config.height}:(ow-iw)/2:(oh-ih)/2`;

    let numBgInputs = 0;
    if (config.bgPaths.length > 0) {
      for (const bgPath of config.bgPaths) {
        const bgExt = bgPath.toLowerCase();
        const isBgVideo = bgExt.endsWith(".mp4") || bgExt.endsWith(".webm") || bgExt.endsWith(".mov");
        if (isBgVideo) { command = command.input(bgPath).inputOptions(["-stream_loop", "-1"]); } 
        else { command = command.input(bgPath).inputOptions(["-loop", "1"]); }
        numBgInputs++;
      }
    } else {
      command = command.input(`color=c=black:s=${config.width}x${config.height}:r=${config.fps}`).inputFormat("lavfi");
      numBgInputs++;
    }

    if (config.logoPath && !fs.existsSync(config.logoPath)) {
      config.logoPath = undefined;
    }

    const logoInputIndex = numBgInputs + 1;
    if (config.logoPath) {
      command = command.input(config.logoPath).inputOptions(["-loop", "1"]);
    }

    // Choose Visualizer
    let vizFilter = "";
    switch (config.style) {
      case "minimal-fast":
        vizFilter = `showwaves=s=${config.width}x${Math.floor(config.height * 0.3)}:mode=p2p:colors=white`;
        break;
      case "psychedelic":
        vizFilter = `showcqt=s=${config.width}x${config.height}:bar_h=${Math.floor(config.height * 0.2)}:axis_h=0:sono_g=4:sono_v=10`;
        break;
      case "indian-ambient":
        // Lightweight golden horizontal waveform (like a party flash but horizontal)
        vizFilter = `avectorscope=s=${config.width}x${config.height}:draw=line:zoom=2`;
        break;
      case "party-flash":
      case "chillout-flash":
        vizFilter = `avectorscope=s=${config.width}x${config.height}:draw=line:zoom=2`;
        break;
      default:
        vizFilter = `showwaves=s=${config.width}x${config.height}:mode=cline:colors=white`;
    }

    // Compose complex filter
    let filterComplex = "";
    let lastOut = "0:a";

    if (config.bgPaths.length > 1) {
      filterComplex += `color=c=black:s=${config.width}x${config.height}:r=${config.fps}[base];`;
      let prevBgOut = "[base]";
      
      const parseTime = (timeStr) => {
        const parts = timeStr.split(':').map(Number);
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return 0;
      };
      
      let tracks = [];
      if (config.tracklistRaw) {
        const lines = config.tracklistRaw.split('\n').map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          const match = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)[ \t]*(?:\||-|—)?[ \t]+(.+)$/);
          if (match) tracks.push({ timeSeconds: parseTime(match[1]) });
        }
        tracks.sort((a, b) => a.timeSeconds - b.timeSeconds);
      }
      
      const K = config.bgPaths.length;
      let segments = [];
      if (tracks.length > 0) {
        for (let i = 0; i < tracks.length; i++) {
          segments.push({
            start: tracks[i].timeSeconds,
            end: tracks[i+1] ? tracks[i+1].timeSeconds : totalSeconds || 999999,
            bgIndex: i % K
          });
        }
        if (tracks[0].timeSeconds > 0) {
          segments.unshift({ start: 0, end: tracks[0].timeSeconds, bgIndex: (K - 1) % K });
        }
      } else {
        segments.push({ start: 0, end: 999999, bgIndex: 0 });
      }
      
      for (let i = 0; i < numBgInputs; i++) {
        filterComplex += `[${i+1}:v]${bgScale},format=yuv420p[scaled_bg${i}];`;
      }
      
      let sid = 0;
      for (const seg of segments) {
        const nextOut = `[base${sid}]`;
        filterComplex += `${prevBgOut}[scaled_bg${seg.bgIndex}]overlay=enable='between(t,${seg.start},${seg.end})'${nextOut};`;
        prevBgOut = nextOut;
        sid++;
      }
      
      filterComplex += `${prevBgOut}copy[bg];`;
    } else {
      filterComplex += `[1:v]${bgScale},format=yuv420p[bg];`;
    }

    filterComplex += `[0:a]${vizFilter}[viz];`;

    // Blend background and visualizer based on style
    if (config.style === "psychedelic") {
      filterComplex += `[bg][viz]blend=all_mode=addition[bgviz];`;
    } else if (config.style === "minimal-fast") {
      filterComplex += `[bg][viz]overlay=(W-w)/2:H-h-50[bgviz];`;
    } else {
      filterComplex += `[bg][viz]overlay=(W-w)/2:(H-h)/2[bgviz];`;
    }

    // Add Logo
    if (config.logoPath) {
      const sizeVal = config.logoSize || 100;
      const targetW = Math.floor(120 * (sizeVal / 100));
      const w = targetW + (targetW % 2); 
      filterComplex += `[${logoInputIndex}:v]scale=${w}:-1[logo];`;
      filterComplex += `[bgviz][logo]overlay=W-w-50:50[final1];`;
    } else {
      filterComplex += `[bgviz]copy[final1];`;
    }

    const fontPath = path.join(process.cwd(), "public", "font.ttf").replace(/\\/g, "/");
    let prevOut = "[final1]";
    let filterIndex = 1;
    const tracklistFileCleanup = path.join(process.cwd(), `tracklist_${id}.txt`);

    const addTextOptions = [];
    const baseTextSize = (config.textSize || 100) / 100;
    
    // helper to escape text for ffmpeg
    const escapeText = (t) => t.replace(/'/g, "\\\'").replace(/:/g, "\\:");

    if (config.channelName) addTextOptions.push(`drawtext=fontfile='${fontPath}':text='${escapeText(config.channelName)}':fontcolor=white:fontsize=${Math.floor(40 * baseTextSize)}:x=50:y=100`);
    if (config.albumName) addTextOptions.push(`drawtext=fontfile='${fontPath}':text='${escapeText(config.albumName)}':fontcolor=white:fontsize=${Math.floor(30 * baseTextSize)}:x=50:y=h-100`);
    if (config.songName) addTextOptions.push(`drawtext=fontfile='${fontPath}':text='${escapeText(config.songName)}':fontcolor=white:fontsize=${Math.floor(50 * baseTextSize)}:x=50:y=h-200`);
    if (config.artistName) addTextOptions.push(`drawtext=fontfile='${fontPath}':text='By ${escapeText(config.artistName)}':fontcolor=white:fontsize=${Math.floor(30 * baseTextSize)}:x=50:y=h-150`);

    if (config.tracklistRaw) {
       fs.writeFileSync(tracklistFileCleanup, config.tracklistRaw);
       addTextOptions.push(`drawtext=fontfile='${fontPath}':textfile='${tracklistFileCleanup.replace(/\\/g, "/")}':fontcolor=white:fontsize=${Math.floor(24 * baseTextSize)}:x=w-400:y=200`);
    }

    addTextOptions.forEach((drawtextStr) => {
       const nextOut = `[t${filterIndex}]`;
       filterComplex += `${prevOut}${drawtextStr}${nextOut};`;
       prevOut = nextOut;
       filterIndex++;
    });

    filterComplex += `${prevOut}format=yuv420p[outv]`;

    command = command
      .complexFilter(filterComplex)
      .outputOptions([
        "-map",
        "[outv]",
        "-map",
        "0:a:0",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "28",
        "-threads",
        "0", // 0 automatically uses optimal threads (usually matches vCPUs)
        "-r",
        String(config.fps),
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-shortest",
      ])
      .output(outputPath)
      .on("progress", (progress) => {
        if (
          progress.percent &&
          !isNaN(progress.percent) &&
          progress.percent > 0
        ) {
          jobs[id].progress = Math.floor(Math.min(99, progress.percent));
        } else if (progress.timemark && totalSeconds > 0) {
          const p = progress.timemark.split(":");
          if (p.length === 3) {
            const secs =
              parseInt(p[0]) * 3600 + parseInt(p[1]) * 60 + parseFloat(p[2]);
            jobs[id].progress = Math.floor(
              Math.min(99, (secs / totalSeconds) * 100),
            );
          }
        }
        if (progress.timemark) {
          jobs[id].timemark = progress.timemark;
        }
      })
      .on("end", () => {
        activeRenderThreads--;
        delete activeCommands[id];
        if (jobs[id].status === "error") return;
        console.log("FFmpeg finished.");
        jobs[id].progress = 100;
        jobs[id].status = "completed";
        jobs[id].outputPath = outputPath;

        // Cleanup input files to save space
        try {
          if (fs.existsSync(config.audioPath)) fs.unlinkSync(config.audioPath);
          config.bgPaths.forEach((p) => {
            if (fs.existsSync(p)) fs.unlinkSync(p);
          });
          if (config.logoPath && fs.existsSync(config.logoPath))
            fs.unlinkSync(config.logoPath);
          const tracklistFileCleanup = path.join(process.cwd(), `tracklist_${id}.txt`);
          if (fs.existsSync(tracklistFileCleanup)) fs.unlinkSync(tracklistFileCleanup);
        } catch (e) {
          console.error("Cleanup error", e);
        }
      })
      .on("error", (err) => {
        activeRenderThreads--;
        delete activeCommands[id];
        console.error("FFmpeg error:", err);
        jobs[id].status = "error";
        jobs[id].error = err.message;

        try {
          if (fs.existsSync(config.audioPath)) fs.unlinkSync(config.audioPath);
          config.bgPaths.forEach((p) => {
            if (fs.existsSync(p)) fs.unlinkSync(p);
          });
          if (config.logoPath && fs.existsSync(config.logoPath))
            fs.unlinkSync(config.logoPath);
          const tracklistFileCleanup = path.join(process.cwd(), `tracklist_${id}.txt`);
          if (fs.existsSync(tracklistFileCleanup)) fs.unlinkSync(tracklistFileCleanup);
        } catch (e) {}
      });

    command.run();
    activeCommands[id] = command;
  } catch (error: any) {
    if (activeRenderThreads > 0) activeRenderThreads--;
    jobs[id].status = "error";
    jobs[id].error = error.message;
  }
}
