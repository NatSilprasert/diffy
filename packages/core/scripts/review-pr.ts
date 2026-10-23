import { LlmProvider } from '@diffy/shared';
import {
  SYSTEM_PROMPT,
  buildPromptDiff,
  buildUserPrompt,
  createGithubClient,
  generateReview,
  getPullRequest,
  listChangedFiles,
} from '../src/index.js';

function parseTarget(arg: string | undefined) {
  const match = arg?.match(/^([\w.-]+)\/([\w.-]+)#(\d+)$/);
  if (!match) throw new Error('Usage: review-pr.ts owner/repo#123');
  return { owner: match[1]!, repo: match[2]!, number: Number(match[3]) };
}

function flag(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg?.slice(name.length + 3);
}

function readLlmConfig() {
  const provider = LlmProvider.safeParse(flag('provider') ?? process.env.LLM_PROVIDER);
  const model = flag('model') ?? process.env.LLM_MODEL;
  const apiKey = process.env.LLM_API_KEY;
  if (!provider.success || !model || !apiKey) {
    throw new Error(
      '--dry-run needs --provider=openai|anthropic|google|openrouter, --model=<id> and LLM_API_KEY in env',
    );
  }
  return { provider: provider.data, model, apiKey };
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('Set GITHUB_TOKEN');
  const { owner, repo, number } = parseTarget(process.argv[2]);
  const printDiff = process.argv.includes('--print-diff');
  const dryRun = process.argv.includes('--dry-run');
  const llmConfig = dryRun ? readLlmConfig() : undefined;

  const octokit = createGithubClient(token);
  const pr = await getPullRequest(octokit, owner, repo, number);
  const files = await listChangedFiles(octokit, owner, repo, number);

  console.log(`#${pr.number} ${pr.title}`);
  console.log(`${pr.url}`);
  console.log(`head ${pr.headSha.slice(0, 7)} | draft=${pr.isDraft} | author=${pr.authorLogin} bot=${pr.authorIsBot}`);
  console.log(`\n${files.length} changed file(s):`);
  for (const f of files) {
    const patch = f.patch === undefined ? 'no patch' : `${f.patch.length} chars`;
    console.log(`  ${f.status.padEnd(9)} +${f.additions} -${f.deletions}  ${f.path}  (${patch})`);
  }

  if (printDiff) {
    const diff = buildPromptDiff(files);
    console.log(`\n--- annotated diff (${diff.text.length} chars, ${diff.included.length} file(s)) ---\n`);
    console.log(diff.text);
    for (const s of diff.skipped) console.log(`\nskipped: ${s.path} (${s.reason})`);
  }
  if (llmConfig) {
    const diff = buildPromptDiff(files);
    console.log(`\ncalling ${llmConfig.provider}/${llmConfig.model} ...`);
    const { review, usage } = await generateReview(llmConfig, SYSTEM_PROMPT, buildUserPrompt(pr, diff));
    console.log(JSON.stringify(review, null, 2));
    console.log(`\ntokens: in=${usage.inputTokens ?? '?'} out=${usage.outputTokens ?? '?'}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
