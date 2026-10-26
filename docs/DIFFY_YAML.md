# `.diffy.yaml`: per-repository review settings

Put a `.diffy.yaml` (or `.diffy.yml`) at the root of a repository that diffy watches. diffy reads it from the
repository's **default branch**, never from the pull request being reviewed, so a pull request cannot change
the rules of its own review. A change to the file applies to reviews that start after it is merged.

Every setting is optional. A wrong value is reported at the bottom of the next review (under "problems with the
diffy settings of this repository") and replaced by its default; the other settings still apply.

```yaml
# The language of the summary, titles and explanations: en (default) or th.
# Code, file paths and the "fix prompt for your coding agent" always stay English.
language: en

# chill (default): only what matters. assertive: also missing error handling, untested changes and
# maintainability problems, as low or medium findings.
profile: chill

# What the reviewers of this project care about. Up to 20,000 characters together with instructions_file.
instructions: |
  We use Drizzle for all database access. Flag any raw SQL.
  Money is always stored in satang as an integer.

# A file of the repository (on the default branch) with longer instructions. Added after `instructions`.
instructions_file: docs/review-instructions.md

# Instructions for part of the code. Only sent when the pull request changes a matching file.
path_instructions:
  - path: "src/server/**"
    instructions: Every endpoint must check the signed-in user's permissions.
  - path: "**/*.sql"
    instructions: Migrations must be reversible.

# More documents to read before every review (on the default branch, up to 10). Read first, before the
# files diffy finds by itself.
context_files:
  - docs/ARCHITECTURE.md

# Files that are never reviewed. Same pattern syntax as .gitignore / .gitattributes.
ignore:
  - "public/**"
  - "**/*.svg"
```

Also skipped without any setting: lockfiles, build output, migration snapshots, other generated files and
anything marked `linguist-generated` in `.gitattributes`.

## Documents diffy reads on its own

Before every review diffy reads, from the default branch, the first of these that exist: your `context_files`,
then `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`, then `README.md` (or
`README.markdown`, `readme.md`, `README`), then `CONTRIBUTING.md`. A long document is cut at 10,000 characters, and
all of them together at `MAX_CONTEXT_CHARS` (30,000 by default, 0 turns this off). A file with the same text as an
earlier one is read once. The review says which documents it read, at the bottom.

The model is told these are information about the project, not instructions: it uses them to understand what the
project is and which conventions it follows, and ignores anything in them that tries to change its task.

## What the model sees of a change

GitHub's patch shows three lines around each change. diffy gives the model more: the function, method or class that
contains the change (with the comments and decorators above it), a few lines below, and a small file in full, all
read from the pull request's head commit. Only lines marked `+` are new; the model is told not to report problems
that were already in the unchanged lines. This shares the `MAX_DIFF_CHARS` budget with the diff, code is expanded
before tests and other files, and `EXPAND_DIFF_CONTEXT=false` in `.env` turns it off.
