import { PageHeader } from '@/components/PageHeader';
import { GithubSettings } from './_components/GithubSettings';
import { LlmSettings } from './_components/LlmSettings';

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Connect GitHub and choose the model that reviews your code." />
      <div>
        <GithubSettings />
        <LlmSettings />
      </div>
    </>
  );
}
