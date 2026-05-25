/**
 * In-memory storage for async pipeline jobs.
 * Jobs are lost on server restart.
 */
const pipelineJobs = new Map();

function generateJobId() {
  return `dna-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createJob() {
  const jobId = generateJobId();
  const job = {
    jobId,
    status: 'pending',
    progress: null,
    result: null,
    error: null,
    createdAt: new Date().toISOString(),
  };
  pipelineJobs.set(jobId, job);
  return jobId;
}

function getJob(jobId) {
  return pipelineJobs.get(jobId) || null;
}

function updateJob(jobId, updates) {
  const job = pipelineJobs.get(jobId);
  if (job) {
    Object.assign(job, updates);
  }
}

module.exports = {
  pipelineJobs,
  createJob,
  getJob,
  updateJob,
};
