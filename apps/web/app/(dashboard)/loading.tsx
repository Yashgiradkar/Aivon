import { TechLoader } from "@/components/tech-loader";

export default function DashboardLoading() {
  return (
    <div className="flex h-full w-full flex-1 items-center justify-center p-8 bg-muted/20">
      <TechLoader
        title="Loading Dashboard"
        description="Synchronizing state and establishing real-time subscriptions..."
        delayMs={100}
      />
    </div>
  );
}
