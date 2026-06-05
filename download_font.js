import https from 'https';
import fs from 'fs';
import path from 'path';

const dest = path.join(process.cwd(), 'public', 'font.ttf');
const file = fs.createWriteStream(dest);

console.log("Downloading font...");
https.get('https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf', (response) => {
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log("Font downloaded successfully!");
  });
}).on('error', (err) => {
  fs.unlink(dest, () => {});
  console.error("Error downloading font:", err.message);
});
