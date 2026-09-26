import { ConversationIdViewLoading } from "@/modules/dashboard/ui/views/conversation-id-view";

/**
 * Next.js streaming loading UI — renders instantly on navigation
 * while Convex subscriptions are being established.
 */
export default function Loading() {
  return <ConversationIdViewLoading />;
}
