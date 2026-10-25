import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";

export const listTenantJobs = query({
  args: {
    status: v.optional(v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("cancelled")
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Identity not found",
      });
    }

    const orgId = identity.orgId as string;
    if (!orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Organization not found",
      });
    }

    const limit = args.limit ?? 25;

    if (args.status) {
      return await ctx.db
        .query("backgroundJobs")
        .withIndex("by_org_and_status", (q) =>
          q.eq("organizationId", orgId).eq("status", args.status!)
        )
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("backgroundJobs")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
      .order("desc")
      .take(limit);
  },
});

export const getJobDetails = query({
  args: {
    jobId: v.id("backgroundJobs"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Identity not found",
      });
    }

    const orgId = identity.orgId as string;
    if (!orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Organization not found",
      });
    }

    const job = await ctx.db.get(args.jobId);
    if (!job || job.organizationId !== orgId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Job not found",
      });
    }

    return job;
  },
});

export const cancelJob = mutation({
  args: {
    jobId: v.id("backgroundJobs"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Identity not found",
      });
    }

    const orgId = identity.orgId as string;
    if (!orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Organization not found",
      });
    }

    const job = await ctx.db.get(args.jobId);
    if (!job || job.organizationId !== orgId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Job not found",
      });
    }

    if (job.status === "succeeded" || job.status === "failed") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Cannot cancel job with terminal status '${job.status}'`,
      });
    }

    await ctx.db.patch(job._id, {
      status: "cancelled",
    });

    return { success: true };
  },
});
