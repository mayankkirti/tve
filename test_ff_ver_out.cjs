var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/@ffmpeg-installer/ffmpeg/lib/verify-file.js
var require_verify_file = __commonJS({
  "node_modules/@ffmpeg-installer/ffmpeg/lib/verify-file.js"(exports2, module2) {
    var fs = require("fs");
    function verifyFile(file) {
      try {
        var stats = fs.statSync(file);
        return stats.isFile();
      } catch (ignored) {
        return false;
      }
    }
    module2.exports = verifyFile;
  }
});

// node_modules/@ffmpeg-installer/ffmpeg/package.json
var require_package = __commonJS({
  "node_modules/@ffmpeg-installer/ffmpeg/package.json"(exports2, module2) {
    module2.exports = {
      name: "@ffmpeg-installer/ffmpeg",
      version: "1.1.0",
      main: "index.js",
      scripts: {
        lint: "jshint *.js",
        preversion: "npm run lint",
        types: "tsc",
        preupload: "npm run types",
        upload: "npm --userconfig=.npmrc publish --access public",
        test: "tsd"
      },
      types: "types/index.d.ts",
      keywords: [
        "ffmpeg",
        "binary",
        "installer",
        "audio",
        "sound"
      ],
      author: "Kristoffer Lund\xE9n <kristoffer.lunden@gmail.com>",
      license: "LGPL-2.1",
      description: "Platform independent binary installer of FFmpeg for node projects",
      optionalDependencies: {
        "@ffmpeg-installer/darwin-arm64": "4.1.5",
        "@ffmpeg-installer/darwin-x64": "4.1.0",
        "@ffmpeg-installer/linux-arm": "4.1.3",
        "@ffmpeg-installer/linux-arm64": "4.1.4",
        "@ffmpeg-installer/linux-ia32": "4.1.0",
        "@ffmpeg-installer/linux-x64": "4.1.0",
        "@ffmpeg-installer/win32-ia32": "4.1.0",
        "@ffmpeg-installer/win32-x64": "4.1.0"
      },
      devDependencies: {
        jshint: "^2.9.3",
        tsd: "^0.14.0",
        typescript: "^4.2.3"
      },
      repository: {
        type: "git",
        url: "git+https://github.com/kribblo/node-ffmpeg-installer.git"
      },
      bugs: {
        url: "https://github.com/kribblo/node-ffmpeg-installer/issues"
      },
      homepage: "https://github.com/kribblo/node-ffmpeg-installer#readme"
    };
  }
});

// node_modules/@ffmpeg-installer/ffmpeg/index.js
var require_ffmpeg = __commonJS({
  "node_modules/@ffmpeg-installer/ffmpeg/index.js"(exports2, module2) {
    "use strict";
    var os = require("os");
    var path = require("path");
    var verifyFile = require_verify_file();
    var platform = os.platform() + "-" + os.arch();
    var packageName = "@ffmpeg-installer/" + platform;
    if (!require_package().optionalDependencies[packageName]) {
      throw "Unsupported platform/architecture: " + platform;
    }
    var binary = os.platform() === "win32" ? "ffmpeg.exe" : "ffmpeg";
    var topLevelPath = path.resolve(__dirname.substr(0, __dirname.indexOf("node_modules")), "node_modules", "@ffmpeg-installer", platform);
    var npm3Path = path.resolve(__dirname, "..", platform);
    var npm2Path = path.resolve(__dirname, "node_modules", "@ffmpeg-installer", platform);
    var topLevelBinary = path.join(topLevelPath, binary);
    var npm3Binary = path.join(npm3Path, binary);
    var npm2Binary = path.join(npm2Path, binary);
    var topLevelPackage = path.join(topLevelPath, "package.json");
    var npm3Package = path.join(npm3Path, "package.json");
    var npm2Package = path.join(npm2Path, "package.json");
    var ffmpegPath;
    var packageJson;
    if (verifyFile(npm3Binary)) {
      ffmpegPath = npm3Binary;
      packageJson = require(npm3Package);
    } else if (verifyFile(npm2Binary)) {
      ffmpegPath = npm2Binary;
      packageJson = require(npm2Package);
    } else if (verifyFile(topLevelBinary)) {
      ffmpegPath = topLevelBinary;
      packageJson = require(topLevelPackage);
    } else {
      throw 'Could not find ffmpeg executable, tried "' + npm3Binary + '", "' + npm2Binary + '" and "' + topLevelBinary + '"';
    }
    var version = packageJson.ffmpeg || packageJson.version;
    var url = packageJson.homepage;
    module2.exports = {
      path: ffmpegPath,
      version,
      url
    };
  }
});

// test_ff_ver.cjs
var import_ffmpeg = __toESM(require_ffmpeg());
var import_child_process = require("child_process");
try {
  console.log((0, import_child_process.execSync)(`${import_ffmpeg.default.path} -version`).toString());
} catch (e) {
  console.log(e);
}
