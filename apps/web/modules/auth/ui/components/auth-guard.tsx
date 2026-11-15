"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { AuthLayout } from "../layouts/auth-layout";
import { SignInView } from "../views/sign-in-view";
import { TechLoader } from "@/components/tech-loader";

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <AuthLoading>
        <AuthLayout>
          <TechLoader
            title="Authenticating Session"
            description="Verifying cryptographic tokens and tenant authorization..."
            delayMs={100}
          />
        </AuthLayout>
      </AuthLoading>
      <Authenticated>
        {children}
      </Authenticated>
      <Unauthenticated>
        <AuthLayout>
          <SignInView />
        </AuthLayout>
      </Unauthenticated>
    </>
  );
};
