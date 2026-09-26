import { Suspense } from "react";
import { ConversationIdView, ConversationIdViewLoading } from "@/modules/dashboard/ui/views/conversation-id-view";
import { Id } from "@workspace/backend/_generated/dataModel";

export const dynamic = "force-dynamic";

const Page = async ({
  params,
}: {
  params: Promise<{
    conversationId: string;
  }>
}) => {
  const { conversationId } = await params;

  return (
    <Suspense fallback={<ConversationIdViewLoading />}>
      <ConversationIdView conversationId={conversationId as Id<"conversations">} />
    </Suspense>
  );
};
 
export default Page;
