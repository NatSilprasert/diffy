import { PageHeader } from '@/components/PageHeader';
import { GithubSettingsCard } from './_components/GithubSettingsCard';
import { LlmSettingsCard } from './_components/LlmSettingsCard';

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Connect GitHub and choose the model that reviews your code." />
      <div className="space-y-6">
        <GithubSettingsCard />
        <LlmSettingsCard />
      </div>
    </>
  );
}
