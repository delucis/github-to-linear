// Run on page load.
init();
// Run on each client-side navigation.
document.addEventListener('turbo:render', init);

function init() {
  injectSingleIssueUI();
  injectIssueListUI();
}

/**
 * Inject links to Linear issues on a GitHub list view of issues or PRs.
 */
async function injectIssueListUI() {
  const containerClass = 'gh2l-list-links';
  const issueRows = document.querySelectorAll('.js-issue-row');
  for (const row of issueRows) {
    if (row.querySelector('.' + containerClass)) continue;
    const link = row.querySelector('a');
    /** @type {HTMLSpanElement | null} */
    const slot = row.querySelector('.opened-by + span');
    if (!link || !slot) continue;
    const issueMetaData = parseGitHubUrl(link);
    if (!issueMetaData) continue;
    const identifier = makeGitHubIdentifier(issueMetaData);
    fetchExistingIssues({ url: link.href, identifier }).then((issues) => {
      if (!issues?.length) return;
      // Sort issues to show incomplete issues first.
      issues.sort((a, b) => {
        const states = { backlog: 0, unstarted: 1, started: 2, completed: 3, canceled: 4 };
        return states[a.state.type] - states[b.state.type];
      });
      const issueLinks = issues.map(InlineIssueLink);
      slot.insertAdjacentElement(
        'afterend',
        h('span', { class: `${containerClass} d-none d-md-inline-flex gap-2 ml-2` }, ...issueLinks)
      );
    });
  }
}

/**
 * Render a link to a Linear issue suitable for displaying inline in issue/pull request lists.
 * @param {NonNullable<Awaited<ReturnType<typeof fetchExistingIssues>>>[number]} linearIssue
 */
function InlineIssueLink(linearIssue) {
  return h(
    'a',
    {
      href: linearIssue.url,
      class: 'Link--muted d-inline-flex gap-1 flex-items-center tooltipped tooltipped-s',
      'aria-label': linearIssue.title,
    },
    StatusIcon(linearIssue.state),
    h('span', {}, linearIssue.identifier)
  );
}

/**
 * Only runs on issue & PR pages.
 * If a matching Linear issue is found, injects a link to the issue on Linear.
 * Otherwise, injects a link to create a new Linear issue linking to this page.
 */
async function injectSingleIssueUI() {
  /** ID for the link we’ll create. */
  const linkId = 'github-to-linear-create-issue-link';
  // We already created our link. Let’s chill.
  if (document.getElementById(linkId)) return;

  // Parse the current URL to grab some information about the issue or PR.
  const issueMetaData = parseGitHubUrl(location);
  // If we’re not in an issue or PR we can return early.
  if (!issueMetaData) return;

  // The header section of an issue/PR we want to inject our link into.
  const headerMeta = document.querySelector('.gh-header-meta');
  if (!headerMeta) {
    console.error('Could not find header meta to inject into.');
    return;
  }

  // Grab the issue or PR title (thank you GH for using the same class for both).
  const titleEl = document.querySelector('.js-issue-title');
  const issueTitle = titleEl?.textContent;

  const identifier = makeGitHubIdentifier(issueMetaData);
  let title = identifier;
  if (issueTitle) title += ' — ' + issueTitle;
  const typeLabel = issueMetaData.type === 'pull' ? 'PR' : 'Issue';
  const cleanedUrl = cleanUrl(issueMetaData.number)
  const description = `GitHub ${typeLabel}: ${cleanedUrl}`;
  const newIssueUrl = await getNewIssueUrl(title, description);

  const issues = await fetchExistingIssues({ url: cleanedUrl, identifier });
  const linearIssue = issues?.[0];

  const ButtonGroup = h(
    'div',
    { id: linkId, class: 'BtnGroup flex-self-start ml-auto' },
    // Main link to an existing issue or to create a new issue on Linear.
    h(
      'a',
      {
        href: linearIssue ? linearIssue.url : newIssueUrl,
        class: 'BtnGroup-item rounded-left-2 btn btn-sm',
      },
      h(
        'span',
        { class: 'gh2l-icon-text-lockup' },
        LinearLogo(),
        linearIssue ? linearIssue.identifier : 'Add to Linear'
      )
    ),
    // If there’s an existing issue, also show a smaller “+” button to for making new issues.
    linearIssue
      ? h(
          'a',
          {
            class: 'BtnGroup-item btn btn-sm',
            title: 'Create new Linear issue',
            href: newIssueUrl,
          },
          PlusIcon()
        )
      : ''
  );

  // Inject the link into the page.
  headerMeta.append(ButtonGroup);
  injectSidebarUI(issues);
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

/**
 * Get a curried `h` for a specific tag.
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Record<string, string>} attrs
 */
function hFactory(tag, attrs = {}) {
  /** @param {(string | Node)[]} children */
  return (...children) => h(tag, attrs, ...children);
}

/**
 * @param {Awaited<ReturnType<typeof fetchExistingIssues>>} issues
 */
function injectSidebarUI(issues) {
  /** ID for the infobox we’ll create. */
  const id = 'github-to-linear-issue-infobox';
  if (!issues?.length || document.getElementById(id) || isPrSubView()) {
    return;
  }
  const sidebar = document.querySelector('.Layout-sidebar');
  if (!sidebar) {
    console.error('Could not find page sidebar.');
    return;
  }

  const [firstIssue, ...moreIssues] = issues;
  const nMore = moreIssues.length;

  sidebar.prepend(
    h(
      'div',
      { id },
      IssueInfobox(firstIssue),
      nMore > 0
        ? h(
            'details',
            {},
            h(
              'summary',
              { class: 'f6 px-2 pb-1 Link--primary text-bold' },
              h(
                'span',
                {
                  class: 'd-inline-flex gap-1 flex-items-center',
                  style: 'vertical-align: middle;',
                },
                ...moreIssues.map((issue) => StatusIcon(issue.state)),
                `${nMore} more issue${nMore > 1 ? 's' : ''}`
              )
            ),
            ...moreIssues.map(IssueInfobox)
          )
        : ''
    )
  );
}

/**
 * @param {NonNullable<Awaited<ReturnType<typeof fetchExistingIssues>>>[number]} linearIssue
 */
function IssueInfobox(linearIssue) {
  const { assignee, cycle, project } = linearIssue;

  const TableRow = hFactory('tr');
  const TableHeader = hFactory('th', {
    class: 'text-left pr-2 color-fg-muted',
  });
  const TableCell = hFactory('td');

  const statusRow = TableRow(
    TableHeader('Status'),
    TableCell(
      h(
        'span',
        { class: 'gh2l-icon-text-lockup' },
        StatusIcon(linearIssue.state),
        h('span', {}, linearIssue.state.name)
      )
    )
  );

  const priorityRow = TableRow(
    TableHeader('Priority'),
    TableCell(
      h(
        'span',
        {
          class: [
            'gh2l-icon-text-lockup',
            linearIssue.priority === 0 ? 'color-fg-muted' : '',
          ].join(' '),
        },
        PriorityIcon(linearIssue.priority),
        h('span', {}, linearIssue.priorityLabel)
      )
    )
  );

  const assigneeRow = TableRow(
    TableHeader('Assignee'),
    TableCell(
      assignee
        ? h(
            'a',
            {
              href: assignee.url,
              class:
                'gh2l-assignee gh2l-icon-text-lockup' +
                (assignee.isMe ? ' gh2l-assignee-is-me' : ''),
            },
            assignee.avatarUrl
              ? h('img', {
                  src: assignee.avatarUrl,
                  width: '16',
                  height: '16',
                  class: 'gh2l-assignee-avatar avatar avatar-user',
                })
              : h(
                  'span',
                  {
                    class: 'gh2l-assignee-avatar-placeholder avatar',
                  },
                  assignee.displayName[0]
                ),
            h('span', {}, assignee.displayName)
          )
        : h('span', { class: 'color-fg-muted' }, 'Unassigned')
    )
  );

  /** @type {undefined | 'past' | 'present' | 'future'} */
  let cycleStatus;
  if (cycle) {
    const now = Date.now();
    const cycleStart = new Date(cycle.startsAt).getTime();
    const cycleEnd = new Date(cycle.endsAt).getTime();
    if (cycleStart > now) {
      cycleStatus = 'future';
    } else if (cycleEnd < now) {
      cycleStatus = 'past';
    } else {
      cycleStatus = 'present';
    }
  }
  const isCurrentCycle = cycleStatus === 'present';
  const cycleRow = TableRow(
    TableHeader('Cycle'),
    TableCell(
      cycle
        ? h(
            isCurrentCycle ? 'strong' : 'span',
            { class: cycleStatus === 'past' ? 'color-fg-muted' : '' },
            cycle.name || ''
          )
        : h('span', { class: 'color-fg-muted' }, 'not set'),
      isCurrentCycle ? ' (current)' : ''
    )
  );

  const projectRow = TableRow(
    TableHeader('Project'),
    TableCell(
      (project && h('a', { href: project.url }, project.name)) ||
        h('span', { class: 'color-fg-muted' }, 'not set')
    )
  );

  const dueDateRow = linearIssue.dueDate
    ? TableRow(TableHeader('Due'), TableCell(linearIssue.dueDate))
    : '';

  const labelsRow =
    linearIssue.labels.nodes.length > 0
      ? TableRow(
          TableHeader('Labels'),
          TableCell(
            ...linearIssue.labels.nodes.map((label, index, labels) =>
              h(
                'span',
                {
                  class:
                    'gh2l-label Label Label--inline' +
                    (index < labels.length - 1 ? ' mr-1' : ''),
                  style: `--gh2l-label-color: ${label.color}`,
                },
                label.name
              )
            )
          )
        )
      : '';

  return h(
    'div',
    { class: 'gh2l-issue-infobox border f6 mb-1 p-2 rounded-2' },
    InfoboxHeading(linearIssue),
    h('table', {}, statusRow, priorityRow, assigneeRow),
    h('div', { class: 'border-top my-2' }),
    h('table', {}, cycleRow, projectRow, dueDateRow, labelsRow)
  );
}

/**
 * Render the title of the issue infobox.
 * @param {NonNullable<Awaited<ReturnType<typeof fetchExistingIssues>>>[number]} linearIssue
 */
function InfoboxHeading(linearIssue) {
  return h(
    'p',
    { class: 'd-flex gap-1 flex-justify-between' },
    h(
      'a',
      {
        href: linearIssue.url,
        class: 'Link--primary gh2l-icon-text-lockup',
      },
      LinearLogo(linearIssue.team.color),
      h(
        'span',
        { class: 'Truncate gap-1' },
        h(
          'span',
          { class: 'text-bold flex-shrink-0' },
          linearIssue.identifier,
          ' '
        ),
        h('span', { class: 'Truncate-text color-fg-muted' }, linearIssue.title)
      )
    ),
    BranchCopyButton(linearIssue)
  );
}

/**
 * A button that copies Linear’s suggested branch name to the clipboard.
 * @param {NonNullable<Awaited<ReturnType<typeof fetchExistingIssues>>>[number]} linearIssue
 */
function BranchCopyButton({ branchName }) {
  const copyLabel = 'Copy suggested branch name';
  const branchButton = h(
    'button',
    {
      class: 'btn-octicon mt-n1 mb-n1 mr-n1 ml-0',
      type: 'button',
      title: copyLabel,
    },
    BranchIcon()
  );
  let timeout;
  branchButton.addEventListener('click', () => {
    navigator.clipboard.writeText(branchName).then(() => {
      clearTimeout(timeout);
      branchButton.title = 'Copied branch name!';
      branchButton.classList.add('anim-fade-in');
      timeout = setTimeout(() => {
        branchButton.title = copyLabel;
        branchButton.classList.remove('anim-fade-in');
      }, 2000);
    });
  });
  return branchButton;
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

function PlusIcon() {
  return Octicon(
    'M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z'
  );
}

function BranchIcon() {
  return Octicon(
    'M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z'
  );
}

/**
 * Render a GitHub octicon path with the appropriate attributes.
 * @param {string} d Path definition for the icon to render.
 */
function Octicon(d) {
  return s(
    'svg',
    {
      viewBox: '0 0 16 16',
      width: '16',
      height: '16',
      class: 'octicon',
      'aria-hidden': 'true',
    },
    s('path', { d })
  );
}

/**
 * Render an issue status icon, similar to Linear’s style.
 * @param {NonNullable<Awaited<ReturnType<typeof fetchExistingIssues>>>[number]['state']} state
 */
function StatusIcon({ type, color }) {
  const paths = {
    backlog:
      'M6.2 0a7 7 0 0 1 1.6 0l-.2 2a5 5 0 0 0-1.2 0l-.2-2Zm3.6.6a7 7 0 0 1 1.4.8L10 3a5 5 0 0 0-1-.6L9.8.6Zm-7 .8A7 7 0 0 1 4.2.6L5 2.4A5 5 0 0 0 4 3L2.8 1.4Zm9.8 1.4.8 1.4-1.8.8a5 5 0 0 0-.6-1l1.6-1.2ZM.6 4.2a7 7 0 0 1 .8-1.4L3 4a5 5 0 0 0-.6 1L.6 4.2Zm13.3 2a7 7 0 0 1 0 1.6l-2-.2a5 5 0 0 0 0-1.2l2-.2ZM0 7v-.8l2 .2a5 5 0 0 0 0 1.2l-2 .2A7 7 0 0 1 0 7Zm13.4 2.8a7 7 0 0 1-.8 1.4L11 10a5 5 0 0 0 .6-1l1.8.8Zm-12 1.4a7 7 0 0 1-.8-1.4L2.4 9a5 5 0 0 0 .6 1l-1.6 1.2Zm9.8 1.4a7 7 0 0 1-1.4.8L9 11.6a5 5 0 0 0 1-.6l1.2 1.6Zm-7 .8-1.4-.8L4 11a5 5 0 0 0 1 .6l-.8 1.8ZM7 14a7 7 0 0 1-.8 0l.2-2a5 5 0 0 0 1.2 0l.2 2a7 7 0 0 1-.8 0Z',
    unstarted: 'M7 2a5 5 0 1 0 0 10A5 5 0 0 0 7 2ZM0 7a7 7 0 1 1 14 0A7 7 0 0 1 0 7Z',
    started:
      'M2 7a5 5 0 1 1 10 0A5 5 0 0 1 2 7Zm5-7a7 7 0 1 0 0 14A7 7 0 0 0 7 0Zm4 7a4 4 0 0 1-4 4V3a4 4 0 0 1 4 4Z',
    completed:
      'M0 7a7 7 0 1 1 14 0A7 7 0 0 1 0 7Zm10.95-1.55a.85.85 0 1 0-1.2-1.2l-4.4 4.4-1.4-1.4a.85.85 0 1 0-1.2 1.2l2 2c.33.33.87.33 1.2 0l5-5Z',
    canceled:
      'M0 7a7 7 0 1 1 14 0A7 7 0 0 1 0 7Zm4.75-3a.75.75 0 0 0-.53 1.28l1.97 1.97-.99.98-.98.99a.75.75 0 1 0 1.06 1.06l1.97-1.97 1.97 1.97a.75.75 0 1 0 1.06-1.06L8.31 7.25l1.97-1.97a.75.75 0 0 0-.82-1.23.75.75 0 0 0-.24.17L7.25 6.19l-.98-.99-.99-.98A.75.75 0 0 0 4.75 4Z',
  };
  return s(
    'svg',
    {
      viewBox: '0 0 14 14',
      width: '14',
      height: '14',
      'aria-hidden': 'true',
      fill: color,
    },
    s('path', { d: paths[type] })
  );
}

/**
 * Render priority icons like Linear uses.
 * @param {number} priority
 */
function PriorityIcon(priority) {
  const threeBarIcon = [
    s('rect', { x: '1', y: '8', width: '3', height: '6', rx: '1' }),
    s('rect', { x: '6', y: '5', width: '3', height: '9', rx: '1' }),
    s('rect', { x: '11', y: '2', width: '3', height: '12', rx: '1' }),
  ];
  const priorityIcons = [
    /** No priority */
    [
      // prettier-ignore
      s('rect', { x: '1', y: '7.25', width: '3', height: '1.5', rx: '0.5', opacity: '0.9' }),
      // prettier-ignore
      s('rect', { x: '6', y: '7.25', width: '3', height: '1.5', rx: '0.5', opacity: '0.9' }),
      // prettier-ignore
      s('rect', { x: '11', y: '7.25', width: '3', height: '1.5', rx: '0.5', opacity: '0.9' }),
    ],
    /** Urgent */
    [
      // prettier-ignore
      s('path', { d: 'M3 1.346a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-10a2 2 0 0 0-2-2H3Zm3.914 3h1.738L8.5 9.948H7.07l-.156-5.602Zm1.809 7.164a.95.95 0 0 1-.938.938.934.934 0 1 1 0-1.867c.5 0 .934.417.938.929Z' }),
    ],
    /** High */
    threeBarIcon,
    /** Medium */
    threeBarIcon,
    /** Low */
    threeBarIcon,
  ];
  return h(
    'span',
    {
      class: `gh2l-priority-indicator gh2l-priority-${priority}`,
      'aria-hidden': 'true',
    },
    s(
      'svg',
      { width: '16', height: '16', viewBox: '0 0 16 16' },
      ...(priorityIcons[priority] || [])
    )
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
 * - In PRs: any of the above for issues linked to the PR.
 * @param {{ url: string; identifier: string }} currentIssue URL and identifier for the current page.
 * @returns {Promise<null | Array<{
 *  url: string;
 *  identifier: string;
 *  title: string;
 *  branchName: string;
 *  state: { name: string; color: string; type: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled' }
 *  priorityLabel: string;
 *  priority: number;
 *  assignee?: { avatarUrl?: string; displayName: string; isMe: boolean; url: string }
 *  cycle?: { name?: string; startsAt: string; endsAt: string }
 *  project?: { name: string; url: string }
 *  dueDate?: `${number}-${number}-${number}`
 *  labels: { nodes: { name: string; color: string }[] }
 *  team: { color?: string }
 * }>>}
 */
async function fetchExistingIssues(currentIssue) {
  const issues = [currentIssue, ...getLinkedIssues()];

  /** Format a block of GraphQL filter predicates for a given GitHub issue.  */
  const makeFilterBlock = ({ url, identifier }) =>
    `{ description: { containsIgnoreCase: "${identifier}" } }
      { description: { containsIgnoreCase: "${url}" }  }
      { title: { containsIgnoreCase: "${identifier}" } }
      { title: { containsIgnoreCase: "${url}" } }
      { attachments: { url: { containsIgnoreCase: "${url}" } } }`;

  const response = await new Promise((resolve) => {
    // Use callback-style of sendMessage because Promise-style requires Manifest v3 in Chrome.
    chrome.runtime.sendMessage(
      {
        linearQuery: `{
  issueSearch(
    filter: {
      or: [
        ${issues.map(makeFilterBlock).join('\n')}
      ]
    },
    includeArchived: true,
    first: 5
  ) {
    nodes {
      url
      identifier
      title
      branchName
      state { name color type }
      priorityLabel
      priority
      assignee { avatarUrl displayName isMe url }
      cycle { name startsAt endsAt }
      project { name url }
      dueDate
      labels {
        nodes { name color }
      }
      team { color }
    }
  }
}`,
      },
      // @ts-expect-error `chrome-types` doesn’t cover this signature, but it does work.
      (response) => resolve(response)
    );
  });
  return response?.data?.issueSearch?.nodes || null;
}

/** Get the current base PR/Issue URL without any query params or fragment hashes. */
function cleanUrl(number) {
  const rawUrl = new URL(window.location.href);
  rawUrl.hash = '';
  rawUrl.searchParams.forEach((_, key) => rawUrl.searchParams.delete(key));
  const url = rawUrl.href;
  const urlComponents = url.split('/')

  let component = urlComponents.pop()
  while(component !== number) {
    component = urlComponents.pop()
  }

  return urlComponents.reduce((acc, curr) => acc + '/' + curr) + '/' + number
}

/** Check if we’re on a PR tab like commits, checks, or files changed. */
function isPrSubView() {
  return /\/pull\/\d+\/.+$/.test(location.pathname);
}

/**
 * Try to parse a GitHub issue or PR URL to get some context from it.
 * @param {{ pathname: string }} url GitHub URL to parse
 * @returns {null|{ org: string; repo: string; type: 'issues' | 'pull'; number: string }}
 */
function parseGitHubUrl({ pathname }) {
  const matches = /^\/([^\/]+)\/([^\/]+)\/(issues|pull)\/(\d+)/.exec(pathname);
  if (!matches) return null;
  const [_fullMatch, org, repo, type, number] = matches;
  return { org, repo, type: /** @type {'issues'|'pull'} */ (type), number };
}

/**
 * Get a `{org}/{repo}#{number}` identifier for a GitHub issue or PR.
 * @param {NonNullable<ReturnType<typeof parseGitHubUrl>>} metadata
 */
function makeGitHubIdentifier({ org, repo, number }) {
  return `${org}/${repo}#${number}`;
}

/**
 * Finds the “Development” section in the GitHub PR sidebar and extracts URLs
 * for any GitHub issues linked to this PR.
 */
function getLinkedIssues() {
  const linkEls =
    document.querySelector('development-menu')?.querySelectorAll('a') || [];
  return [...linkEls]
    .map((a) => {
      const metadata = parseGitHubUrl(a);
      if (!metadata) return null;
      return {
        url: a.href,
        identifier: makeGitHubIdentifier(metadata),
      };
    })
    .filter(
      /** @type {<T>(arg: T) => arg is NonNullable<T>} */ ((a) => Boolean(a))
    );
}
