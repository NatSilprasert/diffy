import { buildPromptDiff, createGithubClient, getPullRequest, listChangedFiles } from '../src/index.js';

function parseTarget(arg: string | undefined) {
  const match = arg?.match(/^([\w.-]+)\/([\w.-]+)#(\d+)$/);
  if (!match) throw new Error('Usage: review-pr.ts owner/repo#123');
  return { owner: match[1]!, repo: match[2]!, number: Number(match[3]) };
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('Set GITHUB_TOKEN');
  const { owner, repo, number } = parseTarget(process.argv[2]);
  const printDiff = process.argv.includes('--print-diff');

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
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
