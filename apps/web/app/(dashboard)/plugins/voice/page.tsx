import { VoiceSettingsView } from "@/modules/voice-settings/ui/views/voice-settings-view";

export const metadata = {
  title: "Voice Settings — Aivon",
  description: "Configure ElevenLabs TTS, multilingual STT, and interruption handling for your AI voice support assistant.",
};

export default function VoiceSettingsPage() {
  return <VoiceSettingsView />;
}
