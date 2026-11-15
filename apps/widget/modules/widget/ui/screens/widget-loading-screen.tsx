"use client";

import { useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  contactSessionIdAtomFamily,
  contactSessionTokenAtomFamily,
  errorMessageAtom,
  loadingMessageAtom,
  organizationIdAtom,
  screenAtom,
  vapiSecretsAtom,
  widgetSettingsAtom,
} from "@/modules/widget/atoms/widget-atoms";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";

type InitStep = "org" | "session" | "settings" | "vapi" | "done";

const STEP_DATA: Record<InitStep, { index: number; label: string }> = {
  org: { index: 1, label: "Verifying tenant configuration" },
  session: { index: 2, label: "Validating secure session" },
  settings: { index: 3, label: "Loading support engine" },
  vapi: { index: 4, label: "Initializing conversational channels" },
  done: { index: 4, label: "Ready" },
};

export const WidgetLoadingScreen = ({
  organizationId,
}: {
  organizationId: string | null;
}) => {
  const [step, setStep] = useState<InitStep>("org");
  const [sessionValid, setSessionValid] = useState(false);

  const loadingMessage = useAtomValue(loadingMessageAtom);
  const setWidgetSettings = useSetAtom(widgetSettingsAtom);
  const setOrganizationId = useSetAtom(organizationIdAtom);
  const setLoadingMessage = useSetAtom(loadingMessageAtom);
  const setErrorMessage = useSetAtom(errorMessageAtom);
  const setScreen = useSetAtom(screenAtom);
  const setVapiSecrets = useSetAtom(vapiSecretsAtom);

  const contactSessionId = useAtomValue(
    contactSessionIdAtomFamily(organizationId || "")
  );
  const contactSessionToken = useAtomValue(
    contactSessionTokenAtomFamily(organizationId || "")
  );

  // Step 1: Validate organization
  const validateOrganization = useAction(api.public.organizations.validate);
  useEffect(() => {
    if (step !== "org") return;

    setLoadingMessage("Locating tenant profile...");

    if (!organizationId) {
      setErrorMessage("Organization ID is required");
      setScreen("error");
      return;
    }

    setLoadingMessage("Verifying tenant environment...");

    validateOrganization({ organizationId })
      .then((result) => {
        if (result.valid) {
          setOrganizationId(organizationId);
          setStep("session");
        } else {
          setErrorMessage(result.reason || "Invalid configuration");
          setScreen("error");
        }
      })
      .catch(() => {
        setErrorMessage("Unable to verify organization");
        setScreen("error");
      });
  }, [
    step,
    organizationId,
    setErrorMessage,
    setScreen,
    setOrganizationId,
    validateOrganization,
    setLoadingMessage,
  ]);

  // Step 2: Validate session (if exists)
  const validateContactSession = useMutation(api.public.contactSessions.validate);
  useEffect(() => {
    if (step !== "session") return;

    setLoadingMessage("Checking existing session...");

    if (!contactSessionId) {
      setSessionValid(false);
      setStep("settings");
      return;
    }

    setLoadingMessage("Authenticating contact session...");

    validateContactSession({
      contactSessionId: contactSessionId || undefined,
      sessionToken: contactSessionToken || undefined,
      organizationId: organizationId || undefined,
    })
      .then((result) => {
        setSessionValid(result.valid);
        setStep("settings");
      })
      .catch(() => {
        setSessionValid(false);
        setStep("settings");
      });
  }, [
    step,
    contactSessionId,
    contactSessionToken,
    organizationId,
    validateContactSession,
    setLoadingMessage,
  ]);

  // Step 3: Load Widget Settings
  const widgetSettings = useQuery(
    api.public.widgetSettings.getByOrganizationId,
    organizationId ? { organizationId } : "skip"
  );
  useEffect(() => {
    if (step !== "settings") return;

    setLoadingMessage("Loading theme & settings...");

    if (widgetSettings !== undefined) {
      setWidgetSettings(widgetSettings);
      setStep("vapi");
    }
  }, [step, widgetSettings, setWidgetSettings, setLoadingMessage]);

  // Step 4: Load Vapi secrets (Optional)
  const getVapiSecrets = useAction(api.public.secrets.getVapiSecrets);
  useEffect(() => {
    if (step !== "vapi") return;

    if (!organizationId) {
      setErrorMessage("Organization ID is required");
      setScreen("error");
      return;
    }

    setLoadingMessage("Preparing real-time channels...");
    getVapiSecrets({ organizationId })
      .then((secrets) => {
        setVapiSecrets(secrets);
        setStep("done");
      })
      .catch(() => {
        setVapiSecrets(null);
        setStep("done");
      });
  }, [step, organizationId, getVapiSecrets, setVapiSecrets, setLoadingMessage, setErrorMessage, setScreen]);

  useEffect(() => {
    if (step !== "done") return;

    const hasValidSession = contactSessionId && sessionValid;
    setScreen(hasValidSession ? "selection" : "auth");
  }, [step, contactSessionId, sessionValid, setScreen]);

  const currentStep = STEP_DATA[step] || STEP_DATA.org;

  return (
    <div className="flex h-full w-full flex-1 flex-col items-center justify-center p-6 select-none">
      {/* ── 1. UNIQUE DUAL-ORBITAL LOADER ───────────────────────── */}
      <div className="relative flex size-24 items-center justify-center">
        {/* Ambient atmospheric glow */}
        <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-primary/20 via-blue-500/10 to-transparent blur-xl animate-pulse" />

        {/* Outer dashed orbital ring */}
        <div className="absolute inset-0 rounded-full border border-dashed border-primary/40 animate-[spin_8s_linear_infinite]" />

        {/* Outer orbital satellite dot */}
        <div className="absolute inset-0 animate-[spin_5s_linear_infinite]">
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 size-2 rounded-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
        </div>

        {/* Inner counter-rotating gradient accent ring */}
        <div className="absolute inset-2.5 rounded-full border-2 border-transparent border-t-primary border-r-primary/40 animate-[spin_2.5s_linear_infinite_reverse]" />

        {/* Pulsing center emblem core */}
        <div className="relative z-10 flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#1d4ed8] text-white font-black font-mono text-base shadow-[0_4px_20px_rgba(37,99,235,0.4)]">
          <span className="tracking-tighter">A</span>
        </div>
      </div>

      {/* ── 2. UNIQUE LOADER NOTE & TELEMETRY PILL ───────────────── */}
      <div className="mt-8 flex flex-col items-center gap-2.5 max-w-[270px] w-full px-4 py-3 rounded-2xl border border-primary/20 bg-background/90 shadow-sm backdrop-blur-md">
        {/* Telemetry Status Header */}
        <div className="flex items-center gap-2">
          <span className="relative flex size-2 items-center justify-center">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
          </span>
          <span className="font-mono text-[10px] font-bold tracking-wider text-primary uppercase">
            Aivon Runtime • Step 0{currentStep.index}/04
          </span>
        </div>

        {/* Live Dynamic Note */}
        <p className="text-xs font-medium text-foreground/90 text-center leading-snug">
          {loadingMessage || currentStep.label}
        </p>

        {/* 4-Step Segmented Micro-Bar */}
        <div className="flex items-center gap-1.5 w-full pt-1">
          {[1, 2, 3, 4].map((i) => {
            const isCompleted = i < currentStep.index;
            const isCurrent = i === currentStep.index;
            return (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  isCompleted
                    ? "bg-primary"
                    : isCurrent
                    ? "bg-primary animate-pulse"
                    : "bg-muted-foreground/20"
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
