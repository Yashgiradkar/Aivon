import { NextResponse } from "next/server";

const demoAttempts = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const recent = (demoAttempts.get(key) ?? []).filter((ts) => now - ts < windowMs);
  if (recent.length >= 5) {
    demoAttempts.set(key, recent);
    return true;
  }
  recent.push(now);
  demoAttempts.set(key, recent);
  return false;
}

export async function POST(req: Request) {
  if (process.env.DEMO_AUTH_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Extract client IP safely (take first IP in comma-separated list, sanitize)
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  const clientKey = (forwardedFor || realIp || "anonymous").replace(/[^a-zA-Z0-9.:_-]/g, "").slice(0, 64);
  if (isRateLimited(clientKey)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    const demoUserEmail = process.env.DEMO_USER_EMAIL?.trim().toLowerCase();
    const demoOrganizationId = process.env.DEMO_ORGANIZATION_ID?.trim();
    if (!clerkSecretKey || !demoUserEmail || !demoOrganizationId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const usersRes = await fetch(
      `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(demoUserEmail)}&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${clerkSecretKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!usersRes.ok) {
      return NextResponse.json({ error: "Demo unavailable" }, { status: 503 });
    }

    const users = await usersRes.json();
    const demoUser = Array.isArray(users) ? users[0] : users?.data?.[0];
    if (!demoUser?.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const tokenRes = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: demoUser.id,
        expires_in_seconds: 300,
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.json({ error: "Demo unavailable" }, { status: 503 });
    }

    const tokenData = await tokenRes.json();
    return NextResponse.json({
      success: true,
      ticket: tokenData.token,
      organizationId: demoOrganizationId,
    });
  } catch {
    return NextResponse.json({ error: "Demo unavailable" }, { status: 503 });
  }
}
