import { PageHeader } from '@/components/PageHeader';
import { GithubSettings } from './_components/GithubSettings';
import { LlmSettings } from './_components/LlmSettings';

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Install the GitHub App and choose the model that reviews your code." />
      <div>
        <GithubSettings />
        <LlmSettings />
      </div>
    </>
  );
}
