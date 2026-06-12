const { execSync } = require("child_process");
const fs = require("fs");
// npx fluent-ffmpeg ? We can just use the provided ffmpeg-installer/ffmpeg path since it's installed.
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");

try {
  const t = "He said, 'Hello: World % 100!'";
  // The current escapeText
  const escapeText1 = (str) => str.replace(/'/g, "\\'").replace(/:/g, "\\:");
  
  // A new escapeText using textfile
  const textFilePath = "temp_text.txt";
  fs.writeFileSync(textFilePath, t);

  const filter1 = `color=c=black:s=640x480:d=1[bg];[bg]drawtext=fontfile='public/Inter.ttf':text='${escapeText1(t)}':fontcolor=white:fontsize=50:x=50:y=50[outv]`;
  
  // textfile method
  const filter2 = `color=c=black:s=640x480:d=1[bg];[bg]drawtext=fontfile='public/Inter.ttf':textfile='${textFilePath}':fontcolor=white:fontsize=50:x=50:y=50[outv]`;

  // Third method: no quotes, fully escaped
  const escapeText3 = (str) => {
    return str
      .replace(/\\/g, "\\\\\\\\")
      .replace(/:/g, "\\\\:")
      .replace(/'/g, "\\\\\\'")
      .replace(/,/g, "\\\\,")
      .replace(/%/g, "\\\\\\%")
      .replace(/=/g, "\\\\=")
      .replace(/ /g, "\\\\ ");
  };
  const filter3 = `color=c=black:s=640x480:d=1[bg];[bg]drawtext=fontfile='public/Inter.ttf':text=${escapeText3(t)}:fontcolor=white:fontsize=50:x=50:y=50[outv]`;


  fs.writeFileSync("filter1.txt", filter1);
  fs.writeFileSync("filter2.txt", filter2);
  fs.writeFileSync("filter3.txt", filter3);

  console.log("Testing filter1...");
  try {
    execSync(`"${ffmpegInstaller.path}" -v error -f lavfi -i anullsrc=r=1 -filter_complex_script filter1.txt -map "[outv]" -f null /dev/null 2>&1`, {encoding:'utf8'});
    console.log("filter1 SUCCESS");
  } catch(e) { console.log("filter1 FAILED", e.message, e.stdout); }

  console.log("Testing filter2...");
  try {
    execSync(`"${ffmpegInstaller.path}" -v error -f lavfi -i anullsrc=r=1 -filter_complex_script filter2.txt -map "[outv]" -f null /dev/null 2>&1`, {encoding:'utf8'});
    console.log("filter2 SUCCESS");
  } catch(e) { console.log("filter2 FAILED", e.message, e.stdout); }

  console.log("Testing filter3...");
  try {
    execSync(`"${ffmpegInstaller.path}" -v error -f lavfi -i anullsrc=r=1 -filter_complex_script filter3.txt -map "[outv]" -f null /dev/null 2>&1`, {encoding:'utf8'});
    console.log("filter3 SUCCESS");
  } catch(e) { console.log("filter3 FAILED", e.message, e.stdout); }

} catch(e) {
  console.error(e);
}
