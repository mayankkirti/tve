import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
import { loadJobs } from "./jobStore";
export const jobs = loadJobs();
const activeCommands = {};
let activeRenderThreads = 0;
const MAX_CONCURRENT_RENDERS = 2;
async function checkBackpressure() {
  return new Promise<void>((resolve) => {
    const check = () => {
      if (activeRenderThreads < MAX_CONCURRENT_RENDERS) {
        resolve();
      } else {
        setTimeout(check, 1e3);
      }
    };
    check();
  });
}
export function getActiveRenderThreads() {
  return activeRenderThreads;
}
export function pauseRenderJob(id) {
  if (activeCommands[id]) {
    try {
      activeCommands[id].kill("SIGSTOP");
      jobs[id].status = "paused";
    } catch (e) {
    }
  }
}
export function resumeRenderJob(id) {
  if (activeCommands[id]) {
    try {
      activeCommands[id].kill("SIGCONT");
      jobs[id].status = "rendering";
    } catch (e) {
    }
  }
}
export function killRenderJob(id) {
  if (activeCommands[id]) {
    try {
      activeCommands[id].kill("SIGKILL");
    } catch (e) {
    }
    delete activeCommands[id];
  }
}
import { systemConfig } from "./config";
function checkAndFreeDiskSpace() {
    const uploadsDir = path.join(process.cwd(), "uploads");
    let totalUsedByApp = 0;
    if (fs.existsSync(uploadsDir)) {
      const uFiles = fs.readdirSync(uploadsDir);
      for (const f of uFiles) {
        totalUsedByApp += fs.statSync(path.join(uploadsDir, f)).size;
      }
    }
    const stats = fs.statfsSync(uploadsDir);
    const physicalFreeBytes = stats.bavail * stats.bsize;
    const requiredBufferBytes = 500 * 1024 * 1024;
    const limitBytes = systemConfig.diskLimitMB * 1024 * 1024;
    
    if (physicalFreeBytes < requiredBufferBytes || totalUsedByApp > limitBytes) {
      console.log(`Disk management triggered. Used by app: ${Math.round(totalUsedByApp / 1024 / 1024)}MB. Limit: ${systemConfig.diskLimitMB}MB. Physical Free: ${Math.round(physicalFreeBytes / 1024 / 1024)}MB.`);
      throw new Error(`Disk limit exceeded (${Math.round(totalUsedByApp / 1024 / 1024)}MB / ${systemConfig.diskLimitMB}MB). Please free up space manually.`);
    }
}
export async function startRenderJob(id, config) {
  jobs[id] = { id, progress: 0, status: "rendering", config, createdAt: Date.now() };
  const outputPath = path.join(process.cwd(), "uploads", `${id}.mp4`);
  try {
    checkAndFreeDiskSpace();
    await checkBackpressure();
    if (jobs[id].status !== "rendering") return;
    activeRenderThreads++;
    console.log("Starting render job", id);
    let finalAudioPath = config.audioPath;
    if (finalAudioPath.startsWith("http")) {
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
        if (!bgPath.startsWith("http")) {
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
        `${ffmpegInstaller.path} -i "${finalAudioPath}" 2>&1 || true`
      ).toString();
      const match = out.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (match) {
        totalSeconds = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
        console.log("Parsed audio duration:", totalSeconds, "seconds");
      }
    } catch (e) {
      console.log("FFmpeg duration parse error:", e);
    }

    if (config.audioCropEnabled && config.audioCropStart >= 0 && config.audioCropEnd > config.audioCropStart) {
      totalSeconds = config.audioCropEnd - config.audioCropStart;
    }

    let command = ffmpeg();
    try {
      execSync(`"${ffmpegInstaller.path}" -v error -i "${finalAudioPath}" -t 1 -f null -`, {encoding: "utf8"});
    } catch(e: any) {
      console.log("Probe err:", e.message);
      throw new Error("Audio file is missing or invalid format (Could be a Google Drive auth page or corrupted file). Please make sure the file is valid media and public.");
    }
    
    command = command.input(finalAudioPath);
    if (config.audioCropEnabled && config.audioCropStart >= 0 && config.audioCropEnd > config.audioCropStart) {
      command = command.inputOptions([
         `-ss ${config.audioCropStart}`,
         `-t ${config.audioCropEnd - config.audioCropStart}`
      ]);
    }
    let bgScale = `scale=${config.width}:${config.height}:force_original_aspect_ratio=decrease,pad=${config.width}:${config.height}:(ow-iw)/2:(oh-ih)/2`;
    if (config.bgZoomEnabled) {
      const zspeed = (config.bgZoomLevel || 50) / 1e4;
      bgScale += `,zoompan=z='min(zoom+${zspeed},1.5)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${config.width}x${config.height}`;
    }
    let numBgInputs = 0;
    if (config.bgPaths.length > 0) {
      for (const bgPath of config.bgPaths) {
        const bgExt = bgPath.toLowerCase();
        const isBgVideo = bgExt.endsWith(".mp4") || bgExt.endsWith(".webm") || bgExt.endsWith(".mov");
        if (isBgVideo) {
          command = command.input(bgPath).inputOptions(["-stream_loop", "-1"]);
        } else {
          command = command.input(bgPath).inputOptions(["-loop", "1"]);
        }
        numBgInputs++;
      }
    } else {
      command = command.input(`color=c=black:s=${config.width}x${config.height}:r=${config.fps}`).inputFormat("lavfi");
      numBgInputs++;
    }
    if (config.logoPath && !fs.existsSync(config.logoPath)) {
      const publicPath = require("path").join(process.cwd(), "public", config.logoPath.replace("./", ""));
      if (fs.existsSync(publicPath)) {
        config.logoPath = publicPath;
      }
    }
    if (config.logoPath && !fs.existsSync(config.logoPath)) {
      const publicPath = require("path").join(process.cwd(), "public", config.logoPath.replace("./", ""));
      if (fs.existsSync(publicPath)) {
        config.logoPath = publicPath;
      }
    }
    if (config.logoPath && !fs.existsSync(config.logoPath)) {
      config.logoPath = void 0;
    }
    const logoInputIndex = numBgInputs + 1;
    if (config.logoPath) {
      command = command.input(config.logoPath).inputOptions(["-loop", "1"]);
    }
    
    let gradInputIndex = -1;
    if (config.style === "indian-ambient") {
        const gradPath = path.join(process.cwd(), "public", `grad_indian_v2_${config.width}x${config.height}.png`);
        if (!fs.existsSync(gradPath)) {
             execSync(`"${ffmpegInstaller.path}" -v error -f lavfi -i nullsrc=s=${config.width}x${config.height} -vf "geq=r=255:g='max(140, 255-115*(hypot(X-W/2,Y-H/2)/(min(W,H)/2)))':b='max(0, 255-850*(hypot(X-W/2,Y-H/2)/(min(W,H)/2)))'" -vframes 1 -y "${gradPath}"`);
        }
        command = command.input(gradPath).inputOptions(["-loop", "1"]);
        gradInputIndex = config.logoPath ? logoInputIndex + 1 : logoInputIndex;
    }

    let vizFilter = "";
    switch (config.style) {
      case "minimal-fast":
        vizFilter = `showwaves=s=${config.width}x${Math.floor(config.height * 0.3)}:mode=p2p:colors=white`;
        break;
      case "psychedelic":
        vizFilter = `showcqt=s=${config.width}x${config.height}:bar_h=${Math.floor(config.height * 0.2)}:axis_h=0:sono_g=4:sono_v=10`;
        break;
      case "indian-ambient":
        vizFilter = `avectorscope=s=${config.width}x${config.height}:draw=line:zoom=2:rc=255:gc=255:bc=255:ac=255:rf=5:gf=5:bf=5`;
        break;
      case "party-flash":
        vizFilter = `avectorscope=s=${config.width}x${config.height}:draw=line:zoom=2:rc=210:gc=160:bc=150:ac=255`;
        break;
      case "chillout-flash":
        vizFilter = `avectorscope=s=${config.width}x${config.height}:draw=line:zoom=2:rc=180:gc=130:bc=130:ac=255:rf=5:gf=10:bf=10`;
        break;
      default:
        vizFilter = `showwaves=s=${config.width}x${config.height}:mode=cline:colors=white`;
    }
    let filterComplex = "";
    let lastOut = "0:a";
    if (config.bgPaths.length > 1) {
      filterComplex += `color=c=black:s=${config.width}x${config.height}:r=${config.fps}[base];`;
      let prevBgOut = "[base]";
      const parseTime = (timeStr) => {
        const parts = timeStr.split(":").map(Number);
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return 0;
      };
      let tracks = [];
      if (config.tracklistRaw) {
        const lines = config.tracklistRaw.split("\n").map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          const match = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)[ \t]*(?:\||-|—)?[ \t]+(.+)$/);
          if (match) tracks.push({ timeSeconds: parseTime(match[1]) });
        }
        tracks.sort((a, b) => a.timeSeconds - b.timeSeconds);
      }
      let segments = [];
      const K = numBgInputs;
      if (K === 0) {
      } else if (config.bgMediaStyle === "tracklist" && tracks.length > 0) {
        for (let i = 0; i < tracks.length; i++) {
          segments.push({
            start: tracks[i].timeSeconds,
            end: tracks[i + 1] ? tracks[i + 1].timeSeconds : totalSeconds || 999999,
            bgIndex: i % K
          });
        }
        if (tracks[0].timeSeconds > 0) {
          segments.unshift({ start: 0, end: tracks[0].timeSeconds, bgIndex: (K - 1) % K });
        }
      } else if (K > 1) {
        let durationAvg = 4;
        if (config.bgMediaStyle === "hard-cut") durationAvg = 2.5;
        if (config.bgMediaStyle === "soft-crossfade") durationAvg = 6;
        if (config.bgMediaStyle === "random-crossfade") durationAvg = 5;
        const finalDur = totalSeconds || 180;
        let t = 0;
        let pidx = -1;
        while (t < finalDur) {
          let rdur = durationAvg + (Math.random() * 2 - 1);
          if (config.bgMediaStyle === "mix-cuts") rdur = Math.random() > 0.5 ? 2 : 6;
          let nidx = Math.floor(Math.random() * K);
          if (nidx === pidx) nidx = (nidx + 1) % K;
          segments.push({ start: t, end: t + rdur, bgIndex: nidx });
          t += rdur;
          pidx = nidx;
        }
      } else {
        segments.push({ start: 0, end: totalSeconds || 999999, bgIndex: 0 });
      }
      const usageCount = new Array(numBgInputs).fill(0);
      for (const seg of segments) usageCount[seg.bgIndex]++;
      for (let i = 0; i < numBgInputs; i++) {
        filterComplex += `[${i + 1}]${bgScale},format=yuv420p[scaled_bg_base${i}];`;
        if (usageCount[i] > 1) {
           let splits = "";
           for(let j=0; j<usageCount[i]; j++) splits += `[scaled_bg${i}_${j}]`;
           filterComplex += `[scaled_bg_base${i}]split=${usageCount[i]}${splits};`;
        } else if (usageCount[i] === 1) {
           filterComplex += `[scaled_bg_base${i}]copy[scaled_bg${i}_0];`;
        } else {
           filterComplex += `[scaled_bg_base${i}]nullsink;`;
        }
      }
      let sid = 0;
      const consumed = new Array(numBgInputs).fill(0);
      for (const seg of segments) {
        const streamName = `[scaled_bg${seg.bgIndex}_${consumed[seg.bgIndex]++}]`;
        const nextOut = `[base${sid}]`;
        const isFade = config.bgMediaStyle === "tracklist" || config.bgMediaStyle === "random-crossfade" || config.bgMediaStyle === "soft-crossfade" || config.bgMediaStyle === "mix-cuts" && seg.end - seg.start > 4;
        if (isFade) {
          filterComplex += `${streamName}format=yuva420p,fade=t=in:st=${seg.start}:d=1:alpha=1[faded${sid}];`;
          filterComplex += `${prevBgOut}[faded${sid}]overlay=enable='between(t,${seg.start},${seg.end + 1})'${nextOut};`;
        } else {
          filterComplex += `${prevBgOut}${streamName}overlay=enable='between(t,${seg.start},${seg.end})'${nextOut};`;
        }
        prevBgOut = nextOut;
        sid++;
      }
      filterComplex += `${prevBgOut}copy[bg];`;
    } else {
      filterComplex += `[1]${bgScale},format=yuv420p[bg];`;
    }
    let finalBgOut = "[bg]";

    let overlayNoiseLevel = 50;
    if (config.overlayEffect === 'Film Grain') overlayNoiseLevel = 30;
    if (config.overlayEffect === 'Dust & Scratches') overlayNoiseLevel = 80;
    if (config.overlayEffect === 'VHS Glitch') overlayNoiseLevel = 100;

    let useOlay = !config.bypassOverlayFX && config.overlayEffect && config.overlayEffect !== "None";
    let useBright = config.brightnessEnabled;

    let needsAudioMask = useOlay || useBright;
    
    // Convert base image to gbrp to avoid yuv chroma distortion during blends
    filterComplex += `${finalBgOut}format=gbrp[bg_gbrp];`;
    finalBgOut = "[bg_gbrp]";

    let outAudioPads = ['[a_viz]'];
    if (useOlay) outAudioPads.push('[a_mask_smooth_in]');
    if (useBright) {
       if (config.brightnessColorful) {
          outAudioPads.push('[a_cw]', '[a_cr]', '[a_cg]', '[a_cb]');
       } else {
          outAudioPads.push('[a_br_100_in]', '[a_br_50_in]');
       }
    }

    if (outAudioPads.length > 1) {
       filterComplex += `[0:a]asplit=${outAudioPads.length}${outAudioPads.join('')};`;
    } else {
       filterComplex += `[0:a]copy[a_viz];`;
    }

    filterComplex += `[a_viz]${vizFilter},format=gbrp[viz];`;

    if (useOlay) {
       filterComplex += `[a_mask_smooth_in]highpass=f=20,lowpass=f=120,volume=3.0,aformat=channel_layouts=mono,compand=attacks=0.01:decays=0.3,showwaves=s=16x16:mode=cline:colors=white,boxblur=4:4,colorlevels=rimin=0.4:rimax=0.9:gimin=0.4:gimax=0.9:bimin=0.4:bimax=0.9,scale=${config.width}x${config.height}:flags=bicubic,format=gbrp[a_mask_smooth];`;
       filterComplex += `color=c=black:s=${config.width}x${config.height}:r=${config.fps},noise=alls=${overlayNoiseLevel}:allf=t+u,format=gbrp[olay_base];`;
       filterComplex += `[olay_base][a_mask_smooth]blend=all_mode=multiply[olay_reactive];`;
       filterComplex += `${finalBgOut}[olay_reactive]blend=all_mode=screen:all_opacity=0.35[bgw_noise];`;
       finalBgOut = "[bgw_noise]";
    }

    // Black Overlay
    if (config.enableBlackOverlay !== false) {
      const opacity = config.overlayOpacity !== undefined ? config.overlayOpacity : 50;
      if (opacity > 0) {
        filterComplex += `color=c=black@${opacity / 100}:s=${config.width}x${config.height},format=rgba[black_overlay];`;
        filterComplex += `${finalBgOut}[black_overlay]overlay=format=auto[bgdark];`;
        finalBgOut = "[bgdark]";
      }
    }

    if (useBright) {
       const freqSlider = config.brightnessLevel !== undefined ? config.brightnessLevel : 50; 
       const clampThresh = Math.max(0.01, Math.min(0.99, 0.9 - (freqSlider / 100) * 0.7)); // 0->0.9, 100->0.2

       const max100 = 0.5; // colordodge to double brightness
       const max50 = 0.333; // colordodge to 1.5x brightness
       
       if (config.brightnessColorful) {
          // White
          filterComplex += `[a_cw]highpass=f=40,lowpass=f=80,volume=3.0,aformat=channel_layouts=mono,compand=attacks=0.01:decays=0.1,showwaves=s=16x16:mode=cline:colors=white,boxblur=4:4,format=rgb24[cw_raw];`;
          filterComplex += `[cw_raw]colorlevels=rimin=${clampThresh}:rimax=${clampThresh+0.01}:gimin=${clampThresh}:gimax=${clampThresh+0.01}:bimin=${clampThresh}:bimax=${clampThresh+0.01}:romin=0:romax=${max100}:gomin=0:gomax=${max100}:bomin=0:bomax=${max100},scale=${config.width}x${config.height}:flags=bicubic,format=gbrp[cw_mask];`;

          // Red
          filterComplex += `[a_cr]highpass=f=80,lowpass=f=120,volume=3.0,aformat=channel_layouts=mono,compand=attacks=0.01:decays=0.1,showwaves=s=16x16:mode=cline:colors=white,boxblur=4:4,format=rgb24[cr_raw];`;
          filterComplex += `[cr_raw]colorlevels=rimin=${clampThresh}:rimax=${clampThresh+0.01}:gimin=${clampThresh}:gimax=${clampThresh+0.01}:bimin=${clampThresh}:bimax=${clampThresh+0.01}:romin=0:romax=${max100}:gomin=0:gomax=0:bomin=0:bomax=0,scale=${config.width}x${config.height}:flags=bicubic,format=gbrp[cr_mask];`;

          // Green
          filterComplex += `[a_cg]highpass=f=120,lowpass=f=160,volume=3.0,aformat=channel_layouts=mono,compand=attacks=0.01:decays=0.1,showwaves=s=16x16:mode=cline:colors=white,boxblur=4:4,format=rgb24[cg_raw];`;
          filterComplex += `[cg_raw]colorlevels=rimin=${clampThresh}:rimax=${clampThresh+0.01}:gimin=${clampThresh}:gimax=${clampThresh+0.01}:bimin=${clampThresh}:bimax=${clampThresh+0.01}:romin=0:romax=0:gomin=0:gomax=${max100}:bomin=0:bomax=0,scale=${config.width}x${config.height}:flags=bicubic,format=gbrp[cg_mask];`;

          // Blue
          filterComplex += `[a_cb]highpass=f=160,lowpass=f=220,volume=3.0,aformat=channel_layouts=mono,compand=attacks=0.01:decays=0.1,showwaves=s=16x16:mode=cline:colors=white,boxblur=4:4,format=rgb24[cb_raw];`;
          filterComplex += `[cb_raw]colorlevels=rimin=${clampThresh}:rimax=${clampThresh+0.01}:gimin=${clampThresh}:gimax=${clampThresh+0.01}:bimin=${clampThresh}:bimax=${clampThresh+0.01}:romin=0:romax=0:gomin=0:gomax=0:bomin=0:bomax=${max100},scale=${config.width}x${config.height}:flags=bicubic,format=gbrp[cb_mask];`;

          // Combine masks
          filterComplex += `[cw_mask][cr_mask]blend=all_mode=addition[cwr];[cwr][cg_mask]blend=all_mode=addition[cwrg];[cwrg][cb_mask]blend=all_mode=addition[cwrgb];`;
          
          // Apply brightness with colordodge
          filterComplex += `${finalBgOut}[cwrgb]blend=all_mode=colordodge[bgw_color];`;
          finalBgOut = "[bgw_color]";
       } else {
          // Mask 100% (60Hz to 180Hz)
          filterComplex += `[a_br_100_in]highpass=f=60,lowpass=f=180,volume=3.0,aformat=channel_layouts=mono,compand=attacks=0.01:decays=0.1,showwaves=s=16x16:mode=cline:colors=white,boxblur=4:4,format=rgb24[mask1_raw];`;
          filterComplex += `[mask1_raw]colorlevels=rimin=${clampThresh}:rimax=${clampThresh+0.01}:gimin=${clampThresh}:gimax=${clampThresh+0.01}:bimin=${clampThresh}:bimax=${clampThresh+0.01}:romin=0:romax=${max100}:gomin=0:gomax=${max100}:bomin=0:bomax=${max100},scale=${config.width}x${config.height}:flags=bicubic,format=gbrp[mask1];`;

          // Mask 50% (< 80Hz)
          filterComplex += `[a_br_50_in]lowpass=f=80,volume=3.0,aformat=channel_layouts=mono,compand=attacks=0.01:decays=0.1,showwaves=s=16x16:mode=cline:colors=white,boxblur=4:4,format=rgb24[mask2_raw];`;
          filterComplex += `[mask2_raw]colorlevels=rimin=${clampThresh}:rimax=${clampThresh+0.01}:gimin=${clampThresh}:gimax=${clampThresh+0.01}:bimin=${clampThresh}:bimax=${clampThresh+0.01}:romin=0:romax=${max50}:gomin=0:gomax=${max50}:bomin=0:bomax=${max50},scale=${config.width}x${config.height}:flags=bicubic,format=gbrp[mask2];`;

          // Apply brightness with addition
          filterComplex += `${finalBgOut}[mask1]blend=all_mode=addition[bgw_m1];`;
          filterComplex += `[bgw_m1][mask2]blend=all_mode=addition[bgw_m2];`;
          finalBgOut = "[bgw_m2]";
       }
    }
    if (config.style === "psychedelic") {
      filterComplex += `${finalBgOut}format=yuv420p,hue=h='t*30',format=gbrp[bg_hue];[bg_hue][viz]blend=all_mode=addition[bgviz];`;
    } else if (config.style === "indian-ambient") {
      filterComplex += `[${gradInputIndex}:v]format=gbrp[grad_gbrp];`;
      filterComplex += `[viz][grad_gbrp]blend=all_mode=multiply[viz_color];`;
      filterComplex += `${finalBgOut}[viz_color]blend=all_mode=screen[bgviz];`;
    } else if (config.style === "minimal-fast") {
      filterComplex += `[viz]format=rgba,colorkey=black:0.1:0.1[viztrans];${finalBgOut}[viztrans]overlay=(W-w)/2:H-h-50[bgviz];`;
    } else {
      filterComplex += `${finalBgOut}[viz]blend=all_mode=screen[bgviz];`;
    }
    if (config.logoPath) {
      const sizeVal = config.logoSize || 100;
      const targetW = Math.floor(120 * (sizeVal / 100));
      const w = targetW + targetW % 2;
      filterComplex += `[${logoInputIndex}:v]scale=${w}:-1[logo];`;
      filterComplex += `[bgviz][logo]overlay=W-w-50:25[final1];`;
    } else {
      filterComplex += `[bgviz]copy[final1];`;
    }
    let fontFile = "font.ttf";
    let fontFileItalic = "font_italic.ttf";
    if (config.textFont) {
      const tf = config.textFont.replace(/ /g, "_") + ".ttf";
      const tfItalic = config.textFont.replace(/ /g, "_") + "_italic.ttf";
      const tfPath = path.join(process.cwd(), "public", tf);
      const tfItalicPath = path.join(process.cwd(), "public", tfItalic);
      if (!fs.existsSync(tfPath)) {
        try {
          const fontCssRes = await fetch(`https://fonts.googleapis.com/css?family=${encodeURIComponent(config.textFont)}`, {
            headers: { 'User-Agent': 'curl/7.64.1' }
          });
          const fontCss = await fontCssRes.text();
          const ttfMatch = fontCss.match(/url\((https:\/\/[^)]+\.ttf)\)/);
          if (ttfMatch) {
             const ttfRes = await fetch(ttfMatch[1]);
             const buffer = await ttfRes.arrayBuffer();
             fs.writeFileSync(tfPath, Buffer.from(buffer));
             fontFile = tf;
          }
        } catch(e) {
          console.error("Font fetch failed:", e);
        }
      } else {
        fontFile = tf;
      }
      if (!fs.existsSync(tfItalicPath)) {
        try {
          const italicCssRes = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(config.textFont)}:ital@1`, {
            headers: { 'User-Agent': 'curl/7.64.1' }
          });
          if (italicCssRes.ok) {
            const italicCss = await italicCssRes.text();
            const ttfMatchItalic = italicCss.match(/url\((https:\/\/[^)]+\.ttf)\)/);
            if (ttfMatchItalic) {
               const ttfResItalic = await fetch(ttfMatchItalic[1]);
               const bufferItalic = await ttfResItalic.arrayBuffer();
               fs.writeFileSync(tfItalicPath, Buffer.from(bufferItalic));
               fontFileItalic = tfItalic;
            } else {
               fontFileItalic = tf; // Fallback to normal font if no TTF found
            }
          } else {
            fontFileItalic = tf; // Fallback to normal font
          }
        } catch(e) {
          fontFileItalic = tf;
        }
      } else {
        fontFileItalic = tfItalic;
      }
    }
    const fontPath = path.join(process.cwd(), "public", fontFile).replace(/\\/g, "/");
    const fontPathItalic = fs.existsSync(path.join(process.cwd(), "public", fontFileItalic)) ? path.join(process.cwd(), "public", fontFileItalic).replace(/\\/g, "/") : fontPath;
    const fontPathBold = fs.existsSync(path.join(process.cwd(), "public", "font_bold.ttf")) ? path.join(process.cwd(), "public", "font_bold.ttf").replace(/\\/g, "/") : fontPath;
    let prevOut = "[final1]";
    let filterIndex = 1;
    const tracklistFileCleanup = path.join(process.cwd(), `tracklist_${id}.txt`);
    const addTextOptions = [];
    const baseTextSize = (config.textSize || 100) / 100;
    const escapeText = (t) => t.replace(/'/g, "\\'").replace(/:/g, "\\:");
    const h = config.height || 1080;
    const songFS = Math.floor(h * 0.06 * baseTextSize);
    const artistFS = Math.floor(h * 0.035 * baseTextSize);
    const albumFS = Math.floor(h * 0.03 * baseTextSize);
    const channelFS = Math.floor(h * 0.045 * baseTextSize);
    if (config.channelName) {
      const yVal = 25 + Math.floor(120 * ((config.logoSize || 100) / 100)) / 2;
      addTextOptions.push("drawtext=fontfile='" + fontPath + "':text='" + escapeText(config.channelName) + "':fontcolor=white:fontsize=" + channelFS + ":x=50:y=" + yVal + "-th/2");
    }
    let tracksGlobal = [];
    if (config.tracklistRaw) {
      const tlines = config.tracklistRaw.split("\n").map(l => l.trim()).filter(Boolean);
      for (const line of tlines) {
        const match = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)[ \t]*(?:\||-|—)?[ \t]+(.+)$/);
        if (match) {
          const rawTitle = match[2].trim();
          let sName = rawTitle, aName = "";
          if (rawTitle.includes(" - ")) {
            const pts = rawTitle.split(" - ");
            aName = pts[0].trim();
            sName = pts.slice(1).join(" - ").trim();
          }
          const pts = match[1].split(":").map(Number);
          let timeSec = 0;
          if (pts.length === 2) timeSec = pts[0] * 60 + pts[1];
          if (pts.length === 3) timeSec = pts[0] * 3600 + pts[1] * 60 + pts[2];
          tracksGlobal.push({ timeSec, songName: sName, artistName: aName });
        }
      }
      tracksGlobal.sort((a,b)=>a.timeSec - b.timeSec);
    }
    const songY = "H - 50 - th";
    const artistY = "H - 50 - " + songFS + " - 10 - th";
    const albumYWithTracks = "H - 50 - " + songFS + " - 10 - " + artistFS + " - 10 - th";
    const albumYNoTracks = "H - 50 - " + songFS + " - 10 - th";

    let albumImageIndex = -1;
    if (config.albumName) {
       try {
          const { createCanvas, registerFont } = require("canvas");
          if (fs.existsSync(fontPath)) {
            registerFont(fontPath, { family: 'CustomFont' });
          }
          const w = config.width;
          const cvs = createCanvas(w, h);
          const ctx = cvs.getContext('2d');
          
          ctx.font = `${albumFS}px "CustomFont", sans-serif`;
          ctx.fillStyle = 'rgba(255,255,255,1)';
          
          const hasTracks = tracksGlobal.length > 0 || config.artistName;
          let calcY = h - 50 - songFS - 10 - albumFS;
          if (hasTracks) {
              calcY = h - 50 - songFS - 10 - artistFS - 10 - albumFS;
          }
          ctx.save();
          ctx.translate(50, calcY + albumFS);
          ctx.transform(1, 0, Math.tan(-15 * Math.PI / 180), 1, 0, 0);
          ctx.fillText(config.albumName, 0, -albumFS);
          ctx.restore();

          const skewPath = path.join(process.cwd(), "public", `album_${id}.png`);
          fs.writeFileSync(skewPath, cvs.toBuffer());
          
          command = command.input(skewPath).inputOptions(["-loop", "1"]);
          let baseIdx = numBgInputs + 1; // Logo or not, base is right after BG inputs
          if (config.logoPath) baseIdx++;
          if (gradInputIndex !== -1) baseIdx++;
          albumImageIndex = baseIdx;
       } catch(e) { console.error("Canvas failed", e); }
    }

    if (tracksGlobal.length > 0) {
      for (let i=0; i<tracksGlobal.length; i++) {
        const trk = tracksGlobal[i];
        const endT = tracksGlobal[i+1] ? tracksGlobal[i+1].timeSec : 999999;
        const enable = "enable='between(t," + trk.timeSec + "," + endT + ")':";
        if(trk.songName) addTextOptions.push("drawtext=" + enable + "fontfile='" + fontPathBold + "':text='" + escapeText(trk.songName) + "':fontcolor=white:fontsize=" + songFS + ":x=50:y=" + songY);
        if(trk.artistName) addTextOptions.push("drawtext=" + enable + "fontfile='" + fontPath + "':text='" + escapeText(trk.artistName) + "':fontcolor=white:fontsize=" + artistFS + ":x=50:y=" + artistY);
      }
    } else {
      if (config.songName) addTextOptions.push("drawtext=fontfile='" + fontPathBold + "':text='" + escapeText(config.songName) + "':fontcolor=white:fontsize=" + songFS + ":x=50:y=" + songY);
      if (config.artistName) addTextOptions.push("drawtext=fontfile='" + fontPath + "':text='" + escapeText(config.artistName) + "':fontcolor=white:fontsize=" + artistFS + ":x=50:y=" + artistY);
    }

    addTextOptions.forEach((drawtextStr) => {
      const nextOut = `[t${filterIndex}]`;
      filterComplex += `${prevOut}${drawtextStr}${nextOut};`;
      prevOut = nextOut;
      filterIndex++;
    });

    if (albumImageIndex !== -1) {
      const nextOut = `[t${filterIndex}]`;
      filterComplex += `${prevOut}[${albumImageIndex}:v]overlay=0:0${nextOut};`;
      prevOut = nextOut;
      filterIndex++;
    }

    filterComplex += `${prevOut}format=yuv420p[outv]`;
    command = command.complexFilter(filterComplex).outputOptions([
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
      "0",
      // 0 automatically uses optimal threads (usually matches vCPUs)
      "-r",
      String(config.fps),
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-shortest"
    ]).output(outputPath).on("progress", (progress) => {
      if (progress.percent && !isNaN(progress.percent) && progress.percent > 0) {
        jobs[id].progress = Math.floor(Math.min(99, progress.percent));
      } else if (progress.timemark && totalSeconds > 0) {
        const p = progress.timemark.split(":");
        if (p.length === 3) {
          const secs = parseInt(p[0]) * 3600 + parseInt(p[1]) * 60 + parseFloat(p[2]);
          jobs[id].progress = Math.floor(
            Math.min(99, secs / totalSeconds * 100)
          );
        }
      }
      if (progress.timemark) {
        jobs[id].timemark = progress.timemark;
      }
    }).on("end", () => {
      activeRenderThreads--;
      delete activeCommands[id];
      if (jobs[id].status === "error") return;
      console.log("FFmpeg finished.");
      jobs[id].progress = 100;
      jobs[id].status = "completed";
      jobs[id].outputPath = outputPath;
      try {
        const tracklistFileCleanup2 = path.join(process.cwd(), `tracklist_${id}.txt`);
        if (fs.existsSync(tracklistFileCleanup2)) fs.unlinkSync(tracklistFileCleanup2);
      } catch (e) {
        console.error("Cleanup error", e);
      }
    }).on("error", (err) => {
      activeRenderThreads--;
      delete activeCommands[id];
      console.error("FFmpeg error:", err);
      jobs[id].status = "failed";
      jobs[id].error = err.message;
      try {
        const tracklistFileCleanup2 = path.join(process.cwd(), `tracklist_${id}.txt`);
        if (fs.existsSync(tracklistFileCleanup2)) fs.unlinkSync(tracklistFileCleanup2);
      } catch (e) {
      }
    });
    command.run();
    activeCommands[id] = command;
  } catch (error) {
    if (activeRenderThreads > 0) activeRenderThreads--;
    jobs[id].status = "failed";
    jobs[id].error = error.message;
  }
}
