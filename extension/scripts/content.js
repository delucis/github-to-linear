// Run on page load.
injectUI();
// Run on each client-side navigation.
document.addEventListener('turbo:render', injectUI);

/**
 * Only runs on issue & PR pages.
 * If a matching Linear issue is found, injects a link to the issue on Linear.
 * Otherwise, injects a link to create a new Linear issue linking to this page.
 */
async function injectUI() {
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
  const [_fullMatch, org, repo, type, number] = matches;

  // The header section of an issue/PR we want to inject our link into.
  const headerMeta = document.querySelector('.gh-header-meta');
  if (!headerMeta) {
    console.error('Could not find header meta to inject into.');
    return;
  }

  // Grab the issue or PR title (thank you GH for using the same class for both).
  const titleEl = document.querySelector('.js-issue-title');
  const issueTitle = titleEl?.textContent;

  const identifier = `${org}/${repo}#${number}`;
  let title = identifier;
  if (issueTitle) title += ' — ' + issueTitle;
  const typeLabel = type === 'pull' ? 'PR' : 'Issue';
  const description = `GitHub ${typeLabel}: ${cleanUrl()}`;

  const linearIssue = await fetchExistingIssue(cleanUrl(), identifier);

  // Create a link to an existing issue or to create a new issue on Linear.
  const linkEl = h(
    'a',
    {
      id: linkId,
      href: linearIssue
        ? linearIssue.url
        : await getNewIssueUrl(title, description),
    },
    LinearLogo(),
    h('span', {}, linearIssue ? linearIssue.identifier : 'Add to Linear')
  );
  // If we found an existing issue, add its status to the link.
  if (linearIssue) {
    linkEl.append(h('span', { class: 'gh2l-issue-separator' }));
    linkEl.append(
      h('span', { class: 'gh2l-issue-status' }, linearIssue.state.name)
    );
  }
  // Add some minimal styles.
  linkEl.classList.add('btn', 'btn-sm', 'gh2l-issue-btn');
  // Inject the link into the page.
  headerMeta.appendChild(linkEl);
}

/**
 * Helper to build trees of HTML elements more quickly.
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag The name of an element to create, e.g. `'div'` or `'h1'`.
 * @param {Record<string, string>} attrs A map of attribute keys to attribute values.
 * @param  {(string | Node)[]} children Any number of child nodes to include in the created element. Strings will be inserted as `Text` nodes.
 * @returns {HTMLElementTagNameMap[K]}
 */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const key in attrs) el.setAttribute(key, attrs[key]);
  el.append(...children);
  return el;
}

/**
 * Helper to build trees of SVG elements more quickly.
 * @param {any} tag Qualified name for an SVG element, e.g. `'svg'` or `'path'`.
 * @param {Record<string, string>} attrs A map of attribute keys to attribute values.
 * @param  {SVGElement[]} children Any number of child nodes to include in the created element.
 * @returns {SVGElement}
 */
function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const key in attrs) el.setAttribute(key, attrs[key]);
  el.append(...children);
  return el;
}

/** Render the Linear Logo as an inline SVG. */
function LinearLogo(color = '#5E6AD2') {
  return s(
    'svg',
    {
      viewBox: '0 0 100 100',
      width: '16',
      height: '16',
      'aria-hidden': 'true',
    },
    s('path', {
      fill: color,
      d: 'M1.2254 61.5228c-.2225-.9485.9075-1.5459 1.5964-.857l36.5124 36.5124c.6889.6889.0915 1.8189-.857 1.5964C20.0515 94.4522 5.5478 79.9485 1.2254 61.5228ZM.002 46.8891a.9896.9896 0 0 0 .2896.7606l52.0588 52.0588a.9887.9887 0 0 0 .7606.2896 50.0747 50.0747 0 0 0 6.9624-.9259c.7645-.157 1.0301-1.0963.4782-1.6481L2.576 39.4485c-.552-.5519-1.4912-.2863-1.6482.4782a50.0671 50.0671 0 0 0-.926 6.9624Zm4.209-17.1837c-.1665.3738-.0817.8106.2077 1.1l64.776 64.776c.2894.2894.7262.3742 1.1.2077a49.9079 49.9079 0 0 0 5.1855-2.684c.5521-.328.6373-1.0867.1832-1.5407L8.4357 24.3367c-.4541-.4541-1.2128-.3689-1.5408.1832a49.8961 49.8961 0 0 0-2.684 5.1855Zm8.4478-11.6314c-.3701-.3701-.393-.9637-.0443-1.3541C21.7795 6.4593 35.1114 0 49.9519 0 77.5927 0 100 22.4073 100 50.0481c0 14.8405-6.4593 28.1724-16.7199 37.3375-.3903.3487-.984.3258-1.3542-.0443L12.6587 18.074Z',
    })
  );
}

/**
 * Create a URL that will open a pre-filled new issue in Linear.
 * Takes user preferences into account.
 * @param {string} title Title to pre-fill in the new issue
 * @param {string} description Description to pre-fill in the new issue
 * @returns {Promise<string>}
 */
async function getNewIssueUrl(title, description) {
  const createIssueUrl = new URL('https://linear.app/new');
  createIssueUrl.searchParams.set('title', title);
  createIssueUrl.searchParams.set('description', description);
  // Load default parameters from user preferences.
  const defaults = await new Promise((resolve) => {
    chrome.storage.local.get({ defaults: {} }, ({ defaults }) => {
      resolve(defaults);
    });
  });
  // Add user preferences to URL.
  if (defaults?.team) {
    createIssueUrl.pathname = `/team/${defaults.team}/new`;
  }
  if (defaults?.assignee) {
    createIssueUrl.searchParams.set('assignee', defaults.assignee);
  }
  return createIssueUrl.href;
}

/**
 * Search for an existing Linear issue that references this GitHub issue/PR.
 * Finds issues which match one of the following criteria:
 * - The issue title or description contains the current page URL.
 * - The issue title or description contains an `{org}/{repo}#{number}` string matching the current issue/PR.
 * - The issue has an attachment linking back to the current page.
 * @param {string} issueUrl URL for the current issue or PR
 * @param {string} identifier Short-form identifier in the form of `{org}/{repo}#{number}`
 * @returns {Promise<null | { url: string; identifier: string; state: { name: string } }>}
 */
async function fetchExistingIssue(issueUrl, identifier) {
  const response = await new Promise((resolve) => {
    // Use callback-style of sendMessage because Promise-style requires Manifest v3 in Chrome.
    chrome.runtime.sendMessage(
      {
        linearQuery: `{
  issueSearch(
    filter: {
      or: [
        { description: { containsIgnoreCase: "${identifier}" } }
        { description: { containsIgnoreCase: "${issueUrl}" }  }
        { title: { containsIgnoreCase: "${identifier}" } }
        { title: { containsIgnoreCase: "${issueUrl}" } }
        { attachments: { url: { containsIgnoreCase: "${issueUrl}" } } }
      ]
    }
    first: 1
  ) {
    nodes {
      url
      identifier
      state { name }
    }
  }
}`,
      },
      // @ts-expect-error `chrome-types` doesn’t cover this signature, but it does work.
      (response) => resolve(response)
    );
  });
  return response?.data?.issueSearch?.nodes?.[0] || null;
}

/** Get the current URL without any query params or fragment hashes. */
function cleanUrl() {
  const rawUrl = new URL(window.location.href);
  rawUrl.hash = '';
  rawUrl.searchParams.forEach((_, key) => rawUrl.searchParams.delete(key));
  return rawUrl.href;
}
