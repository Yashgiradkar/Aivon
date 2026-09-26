"use client";

import { AISuggestion, AISuggestions } from "@workspace/ui/components/ai/suggestion";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { useThreadMessages, toUIMessages } from "@convex-dev/agent/react";
import { WidgetHeader } from "@/modules/widget/ui/components/widget-header";
import { Button } from "@workspace/ui/components/button";
import { useAtomValue, useSetAtom } from "jotai";
import { ArrowLeftIcon, MenuIcon, MicIcon } from "lucide-react";
import { DicebearAvatar } from "@workspace/ui/components/dicebear-avatar";
import { cn } from "@workspace/ui/lib/utils";
import { useInfiniteScroll } from "@workspace/ui/hooks/use-infinite-scroll";
import { InfiniteScrollTrigger } from "@workspace/ui/components/infinite-scroll-trigger";
import { contactSessionIdAtomFamily, conversationIdAtom, hasVapiSecretsAtom, organizationIdAtom, screenAtom, widgetSettingsAtom } from "../../atoms/widget-atoms";
import { useAction, useQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { Form, FormField } from "@workspace/ui/components/form";
import {
  AIConversation,
  AIConversationContent,
  AIConversationScrollButton,
} from "@workspace/ui/components/ai/conversation";
import {
  AIInput,
  AIInputSubmit,
  AIInputTextarea,
  AIInputToolbar,
  AIInputTools,
} from "@workspace/ui/components/ai/input";
import { AIMessage, AIMessageContent } from "@workspace/ui/components/ai/message";
import { AIResponse } from "@workspace/ui/components/ai/response";
import { useMemo, useState } from "react";
import { WidgetQueueBanner } from "../components/widget-queue-banner";
import { WidgetCallbackDialog } from "../components/widget-callback-dialog";
import { WidgetCallLogs } from "../components/widget-call-logs";
import { HeadsetIcon, PhoneForwardedIcon, MessageSquareIcon, AlertCircleIcon } from "lucide-react";
import { useMutation } from "convex/react";

const formSchema = z.object({
  message: z.string().min(1, "Message is required"),
});

export const WidgetChatScreen = () => {
  const setScreen = useSetAtom(screenAtom);
  const setConversationId = useSetAtom(conversationIdAtom);

  const [callbackOpen, setCallbackOpen] = useState(false);

  const widgetSettings = useAtomValue(widgetSettingsAtom);
  const conversationId = useAtomValue(conversationIdAtom);
  const organizationId = useAtomValue(organizationIdAtom);
  const hasVapiSecrets = useAtomValue(hasVapiSecretsAtom);
  const contactSessionId = useAtomValue(
    contactSessionIdAtomFamily(organizationId || "")
  );

  const maxMessages = widgetSettings?.maxMessagesPerConversation ?? 20;

  const joinQueue = useMutation(api.public.queue.join);

  const handleRequestHuman = async () => {
    if (!conversationId || !contactSessionId) return;
    try {
      await joinQueue({
        conversationId,
        contactSessionId,
      });
    } catch (err) {
      console.error("Failed to join queue:", err);
    }
  };

  // Voice is available when Vapi is configured (secrets + assistantId) or env fallbacks exist
  const hasVoice =
    Boolean(hasVapiSecrets || process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY) &&
    Boolean(widgetSettings?.vapiSettings?.assistantId || process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID);

  const onBack = () => {
    setConversationId(null);
    setScreen("selection");
  };

  const suggestions = useMemo(() => {
    if (!widgetSettings) {
      return [];
    }

    return Object.keys(widgetSettings.defaultSuggestions).map((key) => {
      return widgetSettings.defaultSuggestions[
        key as keyof typeof widgetSettings.defaultSuggestions
      ];
    });
  }, [widgetSettings]);

  const conversation = useQuery(
    api.public.conversations.getOne,
    conversationId && contactSessionId
      ? {
          conversationId,
          contactSessionId,
        } 
      : "skip"
  );

  const messages = useThreadMessages(
    api.public.messages.getMany,
    conversation?.threadId && contactSessionId
      ? {
          threadId: conversation.threadId,
          contactSessionId,
        }
      : "skip",
    { initialNumItems: 10 },
  );

  const messageCount = messages.results?.length ?? 0;
  const isLimitReached = messageCount >= maxMessages;

  const { topElementRef, handleLoadMore, canLoadMore, isLoadingMore } = useInfiniteScroll({
    status: messages.status,
    loadMore: messages.loadMore,
    loadSize: 10,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      message: "",
    },
  });

  const createMessage = useAction(api.public.messages.create);
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!conversation || !contactSessionId) {
      return;
    }

    if (isLimitReached) {
      return;
    }

    form.reset();

    try {
      await createMessage({
        threadId: conversation.threadId,
        prompt: values.message,
        contactSessionId,
      });
    } catch (err: any) {
      console.error("Failed to send message:", err);
    }
  };

  return (
    <>
      <WidgetCallbackDialog open={callbackOpen} onOpenChange={setCallbackOpen} />
      <WidgetHeader className="flex items-center justify-between">
        <div className="flex items-center gap-x-2">
          <Button
            onClick={onBack}
            size="icon"
            variant="transparent"
          >
            <ArrowLeftIcon />
          </Button>
          <p className="font-medium">Chat</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1 px-2 text-xs"
            onClick={handleRequestHuman}
            title="Request a human specialist"
          >
            <HeadsetIcon className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Human</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1 px-2 text-xs"
            onClick={() => setCallbackOpen(true)}
            title="Request a callback"
          >
            <PhoneForwardedIcon className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Callback</span>
          </Button>
        </div>
      </WidgetHeader>
      <WidgetQueueBanner />
      {conversationId && contactSessionId && (
        <WidgetCallLogs
          conversationId={conversationId}
          contactSessionId={contactSessionId}
        />
      )}
      <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <MessageSquareIcon className="size-3 text-primary" />
          <span>Messages: <strong className="font-semibold text-foreground">{messageCount}</strong> / {maxMessages}</span>
        </div>
        <span className="text-[10px] text-muted-foreground/75">Token Saver Mode</span>
      </div>
      <AIConversation>
        <AIConversationContent>
          <InfiniteScrollTrigger
            canLoadMore={canLoadMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={handleLoadMore}
            ref={topElementRef}
          />
          {toUIMessages(messages.results ?? [])?.map((message) => {
            return (
              <AIMessage
                from={message.role === "user" ? "user" : "assistant"}
                key={message.id}
              >
                <AIMessageContent>
                  <AIResponse>{message.content}</AIResponse>
                </AIMessageContent>
                {message.role === "assistant" && (
                  <DicebearAvatar
                    imageUrl="/logo.svg"
                    seed="assistant"
                    size={32}
                  />
                )}
              </AIMessage>
            )
          })}
        </AIConversationContent>
      </AIConversation>
      {toUIMessages(messages.results ?? [])?.length === 1 && (
        <AISuggestions className="flex w-full flex-col items-end p-2">
          {suggestions.map((suggestion) => {
            if (!suggestion) {
              return null;
            }

            return (
              <AISuggestion
                key={suggestion}
                onClick={() => {
                  form.setValue("message", suggestion, {
                    shouldValidate: true,
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                  form.handleSubmit(onSubmit)();
                }}
                suggestion={suggestion}
              />
            )
          })}
        </AISuggestions>
      )}
      {isLimitReached && (
        <div className="mx-3 my-1.5 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Message Limit Reached ({maxMessages}/{maxMessages})</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              To keep responses fast and save tokens, please connect with a live human specialist or request a callback above.
            </p>
          </div>
        </div>
      )}
      <Form {...form}>
          <AIInput
            className="rounded-none border-x-0 border-b-0"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              disabled={conversation?.status === "resolved" || isLimitReached}
              name="message"
              render={({ field }) => (
                <AIInputTextarea
                  disabled={conversation?.status === "resolved" || isLimitReached}
                  onChange={field.onChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      form.handleSubmit(onSubmit)();
                    }
                  }}
                  placeholder={
                    conversation?.status === "resolved"
                      ? "This conversation has been resolved."
                      : isLimitReached
                      ? `Message limit reached (${maxMessages}/${maxMessages}). Please request human support.`
                      : "Type your message..."
                  }
                  value={field.value}
                />
              )}
            />
            <AIInputToolbar>
              <AIInputTools>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "h-8 w-8 transition-colors",
                    hasVoice ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setScreen("voice")}
                  aria-label="Switch to voice chat"
                  title="Switch to voice chat"
                >
                  <MicIcon className="h-4 w-4" />
                </Button>
              </AIInputTools>
              <AIInputSubmit
                disabled={conversation?.status === "resolved" || isLimitReached || !form.formState.isValid}
                status="ready"
                type="submit"
              />
            </AIInputToolbar>
          </AIInput>
      </Form>
    </>
  );
};
