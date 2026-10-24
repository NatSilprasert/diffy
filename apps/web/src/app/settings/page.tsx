import { ComingSoon } from '@/components/coming-soon';
import { PageHeader } from '@/components/page-header';

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Connect GitHub and choose the model that reviews your code." />
      <ComingSoon
        step="F3"
        items={[
          'GitHub: paste a personal access token and see which account it belongs to',
          'LLM: provider, model and API key, with a button to test them',
          'Saved keys are never shown again, only whether they are set',
        ]}
      />
    </>
  );
}
