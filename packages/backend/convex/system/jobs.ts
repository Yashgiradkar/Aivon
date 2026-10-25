import { v } from "convex/values";
import { internalMutation, internalQuery, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { JobRunnerLogic } from "./jobs/jobRunner";
import { MemoryManagerLogic } from "./ai/memory/memoryManager";
import { Id } from "../_generated/dataModel";

// ---------------------------------------------------------------------------
// Enqueue a durable background job (with idempotency and duplicate checking)
// ---------------------------------------------------------------------------
export const enqueueJob = internalMutation({
  args: {
    organizationId: v.string(),
    jobType: v.union(
      v.literal("document_ingestion"),
      v.literal("evaluation_batch"),
      v.literal("memory_extraction"),
      v.literal("cache_maintenance")
    ),
    payload: v.string(),
    idempotencyKey: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("low"), v.literal("normal"), v.literal("high"))),
    maxAttempts: v.optional(v.number()),
    delayMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const idKey = args.idempotencyKey ?? `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const maxAttempts = args.maxAttempts ?? JobRunnerLogic.DEFAULT_MAX_ATTEMPTS;
    const scheduledFor = now + (args.delayMs ?? 0);

    // Idempotency check: see if a job with the same idempotency key already exists
    const existing = await ctx.db
      .query("backgroundJobs")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", idKey))
      .first();

    if (existing && existing.organizationId === args.organizationId) {
      if (existing.status !== "failed") {
        return existing._id;
      }
    }

    const jobId = await ctx.db.insert("backgroundJobs", {
      organizationId: args.organizationId,
      jobType: args.jobType,
      priority: args.priority ?? "normal",
      idempotencyKey: idKey,
      status: "queued",
      attempts: 0,
      maxAttempts,
      payload: args.payload,
      progress: 0,
      scheduledFor,
      createdAt: now,
    });

    // Schedule execution via Convex scheduler
    await ctx.scheduler.runAfter(args.delayMs ?? 0, internal.system.jobs.executeJob, {
      jobId,
    });

    return jobId;
  },
});

// ---------------------------------------------------------------------------
// Claim and transition job to running
// ---------------------------------------------------------------------------
export const claimJob = internalMutation({
  args: {
    jobId: v.id("backgroundJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.status !== "queued") {
      return null;
    }

    const now = Date.now();
    if (job.scheduledFor > now) {
      return null;
    }

    // Check tenant concurrency
    const runningJobs = await ctx.db
      .query("backgroundJobs")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organizationId", job.organizationId).eq("status", "running")
      )
      .collect();

    if (JobRunnerLogic.isConcurrencyExceeded(runningJobs.length)) {
      // Defer execution by 3 seconds if tenant is at maximum concurrency
      await ctx.db.patch(job._id, {
        scheduledFor: now + 3000,
      });
      return null;
    }

    await ctx.db.patch(job._id, {
      status: "running",
      attempts: job.attempts + 1,
      startedAt: now,
    });

    return await ctx.db.get(job._id);
  },
});

// ---------------------------------------------------------------------------
// Update job progress (0 - 100)
// ---------------------------------------------------------------------------
export const updateProgress = internalMutation({
  args: {
    jobId: v.id("backgroundJobs"),
    progress: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      progress: Math.min(100, Math.max(0, args.progress)),
    });
  },
});

// ---------------------------------------------------------------------------
// Mark job succeeded
// ---------------------------------------------------------------------------
export const markJobSucceeded = internalMutation({
  args: {
    jobId: v.id("backgroundJobs"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.jobId, {
      status: "succeeded",
      progress: 100,
      completedAt: now,
    });
  },
});

// ---------------------------------------------------------------------------
// Mark job failed or schedule retry
// ---------------------------------------------------------------------------
export const markJobFailed = internalMutation({
  args: {
    jobId: v.id("backgroundJobs"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    const now = Date.now();
    const sanitizedError = JobRunnerLogic.sanitizeError(args.error);

    if (job.attempts < job.maxAttempts) {
      const delayMs = JobRunnerLogic.computeNextRetry(job.attempts);
      await ctx.db.patch(job._id, {
        status: "queued",
        error: sanitizedError,
        scheduledFor: now + delayMs,
      });

      // Reschedule retry
      await ctx.scheduler.runAfter(delayMs, internal.system.jobs.executeJob, {
        jobId: job._id,
      });
    } else {
      // Terminal failure
      await ctx.db.patch(job._id, {
        status: "failed",
        error: sanitizedError,
        completedAt: now,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Execution Action (dispatcher)
// ---------------------------------------------------------------------------
export const executeJob = internalAction({
  args: {
    jobId: v.id("backgroundJobs"),
  },
  handler: async (ctx, args) => {
    // Atomically claim job
    const job = await ctx.runMutation(internal.system.jobs.claimJob, {
      jobId: args.jobId,
    });

    if (!job) {
      return; // Already claimed, not ready, or delayed due to concurrency limit
    }

    try {
      await ctx.runMutation(internal.system.jobs.updateProgress, {
        jobId: job._id,
        progress: 10,
      });

      // Dispatch based on job type
      if (job.jobType === "memory_extraction") {
        let payload: {
          organizationId: string;
          customerIdentifier: string;
          conversationId?: string;
          text: string;
        };

        try {
          payload = JSON.parse(job.payload);
        } catch {
          payload = {
            organizationId: job.organizationId,
            customerIdentifier: "unknown",
            text: job.payload,
          };
        }

        if (payload && payload.text) {
          const candidates = MemoryManagerLogic.extractCandidateMemories(payload.text);
          for (const candidate of candidates) {
            await ctx.runMutation(internal.system.memory.upsertMemory, {
              organizationId: payload.organizationId,
              customerIdentifier: payload.customerIdentifier,
              memoryType: candidate.memoryType,
              key: candidate.key,
              content: candidate.content,
              confidence: candidate.confidence,
              source: `conversation_${payload.conversationId ?? "direct"}`,
              conversationId: payload.conversationId ? (payload.conversationId as Id<"conversations">) : undefined,
            });
          }
        }
      } else if (job.jobType === "cache_maintenance") {
        await ctx.runMutation(internal.system.cache.invalidateOrgCache, {
          organizationId: job.organizationId,
        });
      }

      await ctx.runMutation(internal.system.jobs.markJobSucceeded, {
        jobId: job._id,
      });
    } catch (err) {
      const sanitized = JobRunnerLogic.sanitizeError(err);
      await ctx.runMutation(internal.system.jobs.markJobFailed, {
        jobId: job._id,
        error: sanitized,
      });
    }
  },
});
