import express from "express";
import * as path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { startRenderJob, jobs, killRenderJob, pauseRenderJob, resumeRenderJob } from "./src/server/renderer";
import { saveJobs } from "./src/server/jobStore";
import { systemConfig, saveConfig } from "./src/server/config";
import { generateSecret, generateURI, verifySync } from "otplib";
import qrcode from "qrcode";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
const PORT = 3000;

// Authentication Management
let activeTokens = new Set<string>();
try { if (fs.existsSync('active_tokens.json')) activeTokens = new Set(JSON.parse(fs.readFileSync('active_tokens.json', 'utf8'))); } catch(e){}
const saveTokens = () => fs.writeFileSync('active_tokens.json', JSON.stringify([...activeTokens]));

const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path === '/api/login' || req.path === '/api/verify-mfa' || !req.path.startsWith('/api')) {
    return next();
  }
  
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const token = authHeader.split(' ')[1];
  if (!activeTokens.has(token)) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  
  next();
};

app.use(authMiddleware);


app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const expectedUser = process.env.APP_USERNAME || "admin";
  const expectedPass = systemConfig.password;
  if (username === expectedUser && password === expectedPass) {
    if (!systemConfig.totpSecret) {
       systemConfig.totpSecret = generateSecret();
       saveConfig();
       const otpauth = generateURI({ issuer: 'TVE Auth', label: expectedUser, secret: systemConfig.totpSecret });
       const qrCodeUrl = await qrcode.toDataURL(otpauth);
       return res.json({ mfaSetupRequired: true, qrCodeUrl, mfaRequired: true, secret: systemConfig.totpSecret });
    }
    res.json({ mfaRequired: true });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

app.post("/api/verify-mfa", (req, res) => {
  const { code } = req.body;
  if (!systemConfig.totpSecret) { return res.status(400).json({ error: "MFA not set up." }); }
  const isValid = verifySync({ token: code, secret: systemConfig.totpSecret }).valid;
  if (isValid) {
     const token = uuidv4();
     activeTokens.add(token); saveTokens();
     res.json({ token });
  } else {
     res.status(401).json({ error: "Invalid code" });
  }
});

app.post("/api/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
     activeTokens.delete(authHeader.split(' ')[1]); saveTokens();
  }
  res.json({ success: true });
});

// Periodic state save
setInterval(() => {
  saveJobs(jobs);
}, 5000);


app.get("/api/settings", (req, res) => {
  res.json({ diskLimitMB: systemConfig.diskLimitMB });
});

app.put("/api/settings", (req, res) => {
  if (req.body.diskLimitMB !== undefined) {
    systemConfig.diskLimitMB = req.body.diskLimitMB;
  }
  saveConfig();
  res.json({ success: true, diskLimitMB: systemConfig.diskLimitMB });
});

app.put("/api/settings/password", (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (oldPassword === systemConfig.password) {
     systemConfig.password = newPassword;
     saveConfig();
     res.json({ success: true });
  } else {
     res.status(401).json({ error: "Incorrect old password" });
  }
});

app.get("/api/disk", (req, res) => {
  try {
     const files = [];
     const uploadsDir = path.join(process.cwd(), "uploads");
     if (fs.existsSync(uploadsDir)) {
       const uFiles = fs.readdirSync(uploadsDir);
       for (const f of uFiles) {
          const stat = fs.statSync(path.join(uploadsDir, f));
          files.push({ name: f, size: stat.size, mtimeMs: stat.mtimeMs, isVideo: f.endsWith('.mp4') });
       }
     }
     const stats = fs.statfsSync(uploadsDir);
     const freeBytes = stats.bavail * stats.bsize;
     const totalBytes = stats.blocks * stats.bsize;
     res.json({ files, freeBytes, totalBytes, diskLimitMB: systemConfig.diskLimitMB });
  } catch (e: any) {
     res.status(500).json({ error: e.message });
  }
});

app.put("/api/disk/rename", (req, res) => {
  try {
     const { oldName, newName } = req.body;
     const uploadsDir = path.join(process.cwd(), "uploads");
     const oldPath = path.join(uploadsDir, oldName);
     const newPath = path.join(uploadsDir, newName);
     if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
        // update job reference if we have one
        for (const id in jobs) {
           if (jobs[id].outputPath === oldPath) {
             jobs[id].outputPath = newPath;
           }
        }
        res.json({ success: true });
     } else {
        res.status(404).json({ error: "File not found" });
     }
  } catch(e:any) {
     res.status(500).json({ error: e.message });
  }
});

app.delete("/api/disk/:filename", (req, res) => {
   try {
     const file = req.params.filename;
     const uploadsDir = path.join(process.cwd(), "uploads");
     const fp = path.join(uploadsDir, file);
     if (fs.existsSync(fp)) {
        fs.unlinkSync(fp);
        // remove job ref if any
        for (const id in jobs) {
           if (jobs[id].outputPath === fp) {
             jobs[id].outputPath = undefined; // mark gone
           }
        }
        res.json({ success: true });
     } else {
        res.status(404).json({ error: "File not found" });
     }
   } catch(e:any) {
     res.status(500).json({ error: e.message });
   }
});

// Serve files for preview
app.use("/api/uploads", express.static(path.join(process.cwd(), "uploads")));

// Cleanup sweep
setInterval(
  () => {
    const now = Date.now();
    for (const id in jobs) {
      const job = jobs[id];
      // Random arbitrary cleanup after 30 minutes
      if (job.status === "completed" || job.status === "error") {
        if (job.outputPath && fs.existsSync(job.outputPath)) {
          const stats = fs.statSync(job.outputPath);
          if (now - stats.mtimeMs > 30 * 60 * 1000) {
            fs.unlinkSync(job.outputPath);
            delete jobs[id];
          }
        } else {
          delete jobs[id];
        }
      }
    }
  },
  10 * 60 * 1000,
);

// Setup directories
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage });

// Setup chunked upload directories
const chunksDir = path.join(process.cwd(), "chunks");
if (!fs.existsSync(chunksDir)) {
  fs.mkdirSync(chunksDir);
}

app.post("/api/upload-chunk", upload.single("chunk"), (req, res) => {
  
  console.log("Got upload chunk for:", req.body.uploadId, req.body.chunkIndex);
  if (!req.file) {
    console.error("Missing chunk file! body:", req.body);
  }
  const { uploadId, chunkIndex, totalChunks, filename } = req.body;
  if (!req.file) return res.status(400).json({ error: "Missing chunk file" });

  const chunkPath = path.join(chunksDir, `${uploadId}_${chunkIndex}`);
  fs.renameSync(req.file.path, chunkPath);

  // Check if all chunks are uploaded
  let allChunksUploaded = true;
  for (let i = 0; i < parseInt(totalChunks); i++) {
    if (!fs.existsSync(path.join(chunksDir, `${uploadId}_${i}`))) {
      allChunksUploaded = false;
      break;
    }
  }

  if (allChunksUploaded) {
    const ext = path.extname(filename);
    const finalFileId = `${uploadId}${ext}`;
    const finalFilePath = path.join(uploadsDir, finalFileId);

    // Merge chunks
    const writeStream = fs.createWriteStream(finalFilePath);
    for (let i = 0; i < parseInt(totalChunks); i++) {
      const currentChunkPath = path.join(chunksDir, `${uploadId}_${i}`);
      const data = fs.readFileSync(currentChunkPath);
      writeStream.write(data);
      fs.unlinkSync(currentChunkPath);
    }

    writeStream.on("finish", () => {
      res.json({ success: true, fileId: finalFileId, path: finalFilePath });
    });
    writeStream.end();
    return;
  }

  res.json({ success: true, chunkReceived: true });
});

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/cleanup", (req, res) => {
  for (const id in jobs) {
    const job = jobs[id];
    if (job.status === "rendering") {
      killRenderJob(id);
      job.status = "failed";
      job.error = "Cancelled by cleanup";
    }
    delete jobs[id];
  }

  // Clean uploads and chunks
  try {
    if (fs.existsSync(uploadsDir)) {
      const uFiles = fs.readdirSync(uploadsDir);
      for (const f of uFiles) {
        try {
          fs.unlinkSync(path.join(uploadsDir, f));
        } catch (e) {}
      }
    }
    if (fs.existsSync(chunksDir)) {
      const cFiles = fs.readdirSync(chunksDir);
      for (const f of cFiles) {
        try {
          fs.unlinkSync(path.join(chunksDir, f));
        } catch (e) {}
      }
    }
  } catch (e) {
    console.error("Manual cleanup error", e);
  }
  res.json({
    success: true,
    message: "Server memory and backlog have been cleared.",
  });
});


app.post("/api/render", (req, res) => {
  const config = req.body;

  if (!config || !config.audioPath) {
    return res.status(400).json({ error: "Missing audio configuration" });
  }

  const resolveServerPath = (p) => {
      if (typeof p !== 'string') return p;
      let cleanP = p.split('#')[0]; // Remove #video etc
      if (cleanP.includes('/api/uploads/')) {
         return path.join(process.cwd(), "uploads", cleanP.split('/uploads/').pop());
      }
      return cleanP;
  };

  const jobId = uuidv4();

  startRenderJob(jobId, {

    channelName: config.channelName,
    songName: config.songName,
    artistName: config.artistName,
    albumName: config.albumName,
    style: config.style,
    fps: config.fps || 30,
    width: config.resolution?.width || 1280,
    height: config.resolution?.height || 720,
    
    audioPath: resolveServerPath(config.audioPath),
    bgPaths: (config.bgPaths || config.backgroundImages || []).map(resolveServerPath),
    logoPath: config.logoPath ? resolveServerPath(config.logoPath) : config.logoUrl ? resolveServerPath(config.logoUrl) : undefined,

    logoSize: config.logoSize || 100,
    tracklistRaw: config.tracklistRaw || '',
    textSize: config.textSize || 100,
    textFont: config.textFont || 'Inter',
    overlayOpacity: config.overlayOpacity !== undefined ? config.overlayOpacity : 50,
    bgMediaStyle: config.bgMediaStyle || 'tracklist',
    overlayEffect: config.overlayEffect || 'None',
    bypassOverlays: config.bypassOverlays || false,
    bgZoomEnabled: config.bgZoomEnabled || false,
    bgZoomLevel: config.bgZoomLevel || 0,
    brightnessEnabled: config.brightnessEnabled || false,
    brightnessLevel: config.brightnessLevel || 0,
  });

  res.json({ jobId });
});

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs[req.params.id];
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  res.json(job);
});


app.post('/api/jobs/:id/pause', (req, res) => {
  if (jobs[req.params.id] && jobs[req.params.id].status === 'rendering') {
    pauseRenderJob(req.params.id);
  }
  res.json({ success: true });
});

app.post('/api/jobs/:id/resume', (req, res) => {
  if (jobs[req.params.id] && jobs[req.params.id].status === 'paused') {
    resumeRenderJob(req.params.id);
  }
  res.json({ success: true });
});

app.post("/api/jobs/:id/cancel", (req, res) => {
  const job = jobs[req.params.id];
  if (job && job.status === "rendering") {
    killRenderJob(req.params.id);
    job.status = "failed";
    job.error = "Cancelled by user";
  }
  res.json({ success: true });
});

app.get("/api/jobs/:id/logs", (req, res) => {
  const job = jobs[req.params.id];
  if (!job) return res.status(404).json({ error: "Job not found" });
  return res.json({
    jobId: job.id,
    status: job.status,
    error: job.error,
    progress: job.progress,
    outputPath: job.outputPath,
    fileExists: job.outputPath ? fs.existsSync(job.outputPath) : false,
  });
});

app.get("/api/jobs/:id/download", (req, res) => {
  const job = jobs[req.params.id];
  if (!job || job.status !== "completed" || !job.outputPath) {
    return res
      .status(404)
      .send(
        "Video not available. It may have been cleared from memory. Please re-render.",
      );
  }
  if (!fs.existsSync(job.outputPath)) {
    return res.status(500).send(`File not on disk`);
  }
  try {
    const stats = fs.statSync(job.outputPath);
    if (stats.size === 0) {
      return res.status(500).send(`File is empty (0 bytes)`);
    }
  } catch (e: any) {
    return res.status(500).send(`Stat error: ${e.message}`);
  }

  // res.setHeader('X-Accel-Buffering', 'no'); // Removed because this might cause "Unknown Server Error" in Chrome Downloads.
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="Rendered_Video.mp4"',
  );
  res.setHeader("Content-Type", "video/mp4");
  res.sendFile(job.outputPath, (err) => {
    if (err) {
      console.error("Error downloading file:", err);
      if (!res.headersSent) {
        res.status(500).send(`Download error: ${err.message}`);
      }
    }
  });
});

app.get("/api/proxy-flow/:type/:id", async (req, res) => {
  try {
    const { type, id } = req.params;
    if (type !== "video" && type !== "image")
      return res.status(400).send("Invalid type");
    const domain = type === "video" ? "og-video" : "og-image";
    const targetUrl = `https://labs.google/fx/api/${domain}/shared/${id}`;
    const flowRes = await fetch(targetUrl);

    if (!flowRes.ok) return res.status(flowRes.status).send("Failed to fetch");

    res.set("Access-Control-Allow-Origin", "*");
    res.set("Content-Type", flowRes.headers.get("content-type") || "");

    const buffer = await flowRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (e: any) {
    res.status(500).send(e.message);
  }
});

app.post("/api/disk/youtube", async (req, res) => {
  const { filename, title, description, token } = req.body;
  if (!token) return res.status(400).json({ error: "No token provided" });
  
  const fp = path.join(process.cwd(), "uploads", filename);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: "File not found" });

  try {
    const { google } = await import("googleapis");
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    const metadata = { snippet: { title, description: description || "", categoryId: "10" }, status: { privacyStatus: "private" } };
    const result = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: metadata,
      media: { body: fs.createReadStream(fp) }
    });
    res.json({ url: `https://youtube.com/watch?v=${result.data.id}` });
  } catch(e:any) {
    const errorMessage = e.response?.data?.error?.message || e.message;
    res.status(500).json({ error: errorMessage });
  }
});

app.post("/api/jobs/:id/youtube", async (req, res) => {
  const job = jobs[req.params.id];
  if (!job || job.status !== "completed" || !job.outputPath) {
    return res.status(404).json({ error: "Video not available" });
  }
  const { title, description, token } = req.body;
  if (!token) return res.status(400).json({ error: "No token provided" });

  try {
    const { google } = await import("googleapis");
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    const metadata = {
      snippet: {
        title: title || "Rendered Video",
        description: description || "",
        categoryId: "10",
      },
      status: { privacyStatus: "private", selfDeclaredMadeForKids: false },
    };

    const result = await youtube.videos.insert({
      part: ["snippet", "status"],
      notifySubscribers: false,
      requestBody: metadata,
      media: {
        body: fs.createReadStream(job.outputPath),
      },
    });

    const videoId = result.data.id;
    job.uploadedToYouTube = true; // Mark as uploaded
    res.json({ url: `https://youtube.com/watch?v=${videoId}` });
  } catch (e: any) {
    console.error("Youtube upload error", e);
    const errorMessage = e.response?.data?.error?.message || e.message;
    res.status(500).json({ error: errorMessage });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production" && !process.env.PM2_HOME) { // If running in PM2, default to production
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

