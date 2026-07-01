import * as mm from 'music-metadata';

async function run() {
  const metadata = await mm.parseFile('empty.mp3');
  console.log(metadata);
}
run();
