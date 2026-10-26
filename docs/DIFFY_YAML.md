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

# Files that are never reviewed. Same pattern syntax as .gitignore / .gitattributes.
ignore:
  - "public/**"
  - "**/*.svg"
```

Also skipped without any setting: lockfiles, build output, migration snapshots, other generated files and
anything marked `linguist-generated` in `.gitattributes`.
