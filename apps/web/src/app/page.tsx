import { PageHeader } from '@/components/PageHeader';
import { LiveStatus } from './_components/LiveStatus';
import { RecentReviews } from './_components/RecentReviews';
import { SetupChecklist } from './_components/SetupChecklist';
import { UsageSection } from './_components/UsageSection';

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="What diffy is doing right now and what it found lately." />
      <div className="space-y-6">
        <SetupChecklist />
        <LiveStatus />
        <UsageSection />
        <RecentReviews />
      </div>
    </>
  );
}
