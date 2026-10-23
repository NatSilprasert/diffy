import { LlmProvider } from '@diffy/shared';
import {
  buildPromptDiff,
  createGithubClient,
  getPullRequest,
  listChangedFiles,
  renderInlineComment,
  renderSummary,
  reviewPullRequest,
} from '../src/index.js';

const USAGE = `Usage: review-pr.ts owner/repo#123 [--print-diff] [--dry-run | --print-review | --post]
         [--provider=openai|anthropic|google|openrouter --model=<id>]   (key in LLM_API_KEY)

  --print-diff     show the annotated diff that would be sent to the LLM
  --dry-run        call the LLM and print findings as JSON (posts nothing)
  --print-review   call the LLM and print the markdown that would be posted (posts nothing)
  --post           call the LLM and post the review to GitHub`;

function parseTarget(arg: string | undefined) {
  const match = arg?.match(/^([\w.-]+)\/([\w.-]+)#(\d+)$/);
  if (!match) throw new Error(USAGE);
  return { owner: match[1]!, repo: match[2]!, number: Number(match[3]) };
}

function flag(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg?.slice(name.length + 3);
}

const has = (name: string) => process.argv.includes(`--${name}`);

function readLlmConfig() {
  const provider = LlmProvider.safeParse(flag('provider') ?? process.env.LLM_PROVIDER);
  const model = flag('model') ?? process.env.LLM_MODEL;
  const apiKey = process.env.LLM_API_KEY;
  if (!provider.success || !model || !apiKey) {
    throw new Error('Calling the LLM needs --provider=..., --model=... and LLM_API_KEY in env.\n\n' + USAGE);
  }
  return { provider: provider.data, model, apiKey };
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('Set GITHUB_TOKEN');
  const { owner, repo, number } = parseTarget(process.argv[2]);

  const post = has('post');
  const callLlm = post || has('dry-run') || has('print-review');
  const llm = callLlm ? readLlmConfig() : undefined;

  const octokit = createGithubClient(token);
  const pr = await getPullRequest(octokit, owner, repo, number);

  console.log(`#${pr.number} ${pr.title}`);
  console.log(pr.url);
  console.log(`head ${pr.headSha.slice(0, 7)} | draft=${pr.isDraft} | author=${pr.authorLogin} bot=${pr.authorIsBot}`);

  if (!llm || has('print-diff')) {
    const files = await listChangedFiles(octokit, owner, repo, number);
    console.log(`\n${files.length} changed file(s):`);
    for (const f of files) {
      const patch = f.patch === undefined ? 'no patch' : `${f.patch.length} chars`;
      console.log(`  ${f.status.padEnd(9)} +${f.additions} -${f.deletions}  ${f.path}  (${patch})`);
    }
    if (has('print-diff')) {
      const diff = buildPromptDiff(files);
      console.log(`\n--- annotated diff (${diff.text.length} chars, ${diff.included.length} file(s)) ---\n`);
      console.log(diff.text);
      for (const s of diff.skipped) console.log(`\nskipped: ${s.path} (${s.reason})`);
    }
  }

  if (!llm) return;

  console.log(`\ncalling ${llm.provider}/${llm.model} ...`);
  const result = await reviewPullRequest({ octokit, pr, llm, post });

  if (result.outcome === 'nothing-to-review') {
    console.log('Nothing to review: every changed file was skipped.');
    for (const s of result.skipped) console.log(`  skipped: ${s.path} (${s.reason})`);
    return;
  }

  if (has('print-review')) {
    console.log('\n===== REVIEW BODY =====\n');
    console.log(
      renderSummary({
        summary: result.summary,
        findings: result.findings,
        skipped: result.skipped,
        model: `${llm.provider}/${llm.model}`,
        headSha: pr.headSha,
      }),
    );
    for (const f of result.findings.filter((x) => x.placement === 'inline')) {
      const range = f.startLine === null ? `${f.line}` : `${f.startLine}-${f.line}`;
      console.log(`\n===== INLINE COMMENT ${f.path}:${range} =====\n`);
      console.log(renderInlineComment(f));
    }
  } else {
    console.log(JSON.stringify({ summary: result.summary, findings: result.findings }, null, 2));
  }

  const inline = result.findings.filter((f) => f.placement === 'inline').length;
  console.log(`\nplacement: ${inline} inline, ${result.findings.length - inline} in summary`);
  console.log(`tokens: in=${result.usage?.inputTokens ?? '?'} out=${result.usage?.outputTokens ?? '?'}`);
  if (result.githubReviewUrl) {
    console.log(`\nposted: ${result.githubReviewUrl}${result.fellBackToSummary ? ' (fell back: all findings in summary)' : ''}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
