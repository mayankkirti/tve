const fs = require('fs');

let code = fs.readFileSync('src/server/renderer.ts', 'utf8');

code = code.replace(
  'const fontPath = path.join(process.cwd(), "public", fontFile).replace(/\\\\/g, "/");',
  `const fontPath = path.join(process.cwd(), "public", fontFile).replace(/\\\\/g, "/");\n    const fontPathItalic = fs.existsSync(path.join(process.cwd(), "public", "font_italic.ttf")) ? path.join(process.cwd(), "public", "font_italic.ttf").replace(/\\\\/g, "/") : fontPath;\n    const fontPathBold = fs.existsSync(path.join(process.cwd(), "public", "font_bold.ttf")) ? path.join(process.cwd(), "public", "font_bold.ttf").replace(/\\\\/g, "/") : fontPath;`
);

code = code.replace(
  /if\(trk\.songName\) addTextOptions\.push\("drawtext=" \+ enable \+ "fontfile='" \+ fontPath \+ "':text='" \+ escapeText\(trk\.songName\)/g,
  `if(trk.songName) addTextOptions.push("drawtext=" + enable + "fontfile='" + fontPathBold + "':text='" + escapeText(trk.songName)`
);

code = code.replace(
  /if \(config\.songName\) addTextOptions\.push\("drawtext=fontfile='" \+ fontPath \+ "':text='" \+ escapeText\(config\.songName\)/g,
  `if (config.songName) addTextOptions.push("drawtext=fontfile='" + fontPathBold + "':text='" + escapeText(config.songName)`
);

code = code.replace(
  /if\(config\.albumName\) addTextOptions\.push\("drawtext=fontfile='" \+ fontPath \+ "':text='" \+ escapeText\(config\.albumName\)/g,
  `if(config.albumName) addTextOptions.push("drawtext=fontfile='" + fontPathItalic + "':text='" + escapeText(config.albumName)`
);

code = code.replace(
  /if \(config\.albumName\) addTextOptions\.push\("drawtext=fontfile='" \+ fontPath \+ "':text='" \+ escapeText\(config\.albumName\)/g,
  `if (config.albumName) addTextOptions.push("drawtext=fontfile='" + fontPathItalic + "':text='" + escapeText(config.albumName)`
);

code = code.replace(
  'const yVal = 50 + Math.floor(120 * ((config.logoSize || 100) / 100)) / 2;',
  'const yVal = 25 + Math.floor(120 * ((config.logoSize || 100) / 100)) / 2;'
);

code = code.replace(
  '[bgviz][logo]overlay=W-w-50:50[final1];',
  '[bgviz][logo]overlay=W-w-50:25[final1];'
);

code = code.replace(
  'case "indian-ambient":\n        vizFilter = `avectorscope=s=${config.width}x${config.height}:draw=line:zoom=2`;',
  'case "indian-ambient":\n        vizFilter = `avectorscope=s=${config.width}x${config.height}:draw=line:zoom=2:rc=255:gc=210:bc=50:ac=255`;'
);

code = code.replace(
  'case "chillout-flash":\n        vizFilter = `avectorscope=s=${config.width}x${config.height}:draw=line:zoom=2`;',
  'case "chillout-flash":\n        vizFilter = `avectorscope=s=${config.width}x${config.height}:draw=line:zoom=2:rc=210:gc=160:bc=150:ac=255`;'
);

fs.writeFileSync('src/server/renderer.ts', code);

let reCode = fs.readFileSync('src/engine/RenderEngine.ts', 'utf8');
reCode = reCode.replace(
   'ctx.fillText(config.channelName, padding, padding + logoSize / 2);',
   'ctx.fillText(config.channelName, padding, padding/2 + logoSize / 2);'
);
reCode = reCode.replace(
   'ctx.drawImage(logoImg, canvas.width - padding - logoSize, padding, logoSize, logoSize);',
   'ctx.drawImage(logoImg, canvas.width - padding - logoSize, padding/2, logoSize, logoSize);'
);
fs.writeFileSync('src/engine/RenderEngine.ts', reCode);

let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace(
  'className="absolute top-4 left-6 h-16 flex items-center text-white z-10 drop-shadow-md"',
  'className="absolute top-2 left-6 h-16 flex items-center text-white z-10 drop-shadow-md"'
);
appCode = appCode.replace(
  'className="absolute top-4 right-6 w-16 h-16 object-contain z-10"',
  'className="absolute top-2 right-6 w-16 h-16 object-contain z-10"'
);
fs.writeFileSync('src/App.tsx', appCode);

console.log('patched');
