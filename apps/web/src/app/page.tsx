import { ComingSoon } from '@/components/coming-soon';
import { PageHeader } from '@/components/page-header';

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="What Diffy is doing right now." />
      <ComingSoon
        step="F7"
        items={[
          'A setup checklist (GitHub token, LLM, at least one repository) while something is missing',
          'The review queue: what is running, how many are waiting',
          'The poller: when it last checked and when it checks next',
          'The ten latest reviews',
        ]}
      />
    </>
  );
}
