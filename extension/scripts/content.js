function injectAddToLinearLink() {
  /** ID for the link we’ll create. */
  const linkId = 'github-to-linear-create-issue-link';
  // We already created our link. Let’s chill.
  if (document.getElementById(linkId)) return;

  // Parse the current URL to grab some information about the issue or PR.
  const matches = /^\/([^\/]+)\/([^\/]+)\/(issues|pull)\/(\d+)/.exec(
    location.pathname
  );
  // If we’re not in an issue or PR we can return early.
  if (!matches) return;

  // The header section of an issue/PR we want to inject our link into.
  const headerMeta = document.querySelector('.gh-header-meta');
  if (!headerMeta) {
    console.error('Could not find header meta to inject into.');
    return;
  }

  // Grab the issue or PR title (thank you GH for using the same class for both).
  const titleEl = document.querySelector('.js-issue-title');
  const issueTitle = titleEl?.textContent;

  // Clean up the current URL in case it has stray query params or fragment hashes.
  const rawUrl = new URL(window.location.href);
  rawUrl.hash = '';
  rawUrl.searchParams.forEach((_, key) => rawUrl.searchParams.delete(key));
  const url = rawUrl.href;

  const [_fullMatch, org, repo, type, number] = matches;

  let title = `${org}/${repo}#${number}`;
  if (issueTitle) title += ' — ' + issueTitle;
  const typeLabel = type === 'pull' ? 'PR' : 'Issue';
  const description = `GitHub ${typeLabel}: ${url}`;

  /** URL that will open a pre-filled new issue in Linear. */
  const createIssueUrl = new URL('https://linear.app/new');
  createIssueUrl.searchParams.set('title', title);
  createIssueUrl.searchParams.set('description', description);

  // Create a link a user can click to create a new issue on Linear.
  const linkEl = document.createElement('a');
  linkEl.id = linkId;
  linkEl.href = createIssueUrl.href;
  // Add link text and the Linear logo as an inline SVG.
  linkEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 100 100" width="16" height="16"><path fill="#5E6AD2" d="M1.2254 61.5228c-.2225-.9485.9075-1.5459 1.5964-.857l36.5124 36.5124c.6889.6889.0915 1.8189-.857 1.5964C20.0515 94.4522 5.5478 79.9485 1.2254 61.5228ZM.002 46.8891a.9896.9896 0 0 0 .2896.7606l52.0588 52.0588a.9887.9887 0 0 0 .7606.2896 50.0747 50.0747 0 0 0 6.9624-.9259c.7645-.157 1.0301-1.0963.4782-1.6481L2.576 39.4485c-.552-.5519-1.4912-.2863-1.6482.4782a50.0671 50.0671 0 0 0-.926 6.9624Zm4.209-17.1837c-.1665.3738-.0817.8106.2077 1.1l64.776 64.776c.2894.2894.7262.3742 1.1.2077a49.9079 49.9079 0 0 0 5.1855-2.684c.5521-.328.6373-1.0867.1832-1.5407L8.4357 24.3367c-.4541-.4541-1.2128-.3689-1.5408.1832a49.8961 49.8961 0 0 0-2.684 5.1855Zm8.4478-11.6314c-.3701-.3701-.393-.9637-.0443-1.3541C21.7795 6.4593 35.1114 0 49.9519 0 77.5927 0 100 22.4073 100 50.0481c0 14.8405-6.4593 28.1724-16.7199 37.3375-.3903.3487-.984.3258-1.3542-.0443L12.6587 18.074Z"/></svg>
  <span>Add to Linear</span>`;
  // Add some minimal styles.
  linkEl.style.display = 'flex';
  linkEl.style.gap = '0.2em';
  linkEl.style.alignItems = 'center';
  linkEl.classList.add('btn', 'btn-sm');
  // Inject the link into the page.
  headerMeta.appendChild(linkEl);
}

// Run on page load.
injectAddToLinearLink();
// Run on each client-side navigation.
document.addEventListener('turbo:render', injectAddToLinearLink);
