const { execSync } = require("child_process");
const fs = require("fs");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");

try {
  // Test both special shell characters and ffmpeg characters
  const t = "Track 1: They said, 'Hello [World] % 100!', \"wow\" - & it was good.";

  // Method 4: Escape for text='...'
  // In ffmpeg filtergraph, inside '', we just need to escape ' as '\'' and maybe %
  const escapeText4 = (str) => {
    return str
      .replace(/'/g, "'\\\\''")
      .replace(/%/g, "\\\\\\%"); // % might need to be escaped because of strftime and text expansions
  };
  
  // Method 5: Use text=... without outer quotes and escape everything.
  // We double backslash because the script file parses it once, then the filter parses it.
  const escapeText5 = (str) => {
    let s = str.replace(/\\/g, "\\\\\\\\")
      .replace(/:/g, "\\\\:")
      .replace(/'/g, "\\\\'")
      .replace(/,/g, "\\\\,")
      .replace(/=/g, "\\\\=")
      .replace(/\[/g, "\\\\[")
      .replace(/\]/g, "\\\\]")
      .replace(/;/g, "\\\\;")
      .replace(/%/g, "\\\\\\%");
    return s;
  };

  // Method 6: Just do what we did originally but escape % as well
  const escapeText6 = (str) => str.replace(/'/g, "\\'").replace(/:/g, "\\:").replace(/%/g, "\\\\%").replace(/,/g, "\\,");

  const filter4 = `color=c=black:s=640x480:d=1[bg];[bg]drawtext=fontfile='public/Inter.ttf':text='${escapeText4(t)}':fontcolor=white:fontsize=50:x=50:y=50[outv]`;
  const filter5 = `color=c=black:s=640x480:d=1[bg];[bg]drawtext=fontfile='public/Inter.ttf':text=${escapeText5(t)}:fontcolor=white:fontsize=50:x=50:y=50[outv]`;
  const filter6 = `color=c=black:s=640x480:d=1[bg];[bg]drawtext=fontfile='public/Inter.ttf':text='${escapeText6(t)}':fontcolor=white:fontsize=50:x=50:y=50[outv]`;


  fs.writeFileSync("filter4.txt", filter4);
  fs.writeFileSync("filter5.txt", filter5);
  fs.writeFileSync("filter6.txt", filter6);

  console.log("Testing filter4...");
  try {
    execSync(`"${ffmpegInstaller.path}" -v error -f lavfi -i anullsrc=r=1 -filter_complex_script filter4.txt -map "[outv]" -f null /dev/null 2>&1`, {encoding:'utf8'});
    console.log("filter4 SUCCESS");
  } catch(e) { console.log("filter4 FAILED", e.message, e.stdout); }

  console.log("Testing filter5...");
  try {
    execSync(`"${ffmpegInstaller.path}" -v error -f lavfi -i anullsrc=r=1 -filter_complex_script filter5.txt -map "[outv]" -f null /dev/null 2>&1`, {encoding:'utf8'});
    console.log("filter5 SUCCESS");
  } catch(e) { console.log("filter5 FAILED", e.message, e.stdout); }

  console.log("Testing filter6...");
  try {
    execSync(`"${ffmpegInstaller.path}" -v error -f lavfi -i anullsrc=r=1 -filter_complex_script filter6.txt -map "[outv]" -f null /dev/null 2>&1`, {encoding:'utf8'});
    console.log("filter6 SUCCESS");
  } catch(e) { console.log("filter6 FAILED", e.message, e.stdout); }

} catch(e) {
  console.error(e);
}
