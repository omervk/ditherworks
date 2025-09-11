import type { ServerResponse } from 'node:http';

export type ProgressEvent = {
  type: 'init' | 'progress' | 'complete' | 'error';
  current: number;
  total: number;
  fileName?: string;
  message?: string;
};

type JobState = {
  jobId: string;
  total: number;
  current: number;
  status: 'pending' | 'running' | 'completed' | 'error';
  listeners: Set<ServerResponse>;
};

const jobs = new Map<string, JobState>();

function writeSseEvent(res: ServerResponse, event: ProgressEvent) {
  try {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  } catch {
    // ignore write errors (client disconnected)
  }
}

export function subscribe(jobId: string, res: ServerResponse) {
  let job = jobs.get(jobId);
  if (!job) {
    job = { jobId, total: 0, current: 0, status: 'pending', listeners: new Set() };
    jobs.set(jobId, job);
  }

  job.listeners.add(res);

  // Send initial snapshot
  writeSseEvent(res, { type: 'init', current: job.current, total: job.total });

  return () => {
    const j = jobs.get(jobId);
    if (j) {
      j.listeners.delete(res);
      try { res.end(); } catch {}
      if (j.listeners.size === 0 && (j.status === 'completed' || j.status === 'error')) {
        jobs.delete(jobId);
      }
    }
  };
}

export function startJob(jobId: string, total: number) {
  let job = jobs.get(jobId);
  if (!job) {
    job = { jobId, total, current: 0, status: 'running', listeners: new Set() };
    jobs.set(jobId, job);
  } else {
    job.total = total;
    job.current = 0;
    job.status = 'running';
  }
  const snapshot: ProgressEvent = { type: 'init', current: job.current, total: job.total };
  for (const l of job.listeners) writeSseEvent(l, snapshot);
}

export function reportProgress(jobId: string, current: number, total: number, fileName?: string) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.current = current;
  job.total = total;
  const evt: ProgressEvent = { type: 'progress', current, total, fileName };
  for (const l of job.listeners) writeSseEvent(l, evt);
}

export function completeJob(jobId: string) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = 'completed';
  const evt: ProgressEvent = { type: 'complete', current: job.current, total: job.total };
  for (const l of job.listeners) writeSseEvent(l, evt);
  // End all listeners and cleanup
  for (const l of job.listeners) {
    try { l.end(); } catch {}
  }
  jobs.delete(jobId);
}

export function errorJob(jobId: string, message: string) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = 'error';
  const evt: ProgressEvent = { type: 'error', current: job.current, total: job.total, message };
  for (const l of job.listeners) writeSseEvent(l, evt);
  for (const l of job.listeners) {
    try { l.end(); } catch {}
  }
  jobs.delete(jobId);
}


