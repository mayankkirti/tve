const { execSync } = require('child_process');
try {
  execSync('ffmpeg -f lavfi -i aevalsrc=0 -af "compand=attacks=0.01:decays=0.3" -f null -', { stdio: 'pipe' });
  console.log("compand passed");
} catch (e) {
  console.log("compand failed: " + e.message);
  console.log(e.stderr.toString());
}
