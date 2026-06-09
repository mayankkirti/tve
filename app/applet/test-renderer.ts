import { generateVideoCommand } from './src/server/renderer.ts';

const fakeConfig = {
  bgPaths: ["bg1.mp4", "bg2.mp4"],
  audioPath: "audio.mp3",
  width: 1920,
  height: 1080,
  fps: 30,
  bgMediaStyle: 'random-crossfade',
  bypassOverlays: true,
};

try {
  const result = generateVideoCommand("job123", fakeConfig, "output.mp4");
  console.log("Filter complex:");
  console.log(result.command._complexFilters[0]);
} catch (err) {
  console.error("Renderer error:", err);
}
