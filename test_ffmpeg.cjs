
const { startRenderJob } = require('./src/server/renderer');
const config = {
  bgPaths: ['dummy.mp4'],
  width: 1920, height: 1080, fps: 30, textFont: 'Arial',
  tracklistRaw: '00:00 Track 1 - Artist A\n00:05 Track 2 - Artist B',
  bypassOverlays: true
};
startRenderJob('test_id', config);
