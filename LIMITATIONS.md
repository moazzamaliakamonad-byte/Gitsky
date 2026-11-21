# Limitations

Gitsky tries never to imply more than it knows. Here is what it doesn't know.

## History is sampled, not complete
- Without a token, Gitsky traces the files touched by roughly the **last 25 commits** of
  the default branch (the exact number depends on your remaining hourly quota). With a
  token, up to 300.
- "Hot", "quiet" and "contributors" all mean *in that sample*. A folder can look quiet
  because the last 25 commits happened elsewhere, not because nobody ever works on it.
- Commits are the most recent ones *in a row*, so a burst of activity (a release, a big
  refactor) dominates the picture.
- Merge commits are treated like any other commit.
- GitHub lists at most 300 files per commit in the API response; for larger commits only
  those are counted, and comets are capped at 14 per commit.
- Files a commit touched that no longer exist (deleted or renamed since) don't have stars,
  but they still count in that commit's "files changed" number.

## Size is bytes, not lines of code
Star size and "largest files" use the blob size GitHub reports, in bytes. A minified
bundle or a lockfile can be "large" without containing much code. Binary files count too.

## Rate limits
- 60 requests per hour per IP address without a token. Loading one new repo costs about
  28. Reloading a repo you opened in the last hour costs zero (IndexedDB cache).
- If the quota runs out mid-load, Gitsky keeps the partial sample and says so.
- Shared networks (offices, universities, VPNs) share one quota.

## Big repos
- GitHub truncates very large tree listings (roughly 100,000 entries or 7 MB). Gitsky
  shows the files it received and tells you the tree was truncated.
- The bundled `golang/go` snapshot keeps 12,000 of its 16,442 files to stay small; the UI
  reports the full count.
- Building the layout for 50,000 files takes a few hundred milliseconds on the main thread.

## Other
- Public repositories only. Private repos return "not found", by GitHub's design.
- Only github.com. No GitLab, Bitbucket or GitHub Enterprise.
- Language is guessed from the file extension, not from file contents (no Linguist).
- `/tree/<branch>/...` URLs take the first path segment as the branch, so branch names
  containing `/` aren't detected from URLs.
- WebGL is required. The List view works without the 3D view's visuals, but the page still
  needs JavaScript.
- Colours: the language palette is tuned to glow on black and two of its pairs are hard to
  tell apart for some colour-blind readers (e.g. HTML and Python). Names are always shown
  alongside colours: legend, tooltip, panels, list view.
