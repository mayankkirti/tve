const fs = require("fs");
let code = fs.readFileSync("src/server/renderer.ts", "utf8");
code = code.replace(/let command = ffmpeg\(\);\s*command = command.input\(finalAudioPath\);/, `let command = ffmpeg();
  try {
    const probePath = ffmpegInstaller.path.replace("ffmpeg", "ffprobe");
    const out = execSync(\`\"${probePath}\" -v error -show_entries stream=codec_type -of default=noprint_wrappers=1:nokey=1 \"${finalAudioPath}\"\`, {encoding:"utf8"});
    if(!out.includes("audio") && !out.includes("video")) throw new Error("NO_STREAMS");
  } catch(e) {
    console.log("Probe err:", e.message);
    throw new Error("Audio file is missing or invalid (Could be a private Google Drive link). Please make sure the file is valid and public.");
  }
  command = command.input(finalAudioPath);`);
fs.writeFileSync("src/server/renderer.ts", code);
console.log("Patched");