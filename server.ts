import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { startRenderJob, jobs } from "./src/server/renderer";

const app = express();
const PORT = process.env.PORT || 3000;

// Cleanup sweep
setInterval(() => {
  const now = Date.now();
  for (const id in jobs) {
    const job = jobs[id];
    // Random arbitrary cleanup after 30 minutes
    if (job.status === 'completed' || job.status === 'error') {
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
}, 10 * 60 * 1000);

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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Setup chunked upload directories
const chunksDir = path.join(process.cwd(), "chunks");
if (!fs.existsSync(chunksDir)) {
  fs.mkdirSync(chunksDir);
}

app.post("/api/upload-chunk", upload.single('chunk'), (req, res) => {
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
    
    writeStream.on('finish', () => {
      res.json({ success: true, fileId: finalFileId, path: finalFilePath });
    });
    writeStream.end();
    return;
  }

  res.json({ success: true, chunkReceived: true });
});

// API Routes
app.post("/api/cleanup", (req, res) => {
  for (const id in jobs) {
    const job = jobs[id];
    if (job.status === 'rendering') {
        // Can't reliably kill ffmpeg instance easily here without storing the process,
        // but we can at least mark as error
        job.status = 'error';
        job.error = "Cancelled by cleanup";
    }
    delete jobs[id];
  }
  
  // Clean uploads and chunks
  try {
     if (fs.existsSync(uploadsDir)) {
       const uFiles = fs.readdirSync(uploadsDir);
       for (const f of uFiles) {
         try { fs.unlinkSync(path.join(uploadsDir, f)); } catch(e){}
       }
     }
     if (fs.existsSync(chunksDir)) {
       const cFiles = fs.readdirSync(chunksDir);
       for (const f of cFiles) {
         try { fs.unlinkSync(path.join(chunksDir, f)); } catch(e){}
       }
     }
  } catch(e) {
     console.error("Manual cleanup error", e);
  }
  res.json({ success: true, message: "Server memory and backlog have been cleared." });
});

app.post("/api/render", (req, res) => {
  const config = req.body;
  
  if (!config || !config.audioPath) {
     return res.status(400).json({ error: "Missing audio configuration" });
  }

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
     audioPath: config.audioPath,
     bgPaths: config.bgPaths || [],
     logoPath: config.logoPath
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

app.get("/api/jobs/:id/logs", (req, res) => {
  const job = jobs[req.params.id];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  return res.json({ 
    jobId: job.id, 
    status: job.status, 
    error: job.error, 
    progress: job.progress,
    outputPath: job.outputPath,
    fileExists: job.outputPath ? fs.existsSync(job.outputPath) : false
  });
});

app.get("/api/jobs/:id/download", (req, res) => {
  const job = jobs[req.params.id];
  if (!job || job.status !== 'completed' || !job.outputPath) {
     return res.status(404).send("Video not available. It may have been cleared from memory. Please re-render.");
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
  res.setHeader('Content-Disposition', 'attachment; filename="Rendered_Video.mp4"');
  res.setHeader('Content-Type', 'video/mp4');
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
    if (type !== 'video' && type !== 'image') return res.status(400).send("Invalid type");
    const domain = type === 'video' ? 'og-video' : 'og-image';
    const targetUrl = `https://labs.google/fx/api/${domain}/shared/${id}`;
    const flowRes = await fetch(targetUrl);
    
    if (!flowRes.ok) return res.status(flowRes.status).send("Failed to fetch");

    res.set("Access-Control-Allow-Origin", "*");
    res.set("Content-Type", flowRes.headers.get("content-type") || "");
    
    const buffer = await flowRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch(e: any) {
    res.status(500).send(e.message);
  }
});

app.post("/api/jobs/:id/youtube", async (req, res) => {
  const job = jobs[req.params.id];
  if (!job || job.status !== 'completed' || !job.outputPath) {
     return res.status(404).json({ error: "Video not available" });
  }
  const { title, description, token } = req.body;
  if (!token) return res.status(400).json({ error: "No token provided" });

  try {
    const { google } = await import('googleapis');
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const metadata = {
      snippet: { title: title || 'Rendered Video', description: description || '', categoryId: '10' },
      status: { privacyStatus: 'private', selfDeclaredMadeForKids: false }
    };

    const result = await youtube.videos.insert({
       part: ['snippet', 'status'],
       notifySubscribers: false,
       requestBody: metadata,
       media: {
           body: fs.createReadStream(job.outputPath)
       }
    });

    const videoId = result.data.id;
    res.json({ url: `https://youtube.com/watch?v=${videoId}` });
  } catch (e: any) {
    console.error("Youtube upload error", e);
    const errorMessage = e.response?.data?.error?.message || e.message;
    res.status(500).json({ error: errorMessage });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
