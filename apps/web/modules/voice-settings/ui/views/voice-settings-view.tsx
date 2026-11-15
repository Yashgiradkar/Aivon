"use client";

import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  MicIcon,
  Volume2Icon,
  GlobeIcon,
  ZapIcon,
  PlayIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  RefreshCwIcon,
  SparklesIcon,
  SettingsIcon,
  InfoIcon,
  MicOffIcon,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Slider } from "@workspace/ui/components/slider";
import { Textarea } from "@workspace/ui/components/textarea";
import { Badge } from "@workspace/ui/components/badge";
import { Separator } from "@workspace/ui/components/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";

// ---------------------------------------------------------------------------
// Constants & types
// ---------------------------------------------------------------------------

const ELEVENLABS_MODELS = [
  { value: "eleven_turbo_v2_5", label: "Turbo v2.5 — Multilingual, low latency", badge: "Recommended" },
  { value: "eleven_flash_v2_5", label: "Flash v2.5 — Multilingual, ultra-fast", badge: "Fastest" },
  { value: "eleven_multilingual_v2", label: "Multilingual v2 — Highest quality" },
  { value: "eleven_turbo_v2", label: "Turbo v2 — English only" },
  { value: "eleven_flash_v2", label: "Flash v2 — English only, ultra-fast" },
] as const;

const SUPPORTED_LANGUAGES = [
  { value: "en", label: "🇺🇸 English" },
  { value: "hi", label: "🇮🇳 Hindi (हिन्दी)" },
  { value: "mr", label: "🇮🇳 Marathi (मराठी)" },
] as const;

const TRANSCRIBER_PROVIDERS = [
  { value: "11labs", label: "ElevenLabs Scribe v1 — Multilingual STT" },
  { value: "deepgram", label: "Deepgram — English STT (Vapi default)" },
] as const;

const VOICE_DESIGN_EXAMPLE =
  "Professional Indian customer support representative. Calm, friendly, clear articulation, moderate speaking speed, natural conversational delivery, reassuring but not overly enthusiastic. Speaks clear Indian English and supports Hindi.";

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------

const voiceSettingsSchema = z.object({
  elevenLabsVoiceId: z.string().optional(),
  elevenLabsModel: z.string(),
  elevenLabsStability: z.number().min(0).max(1),
  elevenLabsSimilarityBoost: z.number().min(0).max(1),
  elevenLabsSpeed: z.number().min(0.7).max(1.2),
  elevenLabsOptimizeStreamingLatency: z.number().min(0).max(4).int(),
  transcriberProvider: z.string(),
  transcriberLanguage: z.string(),
  interruptionNumWords: z.number().min(0).max(10).int(),
  interruptionVoiceSeconds: z.number().min(0.05).max(2),
  interruptionBackoffSeconds: z.number().min(0.1).max(5),
  startSpeakingWaitSeconds: z.number().min(0).max(3),
  voiceDesignDescription: z.string().max(500).optional(),
  voiceDesignType: z.string(),
});

type VoiceSettingsFormData = z.infer<typeof voiceSettingsSchema>;

// ---------------------------------------------------------------------------
// Helper: Tooltip info icon
// ---------------------------------------------------------------------------
function InfoTip({ content }: { content: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <InfoIcon className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// VoiceLibrarySelector — inline voice picker with preview
// ---------------------------------------------------------------------------
function VoiceLibrarySelector({
  value,
  onChange,
}: {
  value?: string;
  onChange: (id: string) => void;
}) {
  const listVoices = useAction(api.private.voiceSettings.listVoiceLibrary);
  const [voices, setVoices] = useState<Array<{ voiceId: string; name: string; category: string; labels?: Record<string, string> }>>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadVoices = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const result = await listVoices({});
      setVoices(result);
      setLoaded(true);
    } catch (err) {
      toast.error("Failed to load voice library");
    } finally {
      setLoading(false);
    }
  }, [listVoices, loaded]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Select value={value} onValueChange={onChange} onOpenChange={loadVoices}>
          <SelectTrigger id="voice-library-select">
            <SelectValue placeholder="Select a voice from library…" />
          </SelectTrigger>
          <SelectContent>
            {loading && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <RefreshCwIcon className="h-4 w-4 animate-spin" />
                Loading voices…
              </div>
            )}
            {voices.map((v) => (
              <SelectItem key={v.voiceId} value={v.voiceId}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{v.name}</span>
                  {v.labels?.gender && (
                    <span className="text-xs text-muted-foreground capitalize">{v.labels.gender}</span>
                  )}
                  {v.labels?.accent && (
                    <Badge variant="secondary" className="text-xs py-0">{v.labels.accent}</Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted">
            <CheckCircle2Icon className="h-4 w-4 text-green-500" />
          </div>
        )}
      </div>
      {!loaded && !loading && (
        <p className="text-xs text-muted-foreground">
          Click the dropdown to load your ElevenLabs voice library.
        </p>
      )}
      {value && (
        <p className="text-xs text-muted-foreground">
          Voice ID: <code className="rounded bg-muted px-1 py-0.5">{value}</code>
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main View
// ---------------------------------------------------------------------------

export const VoiceSettingsView = () => {
  const currentSettings = useQuery(api.private.voiceSettings.getVoiceSettings);
  const upsertVoiceSettings = useMutation(api.private.voiceSettings.upsertVoiceSettings);
  const [isSaving, setIsSaving] = useState(false);

  const defaultValues: VoiceSettingsFormData = {
    elevenLabsVoiceId: "",
    elevenLabsModel: "eleven_turbo_v2_5",
    elevenLabsStability: 0.5,
    elevenLabsSimilarityBoost: 0.8,
    elevenLabsSpeed: 1.0,
    elevenLabsOptimizeStreamingLatency: 3,
    transcriberProvider: "deepgram",
    transcriberLanguage: "en",
    interruptionNumWords: 0,
    interruptionVoiceSeconds: 0.2,
    interruptionBackoffSeconds: 1,
    startSpeakingWaitSeconds: 0.4,
    voiceDesignDescription: "",
    voiceDesignType: "library",
  };

  const form = useForm<VoiceSettingsFormData>({
    resolver: zodResolver(voiceSettingsSchema),
    defaultValues,
    values: currentSettings
      ? {
          elevenLabsVoiceId: currentSettings.elevenLabsVoiceId ?? "",
          elevenLabsModel: currentSettings.elevenLabsModel ?? "eleven_turbo_v2_5",
          elevenLabsStability: currentSettings.elevenLabsStability ?? 0.5,
          elevenLabsSimilarityBoost: currentSettings.elevenLabsSimilarityBoost ?? 0.8,
          elevenLabsSpeed: currentSettings.elevenLabsSpeed ?? 1.0,
          elevenLabsOptimizeStreamingLatency: currentSettings.elevenLabsOptimizeStreamingLatency ?? 3,
          transcriberProvider: currentSettings.transcriberProvider ?? "deepgram",
          transcriberLanguage: currentSettings.transcriberLanguage ?? "en",
          interruptionNumWords: currentSettings.interruptionNumWords ?? 0,
          interruptionVoiceSeconds: currentSettings.interruptionVoiceSeconds ?? 0.2,
          interruptionBackoffSeconds: currentSettings.interruptionBackoffSeconds ?? 1,
          startSpeakingWaitSeconds: currentSettings.startSpeakingWaitSeconds ?? 0.4,
          voiceDesignDescription: currentSettings.voiceDesignDescription ?? "",
          voiceDesignType: currentSettings.voiceDesignType ?? "library",
        }
      : undefined,
  });

  const onSubmit = async (values: VoiceSettingsFormData) => {
    setIsSaving(true);
    try {
      await upsertVoiceSettings({
        ...values,
        elevenLabsVoiceId: values.elevenLabsVoiceId || undefined,
        voiceDesignDescription: values.voiceDesignDescription || undefined,
      });
      toast.success("Voice settings saved successfully");
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string }; message?: string })?.data?.message ||
        (err as { message?: string })?.message ||
        "Failed to save voice settings";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedModel = form.watch("elevenLabsModel");
  const selectedLanguage = form.watch("transcriberLanguage");
  const transcriberProvider = form.watch("transcriberProvider");
  const voiceDesignType = form.watch("voiceDesignType");

  const isMultilingualModel = selectedModel.includes("multilingual") || selectedModel.includes("v2_5");
  const isLanguageEnforced = selectedModel === "eleven_turbo_v2_5" || selectedModel === "eleven_flash_v2_5";

  return (
    <div className="flex min-h-screen flex-col bg-muted p-8">
      <div className="mx-auto w-full max-w-screen-md space-y-8">

        {/* Page Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md">
              <Volume2Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold md:text-3xl">Voice Settings</h1>
              <p className="text-sm text-muted-foreground">
                Configure ElevenLabs TTS, multilingual STT, and interruption behavior
              </p>
            </div>
          </div>

          {/* Config version badge */}
          {currentSettings?.voiceConfigVersion && (
            <Badge variant="secondary" className="text-xs">
              Config v{currentSettings.voiceConfigVersion}
            </Badge>
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* ---- TTS: ElevenLabs Voice ---- */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Volume2Icon className="h-5 w-5 text-violet-500" />
                  <div>
                    <CardTitle>Text-to-Speech Voice</CardTitle>
                    <CardDescription>Select and configure the ElevenLabs voice for your AI assistant</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">

                {/* Voice Design Type */}
                <FormField
                  control={form.control}
                  name="voiceDesignType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voice Source</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger id="voice-design-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="library">Voice Library — Choose from existing voices</SelectItem>
                          <SelectItem value="custom">Custom Voice ID — Enter a specific voice ID</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose from ElevenLabs pre-made voices or enter a custom voice ID from your ElevenLabs account.
                        Voice cloning and generation require an ElevenLabs account with appropriate entitlements.
                      </FormDescription>
                    </FormItem>
                  )}
                />

                {/* Voice library picker OR custom ID input */}
                <FormField
                  control={form.control}
                  name="elevenLabsVoiceId"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-1.5">
                        <FormLabel>Voice</FormLabel>
                        <InfoTip content="The ElevenLabs voice ID used for TTS. Must be present in your ElevenLabs Voice Library or Vapi's voice sync." />
                      </div>
                      <FormControl>
                        {voiceDesignType === "custom" ? (
                          <Input
                            id="voice-id-input"
                            placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
                            value={field.value}
                            onChange={field.onChange}
                          />
                        ) : (
                          <VoiceLibrarySelector value={field.value} onChange={field.onChange} />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Voice Design Description */}
                <FormField
                  control={form.control}
                  name="voiceDesignDescription"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-1.5">
                        <FormLabel className="flex items-center gap-1.5">
                          <SparklesIcon className="h-3.5 w-3.5 text-violet-500" />
                          Voice Design Description
                          <Badge variant="outline" className="text-xs ml-1">Optional</Badge>
                        </FormLabel>
                        <InfoTip content="Describe the desired voice personality. This is stored as metadata to guide your voice selection. It does not auto-generate a voice — contact ElevenLabs to create custom voices." />
                      </div>
                      <FormControl>
                        <Textarea
                          id="voice-design-description"
                          placeholder={VOICE_DESIGN_EXAMPLE}
                          className="resize-none text-sm"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Store a voice design brief for documentation. Actual voice ID must be set separately.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* ElevenLabs Model */}
                <FormField
                  control={form.control}
                  name="elevenLabsModel"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-1.5">
                        <FormLabel>TTS Model</FormLabel>
                        <InfoTip content="Turbo v2.5 and Flash v2.5 support multilingual output including Hindi and Marathi. Monolingual models only support English." />
                      </div>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger id="tts-model-select">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ELEVENLABS_MODELS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              <div className="flex items-center gap-2">
                                <span>{m.label}</span>
                                {"badge" in m && <Badge className="text-xs py-0">{m.badge}</Badge>}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!isMultilingualModel && selectedLanguage !== "en" && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mt-1">
                          <AlertCircleIcon className="h-3.5 w-3.5" />
                          <span>This model only supports English. Switch to Turbo v2.5 or Flash v2.5 for Hindi/Marathi.</span>
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Voice parameters */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="elevenLabsStability"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <FormLabel>Stability</FormLabel>
                            <InfoTip content="Higher stability makes the voice more consistent but less expressive. Lower adds natural variation." />
                          </div>
                          <span className="text-sm font-medium tabular-nums">{field.value.toFixed(2)}</span>
                        </div>
                        <FormControl>
                          <Slider
                            id="stability-slider"
                            min={0} max={1} step={0.01}
                            value={[field.value]}
                            onValueChange={([v]) => field.onChange(v)}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">0 = expressive · 1 = consistent</FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="elevenLabsSimilarityBoost"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <FormLabel>Similarity Boost</FormLabel>
                            <InfoTip content="Amplifies the voice's unique characteristics. Keep high (0.75+) for consistent brand voice." />
                          </div>
                          <span className="text-sm font-medium tabular-nums">{field.value.toFixed(2)}</span>
                        </div>
                        <FormControl>
                          <Slider
                            id="similarity-slider"
                            min={0} max={1} step={0.01}
                            value={[field.value]}
                            onValueChange={([v]) => field.onChange(v)}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">0 = natural · 1 = enhanced similarity</FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="elevenLabsSpeed"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <FormLabel>Speaking Speed</FormLabel>
                            <InfoTip content="Control how fast the assistant speaks. 1.0 is natural pace." />
                          </div>
                          <span className="text-sm font-medium tabular-nums">{field.value.toFixed(2)}×</span>
                        </div>
                        <FormControl>
                          <Slider
                            id="speed-slider"
                            min={0.7} max={1.2} step={0.05}
                            value={[field.value]}
                            onValueChange={([v]) => field.onChange(v)}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">0.7× slow · 1.0× normal · 1.2× fast</FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="elevenLabsOptimizeStreamingLatency"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <FormLabel>Latency Optimization</FormLabel>
                            <InfoTip content="0 = maximum quality, 4 = minimum latency. Default 3 is optimal for real-time voice chat." />
                          </div>
                          <span className="text-sm font-medium tabular-nums">{field.value}</span>
                        </div>
                        <FormControl>
                          <Slider
                            id="latency-slider"
                            min={0} max={4} step={1}
                            value={[field.value]}
                            onValueChange={([v]) => field.onChange(v)}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">0 = high quality · 4 = ultra-low latency</FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* ---- STT: Multilingual Transcription ---- */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <MicIcon className="h-5 w-5 text-blue-500" />
                  <div>
                    <CardTitle>Speech-to-Text</CardTitle>
                    <CardDescription>Configure the transcriber and language for customer speech recognition</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">

                <FormField
                  control={form.control}
                  name="transcriberProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transcriber</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger id="transcriber-select">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TRANSCRIBER_PROVIDERS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        ElevenLabs Scribe v1 supports 99+ languages including Hindi and Marathi.
                        Deepgram is Vapi's default and optimized for English.
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="transcriberLanguage"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-1.5">
                        <FormLabel className="flex items-center gap-1.5">
                          <GlobeIcon className="h-3.5 w-3.5 text-blue-500" />
                          Primary Language
                        </FormLabel>
                        <InfoTip content="The primary language for both speech recognition and text-to-speech synthesis. Customers can speak in this language and the assistant will respond in it." />
                      </div>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger id="language-select">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SUPPORTED_LANGUAGES.map((l) => (
                            <SelectItem key={l.value} value={l.value}>
                              {l.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {transcriberProvider === "deepgram" && field.value !== "en" && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mt-1">
                          <AlertCircleIcon className="h-3.5 w-3.5" />
                          <span>Deepgram has limited Hindi/Marathi support. Switch to ElevenLabs Scribe for better multilingual transcription.</span>
                        </div>
                      )}
                      {isLanguageEnforced && (
                        <FormDescription className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <CheckCircle2Icon className="h-3 w-3" />
                          Language will be enforced at the TTS model level for consistent pronunciation.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* ---- Interruption & Turn-Taking ---- */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <ZapIcon className="h-5 w-5 text-orange-500" />
                  <div>
                    <CardTitle>Interruption & Turn-Taking</CardTitle>
                    <CardDescription>Configure barge-in sensitivity and response timing</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">

                <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">How interruption works</p>
                  <p>When a customer starts speaking while the assistant is talking, Vapi detects the interruption using Voice Activity Detection (VAD). The current audio is cancelled, and stale TTS chunks are discarded. The assistant processes the customer's new input and generates a fresh response.</p>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="interruptionNumWords"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <FormLabel>Interruption Words Threshold</FormLabel>
                            <InfoTip content="Number of words required before the assistant stops speaking. 0 = uses VAD timing instead. Phrases like 'stop', 'wait', 'no' always interrupt regardless." />
                          </div>
                          <span className="text-sm font-medium tabular-nums">{field.value}</span>
                        </div>
                        <FormControl>
                          <Slider
                            id="interruption-words-slider"
                            min={0} max={5} step={1}
                            value={[field.value]}
                            onValueChange={([v]) => field.onChange(v)}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">0 = VAD-based · 3+ = requires more words</FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="interruptionVoiceSeconds"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <FormLabel>VAD Sensitivity (s)</FormLabel>
                            <InfoTip content="Seconds of voice activity needed before triggering interruption. Only used when numWords=0. Lower = more sensitive (may trigger on background noise)." />
                          </div>
                          <span className="text-sm font-medium tabular-nums">{field.value.toFixed(2)}s</span>
                        </div>
                        <FormControl>
                          <Slider
                            id="vad-slider"
                            min={0.05} max={1.0} step={0.05}
                            value={[field.value]}
                            onValueChange={([v]) => field.onChange(v)}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">0.05s = very sensitive · 1.0s = noise-resistant</FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="interruptionBackoffSeconds"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <FormLabel>Re-speak Delay (s)</FormLabel>
                            <InfoTip content="Time the assistant waits before speaking again after being interrupted. Prevents rapid back-and-forth." />
                          </div>
                          <span className="text-sm font-medium tabular-nums">{field.value.toFixed(1)}s</span>
                        </div>
                        <FormControl>
                          <Slider
                            id="backoff-slider"
                            min={0.1} max={3} step={0.1}
                            value={[field.value]}
                            onValueChange={([v]) => field.onChange(v)}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">0.1s = immediate · 3.0s = patient</FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="startSpeakingWaitSeconds"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <FormLabel>Start Speaking Delay (s)</FormLabel>
                            <InfoTip content="Minimum time the assistant waits before speaking after the customer finishes. Prevents jumping in too fast." />
                          </div>
                          <span className="text-sm font-medium tabular-nums">{field.value.toFixed(1)}s</span>
                        </div>
                        <FormControl>
                          <Slider
                            id="start-speaking-slider"
                            min={0.0} max={2.0} step={0.1}
                            value={[field.value]}
                            onValueChange={([v]) => field.onChange(v)}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">0.0s = immediate · 0.4s recommended · 2.0s = long pause</FormDescription>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Endpointing info */}
                <div className="rounded-lg border bg-muted/50 p-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Endpointing: </span>
                  {selectedLanguage === "en"
                    ? "LiveKit smart endpointing is enabled for English — provides the most accurate turn detection."
                    : "Transcription-based endpointing is used for non-English languages."}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  disabled={isSaving || !form.formState.isDirty}
                  className="ml-auto"
                  id="save-voice-settings-btn"
                >
                  {isSaving ? (
                    <>
                      <RefreshCwIcon className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <CheckCircle2Icon className="mr-2 h-4 w-4" />
                      Save Voice Settings
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

          </form>
        </Form>

        {/* Capability matrix */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Supported Capabilities</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
              {[
                { lang: "English", stt: "Deepgram / Scribe v1", tts: "All models", badge: "Full support" },
                { lang: "Hindi", stt: "Scribe v1", tts: "Multilingual v2, Turbo v2.5, Flash v2.5", badge: "Multilingual" },
                { lang: "Marathi", stt: "Scribe v1", tts: "Multilingual v2, Turbo v2.5, Flash v2.5", badge: "Multilingual" },
              ].map((row) => (
                <div key={row.lang} className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{row.lang}</span>
                    <Badge variant="secondary" className="text-xs">{row.badge}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div><span className="font-medium text-foreground">STT:</span> {row.stt}</div>
                    <div><span className="font-medium text-foreground">TTS:</span> {row.tts}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};
