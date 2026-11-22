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
- Bundled snapshots keep at most 12,000 files to stay small (`golang/go` keeps 12,000 of
  16,442, `pytorch/pytorch` 12,000 of 22,373), always including the files the sampled
  commits touched. The UI reports the full count.
- Building the layout for 50,000 files takes a few hundred milliseconds on the main thread.

## Deep time
- It shows the repo at up to ten moments (twelve for featured skies), spaced evenly by
  commit count, not every commit. A file that was added and deleted between two moments
  never appears.
- Moments follow the branch's history as GitHub lists it, newest first. For repos with
  unusual histories (imported projects, rewritten dates), the first moment can be older
  than the GitHub repo itself.
- Files are matched by path. A renamed file looks like one file deleted and another born.
- Deleted files ("ghosts") are placed inside the folder they lived in, or the nearest folder
  that still exists, not where the full layout would have put them. At most 3,000 are
  kept, the longest-lived first.
- Folder labels hide their file counts in deep time (those are today's); the legend keeps
  today's totals.
- A repo without a prebuilt history needs about 21 requests. With fewer left this hour it
  reads fewer moments, and below two it says so instead.

## Constellations
- A person's constellation joins the files they touched in the sampled commits only, so
  it shows recent work, not everything they've ever done in the repo.
- Authors are matched by GitHub login when the commit has one, otherwise by the name on
  the commit, so one person can appear twice.

## Offline
- The offline copy needs one visit with a connection first. After that, the site and every
  sky you've opened work without a network; repos and features you haven't used yet still
  need GitHub.
- GitHub API answers aren't kept by the offline copy itself; repos come from the browser's
  own cache (IndexedDB), and a stale copy is shown with a note when GitHub can't be reached.

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
