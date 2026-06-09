
const { startRenderJob } = require('./src/server/renderer');
const config = {
  bgPaths: ['dummy_video.mp4'],
  audioPath: 'dummy_audio.mp3',
  width: 1280, height: 720, fps: 30, textFont: 'Arial',
  bypassOverlays: false,
  overlayEffect: 'Grain',
  overlayOpacity: 50,
  brightnessEnabled: true,
  brightnessLevel: 50
};
startRenderJob('test_id2', config);
