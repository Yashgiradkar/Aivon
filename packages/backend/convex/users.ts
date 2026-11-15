import { ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getMany = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null || !identity.orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Organization not found",
      });
    }

    // This legacy development table does not include organizationId. Returning
    // it would leak data across tenants, so keep the public API inert until the
    // table is replaced with a tenant-scoped implementation.
    return [];
  },
});

export const add = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (identity === null) {
      throw new Error("Not authenticated");
    }

    const orgId = identity.orgId as string;

    if (!orgId) {
      throw new Error("Missing organization");
    }

    if (process.env.SENTRY_EXAMPLE_ERRORS !== "true") {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Not found",
      });
    }

    throw new Error("Tracking test");

    const userId = await ctx.db.insert("users", {
      name: "Antonio",
    });

    return userId;
  },
});
