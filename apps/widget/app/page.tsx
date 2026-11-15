"use client";

import { use } from "react";

import { WidgetView } from "@/modules/widget/ui/views/widget-view";

interface Props {
  searchParams: Promise<{
    organizationId: string;
  }>
};

const Page = ({ searchParams }: Props) => {
  const { organizationId } = use(searchParams);

  if (
    !organizationId ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(organizationId)
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-sm text-muted-foreground">
        This support widget is missing a valid organization.
      </div>
    );
  }

  return (
    <WidgetView organizationId={organizationId} />
  );
};

export default Page;
