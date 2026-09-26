import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      return NextResponse.json(
        { error: "Clerk secret key not configured on server" },
        { status: 500 }
      );
    }

    // 1. Look for existing demo user or fetch first matching demo user
    const usersRes = await fetch("https://api.clerk.com/v1/users?limit=10", {
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!usersRes.ok) {
      throw new Error(`Failed to list users from Clerk: ${usersRes.statusText}`);
    }

    const users = await usersRes.json();
    let demoUser = users.find((u: any) =>
      u.email_addresses?.some((e: any) =>
        e.email_address?.toLowerCase().includes("demo")
      )
    );

    // If no demo user found, pick the first user or create one
    if (!demoUser && users.length > 0) {
      demoUser = users[0];
    }

    if (!demoUser) {
      return NextResponse.json(
        { error: "Demo user not found in Clerk" },
        { status: 404 }
      );
    }

    // 2. Fetch or find demo organization
    const orgsRes = await fetch("https://api.clerk.com/v1/organizations?limit=10", {
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
        "Content-Type": "application/json",
      },
    });

    let demoOrgId: string | null = null;
    if (orgsRes.ok) {
      const orgsData = await orgsRes.json();
      const orgs = orgsData.data || orgsData;
      const demoOrg = orgs.find((o: any) =>
        o.name?.toLowerCase().includes("demo")
      );
      if (demoOrg) {
        demoOrgId = demoOrg.id;
      } else if (orgs.length > 0) {
        demoOrgId = orgs[0].id;
      }
    }

    // 3. Create a single-use Sign-In Token (ticket) for the demo user (valid 5 minutes)
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
      const errorDetails = await tokenRes.text();
      throw new Error(`Failed to create sign-in token: ${errorDetails}`);
    }

    const tokenData = await tokenRes.json();

    return NextResponse.json({
      success: true,
      ticket: tokenData.token,
      organizationId: demoOrgId,
      userId: demoUser.id,
    });
  } catch (error: any) {
    console.error("[Demo Auth API] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to initialize demo session" },
      { status: 500 }
    );
  }
}
