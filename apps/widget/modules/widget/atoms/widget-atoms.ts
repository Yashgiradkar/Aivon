import { atom } from "jotai";
import { atomFamily, atomWithStorage } from "jotai/utils";
import { WidgetScreen } from "@/modules/widget/types";
import { CONTACT_SESSION_KEY } from "../constants";
import { Doc, Id } from "@workspace/backend/_generated/dataModel";

export const screenAtom = atom<WidgetScreen>("loading");
export const organizationIdAtom = atom<string | null>(null);
export const contactSessionIdAtomFamily = atomFamily((organizationId: string) => {
  return atomWithStorage<Id<"contactSessions"> | null>(`${CONTACT_SESSION_KEY}_${organizationId}`, null)
});
export const errorMessageAtom = atom<string | null>(null);
export const loadingMessageAtom = atom<string | null>(null);
export const conversationIdAtom = atom<Id<"conversations"> | null>(null);

export const widgetSettingsAtom = atom<{
  greetMessage: string;
  maxMessagesPerConversation?: number;
  defaultSuggestions: {
    suggestion1?: string;
    suggestion2?: string;
    suggestion3?: string;
  };
  vapiSettings: {
    assistantId?: string;
    phoneNumber?: string;
  };
} | null>(null);
export const vapiSecretsAtom = atom<{
  publicApiKey: string;
} | null>(null);
export const hasVapiSecretsAtom = atom((get) => get(vapiSecretsAtom) !== null);

export const activeQueueEntryAtom = atom<Doc<"supportQueue"> | null>(null);

