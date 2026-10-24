import type { NextConfig } from 'next';

const config: NextConfig = {
  // A fully static site: `next build` writes plain files to out/, and in production the NestJS server
  // serves them, so diffy runs as one process with no Node server for the web part.
  output: 'export',
  // /settings/ -> settings/index.html, which a plain static file server resolves without extra rules.
  trailingSlash: true,
  // The image optimizer needs a server; there are no photos here anyway.
  images: { unoptimized: true },
  // `next dev` would otherwise write an AGENTS.md of instructions for AI tools into the project.
  agentRules: false,
};

export default config;
