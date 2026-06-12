const { execSync } = require("child_process");
const fs = require("fs");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");

try {
  const t = "They said, 'Hello [World] % 100!', \"wow\" :; & it was good.";

  // Method 1: The current implementation in renderer.ts
  const escapeText1 = (t) => t.replace(/'/g, "\\'").replace(/:/g, "\\:");

  // Method 7: Escape ' by ending quote, escaping quote, reopening quote
  // and double % for literal % (in drawtext)
  const escapeText7 = (str) => {
    return str
      .replace(/'/g, "'\\\\''")
      .replace(/%/g, "\\\\%"); // wait, let's just do replace(/%/g, "%%") 
  };
  
  // Method 8: Replace % with %% and ' with '\''
  const escapeText8 = (str) => {
    return str
      .replace(/'/g, "'\\\\''")
      .replace(/%/g, "%%");
  };

  const filter1 = `color=c=black:s=640x480:d=1[bg];[bg]drawtext=fontfile='public/Inter.ttf':text='${escapeText1(t)}':fontcolor=white:fontsize=50:x=50:y=50[outv]`;
  const filter7 = `color=c=black:s=640x480:d=1[bg];[bg]drawtext=fontfile='public/Inter.ttf':text='${escapeText7(t)}':fontcolor=white:fontsize=50:x=50:y=50[outv]`;
  const filter8 = `color=c=black:s=640x480:d=1[bg];[bg]drawtext=fontfile='public/Inter.ttf':text='${escapeText8(t)}':fontcolor=white:fontsize=50:x=50:y=50[outv]`;


  fs.writeFileSync("filter1.txt", filter1);
  fs.writeFileSync("filter7.txt", filter7);
  fs.writeFileSync("filter8.txt", filter8);

  const testFilter = (name) => {
      console.log(`Testing ${name}...`);
      try {
        execSync(`"${ffmpegInstaller.path}" -v error -f lavfi -i anullsrc=r=1 -filter_complex_script ${name}.txt -map "[outv]" -frames:v 1 -y ${name}.png 2>&1`, {encoding:'utf8'});
        console.log(`${name} SUCCESS`);
      } catch(e) { console.log(`${name} FAILED`); }
  }

  testFilter("filter1");
  testFilter("filter7");
  testFilter("filter8");

} catch(e) {
  console.error(e);
}
