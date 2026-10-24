import { PageHeader } from '@/components/PageHeader';
import { LiveStatus } from './_components/LiveStatus';
import { RecentReviews } from './_components/RecentReviews';
import { SetupChecklist } from './_components/SetupChecklist';

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="What Diffy is doing right now and what it found lately." />
      <div className="space-y-6">
        <SetupChecklist />
        <LiveStatus />
        <RecentReviews />
      </div>
    </>
  );
}
