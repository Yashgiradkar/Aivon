"use client";

import { SignIn, useSignIn } from "@clerk/nextjs";
import { Button } from "@workspace/ui/components/button";
import { ArrowRightIcon, Loader2Icon, SparklesIcon, ShieldCheckIcon } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export const SignInView = () => {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const router = useRouter();

  const handleDemoSignIn = async () => {
    if (!isLoaded || !signIn) return;

    setIsDemoLoading(true);
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to initialize demo session");
      }

      const { ticket, organizationId } = await res.json();

      // Authenticate directly via Clerk single-use sign-in ticket
      const signInAttempt = await signIn.create({
        strategy: "ticket",
        ticket,
      });

      if (signInAttempt.status === "complete") {
        await setActive({
          session: signInAttempt.createdSessionId,
          organization: organizationId || undefined,
        });

        toast.success("Welcome to Aivon Demo!");
        router.push("/conversations");
      } else {
        throw new Error("Sign-in verification incomplete");
      }
    } catch (error: any) {
      console.error("[Demo Login Error]:", error);
      toast.error(error?.message || "Unable to start demo. Please try standard sign-in.");
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-y-6 w-full max-w-sm mx-auto">
      {/* Recruiter / One-Click Demo Card */}
      <div className="w-full rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-background p-5 text-center shadow-lg transition-all hover:border-primary/40">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary mb-2">
          <SparklesIcon className="h-3.5 w-3.5" />
          Recruiter & Preview Access
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Explore Aivon</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          No signup · No personal information required
        </p>

        <Button
          type="button"
          size="lg"
          className="mt-4 w-full gap-2 rounded-xl font-semibold shadow-md transition-all hover:scale-[1.01]"
          onClick={handleDemoSignIn}
          disabled={isDemoLoading || !isLoaded}
        >
          {isDemoLoading ? (
            <>
              <Loader2Icon className="h-4 w-4 animate-spin" />
              Preparing Demo Environment...
            </>
          ) : (
            <>
              Continue as Demo
              <ArrowRightIcon className="h-4 w-4" />
            </>
          )}
        </Button>

        <div className="mt-3 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
          <ShieldCheckIcon className="h-3.5 w-3.5 text-green-500" />
          <span>Isolated synthetic workspace</span>
        </div>
      </div>

      <div className="relative w-full">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or sign in with account</span>
        </div>
      </div>

      {/* Standard Clerk Sign In */}
      <SignIn routing="hash" />
    </div>
  );
};