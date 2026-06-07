import fs from 'fs';
import path from 'path';

export interface RenderJobState {
  id: string;
  status: "pending" | "rendering" | "processing" | "completed" | "failed" | "error" | "paused";
  config: any;
  progress: number;
  error?: string;
  createdAt: number;
  outputPath?: string;
  outputFile?: string;
  timemark?: string;
  uploadedToYouTube?: boolean;
}

const storePath = path.join(process.cwd(), 'jobs.json');

export function loadJobs(): Record<string, RenderJobState> {
    try {
        if (fs.existsSync(storePath)) {
            const data = fs.readFileSync(storePath, 'utf8');
            const jobs = JSON.parse(data);
            // Mark interrupted jobs as error
            for (const id in jobs) {
                 if (jobs[id].status === 'rendering') {
                     jobs[id].status = 'error';
                     jobs[id].error = 'Server restarted during rendering';
                 }
            }
            return jobs;
        }
    } catch(e) {}
    return {};
}

export function saveJobs(jobs: Record<string, RenderJobState>) {
    try {
        fs.writeFileSync(storePath, JSON.stringify(jobs, null, 2), 'utf8');
    } catch(e) {}
}
