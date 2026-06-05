const fs = require('fs');
let content = fs.readFileSync('src/engine/RenderEngine.ts', 'utf-8');

// Change number of particles for indian-ambient to 0 (or just skip for indian-ambient)
content = content.replace(
  "if (config.style !== 'minimal-fast') {",
  "if (config.style !== 'minimal-fast' && config.style !== 'indian-ambient') {"
);

content = content.replace(
  "if (config.style !== 'minimal-fast') {\\n             ctx.save();\\n             if (config.style === 'chillout') {",
  "if (config.style !== 'minimal-fast' && config.style !== 'indian-ambient') {\\n             ctx.save();\\n             if (config.style === 'chillout') {"
);

// Add the golden visualizer
const visualizerCode = `         if (config.style === 'minimal-fast') {
             ctx.save();
             const visW = logoSize;
             const visH = logoSize;
             const visX = canvas.width - padding - visW;
             const visY = canvas.height - padding - visH;
             
             const numBars = 7;
             const barSpace = Math.max(2, visW * 0.05);
             const barW = (visW - (numBars - 1) * barSpace) / numBars;
             
             ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
             for (let i = 0; i < numBars; i++) {
                 const variance = (Math.sin(currentTime * 12 + i * 2.3) * 0.5 + 0.5) * 0.6 + 0.4;
                 let h = visH * normalizedReactivity * variance;
                 h = Math.max(4, Math.min(visH, h));
                 
                 // draw pill shape or simple rect
                 ctx.beginPath();
                 ctx.roundRect(visX + i * (barW + barSpace), visY + visH - h, barW, h, barW/2);
                 ctx.fill();
             }
             ctx.restore();
         } else if (config.style === 'indian-ambient') {
             ctx.save();
             // Golden horizontal party-flash visualizer (lightweight)
             const visW = canvas.width * 0.6;
             const visH = canvas.height * 0.15;
             const visX = (canvas.width - visW) / 2;
             const visY = canvas.height - padding - visH * 1.5;
             
             const numBars = Math.floor(visW / 12);
             const barW = 8;
             const barSpace = 4;
             
             // Base golden line
             ctx.fillStyle = '#FFD700'; // Gold
             ctx.shadowColor = '#FFA500';
             ctx.shadowBlur = normalizedReactivity * 15 + 5;
             
             for (let i = 0; i < numBars; i++) {
                 // Fast high-frequency changes like party flash
                 const variance = Math.max(0.1, (Math.sin(currentTime * 20 + i * 1.5) * Math.cos(currentTime * 15 - i * 0.3) * 0.5 + 0.5));
                 let h = visH * normalizedReactivity * variance;
                 h = Math.max(2, Math.min(visH, h));
                 
                 // Add flashes of bright yellow/white on high hits
                 if (h > visH * 0.7 && Math.random() > 0.5) {
                     ctx.fillStyle = '#FFFFFF';
                     ctx.shadowBlur = 20;
                 } else {
                     ctx.fillStyle = '#FFD700';
                     ctx.shadowBlur = 10;
                 }
                 
                 ctx.fillRect(visX + i * (barW + barSpace), visY + (visH - h)/2, barW, h);
             }
             ctx.restore();
         }`;

content = content.replace(
  /if \(config\.style === 'minimal-fast'\) \{\s*ctx\.save\(\);[\s\S]*?ctx\.restore\(\);\s*\}/m,
  visualizerCode
);

fs.writeFileSync('src/engine/RenderEngine.ts', content);
