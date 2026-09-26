"use client";

import { WidgetHeader } from "@/modules/widget/ui/components/widget-header";
import { Button } from "@workspace/ui/components/button";
import { useAtomValue, useSetAtom } from "jotai";
import { ChevronRightIcon, HeadsetIcon, MessageSquareTextIcon, MicIcon, PhoneIcon } from "lucide-react";
import { contactSessionIdAtomFamily, conversationIdAtom, errorMessageAtom, hasVapiSecretsAtom, organizationIdAtom, screenAtom, widgetSettingsAtom } from "../../atoms/widget-atoms";
import { useMutation, useQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { useState } from "react";
import { WidgetFooter } from "../components/widget-footer";

export const WidgetSelectionScreen = () => {
  const setScreen = useSetAtom(screenAtom);
  const setErrorMessage = useSetAtom(errorMessageAtom);
  const setConversationId = useSetAtom(conversationIdAtom);

  const widgetSettings = useAtomValue(widgetSettingsAtom);
  const hasVapiSecrets = useAtomValue(hasVapiSecretsAtom);
  const organizationId = useAtomValue(organizationIdAtom);
  const contactSessionId = useAtomValue(
    contactSessionIdAtomFamily(organizationId || "")
  );

  const createConversation = useMutation(api.public.conversations.create);
  const joinQueue = useMutation(api.public.queue.join);
  const availability = useQuery(
    api.public.queue.getAvailability,
    organizationId ? { organizationId } : "skip"
  );

  const [isPending, setIsPending] = useState(false);

  const handleNewConversation = async () => {
    if (!organizationId) {
      setScreen("error");
      setErrorMessage("Missing Organization ID");
      return;
    }
    
    if (!contactSessionId) {
      setScreen("auth");
      return;
    }
    
    setIsPending(true);
    try {
      const conversationId = await createConversation({
        contactSessionId,
        organizationId,
      });

      setConversationId(conversationId);
      setScreen("chat");
    } catch {
      setScreen("auth");
    } finally {
      setIsPending(false);
    }
  };

  const handleTalkToSpecialist = async () => {
    if (!organizationId) {
      setScreen("error");
      setErrorMessage("Missing Organization ID");
      return;
    }

    if (!contactSessionId) {
      setScreen("auth");
      return;
    }

    setIsPending(true);
    try {
      const conversationId = await createConversation({
        contactSessionId,
        organizationId,
      });

      setConversationId(conversationId);
      await joinQueue({
        conversationId,
        contactSessionId,
      });
      setScreen("chat");
    } catch {
      setScreen("auth");
    } finally {
      setIsPending(false);
    }
  };

  const hasVoice =
    Boolean(hasVapiSecrets || process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY) &&
    Boolean(widgetSettings?.vapiSettings?.assistantId || process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID);

  return (
    <>
      <WidgetHeader>
        <div className="flex flex-col justify-between gap-y-2 px-2 py-6 font-semibold">
          <p className="text-3xl">
            Hi there! 👋
          </p>
          <p className="text-lg">
            Let&apos;s get you started
          </p>
        </div>
      </WidgetHeader>
      <div className="flex flex-1 flex-col gap-y-3 p-4 overflow-y-auto">
        <Button
          className="h-16 w-full justify-between"
          variant="outline"
          onClick={handleNewConversation}
          disabled={isPending}
        >
          <div className="flex items-center gap-x-3 text-left">
            <MessageSquareTextIcon className="size-5 text-primary" />
            <div>
              <p className="font-medium text-sm">Start chat</p>
              <p className="text-xs text-muted-foreground">Instant answers with AI assistant</p>
            </div>
          </div>
          <ChevronRightIcon />
        </Button>

        <Button
          className="h-16 w-full justify-between border-primary/30 hover:border-primary"
          variant="outline"
          onClick={handleTalkToSpecialist}
          disabled={isPending}
        >
          <div className="flex items-center gap-x-3 text-left">
            <HeadsetIcon className="size-5 text-primary" />
            <div>
              <p className="font-medium text-sm">Talk to a support specialist</p>
              <p className="text-xs text-muted-foreground">
                {availability
                  ? `${availability.availableAgentsCount} online • ${
                      availability.canConnectImmediately
                        ? "Connect immediately"
                        : `~${Math.max(1, Math.ceil(availability.estimatedWaitSeconds / 60))} min wait`
                    }`
                  : "Connect with human team"}
              </p>
            </div>
          </div>
          <ChevronRightIcon />
        </Button>

        {(hasVoice || hasVapiSecrets || process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY) && (
          <Button
            className="h-16 w-full justify-between"
            variant="outline"
            onClick={() => setScreen("voice")}
            disabled={isPending}
          >
            <div className="flex items-center gap-x-3 text-left">
              <MicIcon className="size-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Start voice call</p>
                <p className="text-xs text-muted-foreground">Speak directly with AI voice</p>
              </div>
            </div>
            <ChevronRightIcon />
          </Button>
        )}

        {hasVapiSecrets && widgetSettings?.vapiSettings?.phoneNumber && (
          <Button
            className="h-16 w-full justify-between"
            variant="outline"
            onClick={() => setScreen("contact")}
            disabled={isPending}
          >
            <div className="flex items-center gap-x-3 text-left">
              <PhoneIcon className="size-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Call us</p>
                <p className="text-xs text-muted-foreground">{widgetSettings.vapiSettings.phoneNumber}</p>
              </div>
            </div>
            <ChevronRightIcon />
          </Button>
        )}
      </div>
      <WidgetFooter />
    </>
  );
};
