// Restore user authentication state on load.
document.addEventListener('DOMContentLoaded', function restoreApiKey() {
  chrome.storage.local.get({ pat: '' }, ({ pat }) => {
    document.getElementById('pat').value = pat;
    authenticate();
  });
});

// Store and authenticate a user’s API key on input.
document
  .getElementById('authentication-form')
  .addEventListener('input', function saveApiKey(event) {
    event.preventDefault();
    setAuthenticationStatus('Authenticating…');
    const pat = document.getElementById('pat').value;
    chrome.storage.local.set({ pat }, () => {
      authenticate();
    });
  });

// Store user preferences when they change something.
document
  .getElementById('preferences-form')
  .addEventListener('change', savePreferences);
document
  .getElementById('status-form')
  .addEventListener('change', savePreferences);

chrome.storage.onChanged.addListener(async ({ defaults }) => {
  if (defaults.newValue.team !== defaults.oldValue.team) {
    populateStatusPreferencesForm(undefined, defaults.newValue);
  }
});

/**
 * Authenticate by trying to fetch the logged-in user from Linear.
 * If successful, we let users know, and show them the preferences form.
 */
async function authenticate() {
  setAuthenticationStatus('Authenticating…');

  const user = await getCurrentUser();

  const status = user
    ? `Logged in to ` +
      (user.organization.logoUrl
        ? `<img src="${user.organization.logoUrl}" alt="" width="20" height="20" style="border-radius: 4px"> `
        : '') +
      `<strong>${user.organization.name}</strong> ` +
      `as ` +
      `<strong>${user.displayName}</strong> ` +
      `(${user.email})`
    : 'Not logged in with Linear';
  setAuthenticationStatus(status);

  if (user) {
    await populatePreferencesForm();
  } else {
    wipePreferencesForm();
  }
}

/**
 * Display the current authentication status to users.
 * @param {string} statusHTML HTML to display to users.
 */
function setAuthenticationStatus(statusHTML) {
  const status = document.getElementById('status');
  if (status) status.innerHTML = statusHTML;
}

/**
 * Build the preferences form UI once a user is authenticated
 * and restore previously saved user preferencs.
 */
async function populatePreferencesForm() {
  const data = await getWorkspaceInfo();
  if (!data) return;
  const { teams, users } = data;

  const assigneesMenu = Dropdown('Default Assignee', 'assignee', [
    '',
    ...users.nodes.map((u) => u.displayName),
  ]);
  const teamsMenu = Dropdown('Default Team', 'team', [
    '',
    ...teams.nodes.map((t) => t.key),
  ]);

  wipePreferencesForm();
  const form = document.getElementById('preferences-form');
  form.append(assigneesMenu, teamsMenu);
  await restorePreferences();
  await populateStatusPreferencesForm(data);
  // Uncollapse the preferences form now that it has been built.
  form.closest('details').open = true;
}

/**
 * @param {Awaited<ReturnType<typeof getWorkspaceInfo>>} [workspaceArg]
 * @param {Awaited<ReturnType<typeof loadPreferences>>} [preferencesArg]
 */
async function populateStatusPreferencesForm(workspaceArg, preferencesArg) {
  wipeStatusForm();
  const preferences = preferencesArg || (await loadPreferences());
  if (!preferences || !preferences.team) return;
  const workspace = workspaceArg || (await getWorkspaceInfo());
  if (!workspace) return;
  const team = workspace.teams.nodes.find(
    (team) => team.key === preferences.team
  );
  if (!team) return;
  const types = ['backlog', 'unstarted', 'started', 'completed', 'canceled'];
  const states = team.states.nodes
    .sort((a, b) => {
      const aTypeOrder = types.indexOf(a.type);
      const bTypeOrder = types.indexOf(b.type);
      if (a.type === b.type) {
        return a.position > b.position ? 1 : a.position < b.position ? -1 : 0;
      } else {
        return aTypeOrder > bTypeOrder ? 1 : aTypeOrder < bTypeOrder ? -1 : 0;
      }
    })
    .map((state) => state.name);
  states.unshift('');
  const statusPreferences = [
    Dropdown('Default Status from issue', 'issue', states),
    Dropdown('Default Status from draft PR', 'draftPR', states),
    Dropdown('Default Status from PR', 'pr', states),
  ];
  const form = document.getElementById('status-form');
  form.append(...statusPreferences);

  if (preferences.status) {
    for (const key of ['issue', 'pr', 'draftPR']) {
      const preference = preferences.status[key];
      if (preference && form[key]) form[key].value = preference;
    }
  }
}

/**
 * Create a `<select>` form control including label & wrapper paragraph.
 * @param {string} labelText Human-readable label for this form field.
 * @param {string} id `id` used to grab the form element in scripting.
 * @param {string[]} options Array of values to be shown in the `<select>` menu.
 * @returns {HTMLParagraphElement}
 */
function Dropdown(labelText, id, options) {
  const p = document.createElement('p');
  const label = document.createElement('label');
  label.classList.add('dropdown');
  label.textContent = labelText;
  const select = document.createElement('select');
  select.id = id;
  select.name = id;
  options.forEach((opt) => {
    const option = document.createElement('option');
    option.textContent = opt;
    select.append(option);
  });
  label.append(select);
  p.append(label);
  return p;
}

/**
 * Delete all the form elements in the preferences form.
 * Used when a user is no longer authenticated.
 */
function wipePreferencesForm() {
  wipeStatusForm();
  const form = document.getElementById('preferences-form');
  form.innerHTML = '';
  form.closest('details').open = false;
}

/**
 * Delete all the form elements in the status preferences form.
 * Used when a user is no longer authenticated.
 */
function wipeStatusForm() {
  const form = document.getElementById('status-form');
  form.innerHTML = '';
}

/**
 * Store the current state of the preferences form in browser storage.
 */
async function savePreferences() {
  /** @type {HTMLFormElement | null} */
  const form = document.getElementById('preferences-form');
  /** @type {HTMLFormElement | null} */
  const statuses = document.getElementById('status-form');
  /** @type {Awaited<ReturnType<typeof loadPreferences>>} */
  const defaults = { status: {} };
  if (form && form.elements.length > 0) {
    defaults.assignee = form.assignee.value;
    defaults.team = form.team.value;
  }
  if (statuses && statuses.elements.length > 0) {
    defaults.status.issue = statuses.issue.value;
    defaults.status.pr = statuses.pr.value;
    defaults.status.draftPR = statuses.draftPR.value;
  }
  chrome.storage.local.set({ defaults });
}

/**
 * Update the preferences form to reflect user preferences in browser storage.
 */
async function restorePreferences() {
  /** @type {HTMLFormElement | null} */
  const form = document.getElementById('preferences-form');
  if (!form || form.elements.length === 0) return;
  const defaults = await loadPreferences();
  for (const key of ['team', 'assignee']) {
    if (defaults[key] && form[key]) {
      form[key].value = defaults[key];
    }
  }
}

/**
 * Load user preferences from browser storage.
 * @returns {Promise<{ team?: string; assignee?: string; status?: { issue?: string; pr?: string; draftPR?: string } }>}
 */
function loadPreferences() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ defaults: {} }, ({ defaults }) => {
      resolve(defaults);
    });
  });
}

/**
 * Get the name and e-mail address of the authenticated user.
 * This helps confirm they are logged in using the correct API key.
 * @returns {Promise<null | { displayName: string; email: string; organization: { name: string; logoUrl?: string } }>}
 */
async function getCurrentUser() {
  const profile = await queryLinearApi(
    '{ viewer { displayName email organization { name logoUrl } } }'
  );
  return profile?.data?.viewer || null;
}

/**
 * Get information about the teams and users available in this workspace.
 * @returns {Promise<null | { teams: { nodes: { key: string; states: { nodes: { position: number; name: string; type: string }[] } }[] }; users: { nodes: { displayName: string }[] } }>}
 */
async function getWorkspaceInfo() {
  const workspace = await queryLinearApi(`{
  teams { nodes {
    key
    states { nodes { position name type } }
  } }
  users { nodes { displayName } }
}`);
  return workspace?.data || null;
}

// The functions below are duplicated here and in background.js
// because calling the background script from the preferences
// pane doesn’t seem to be supported.

/**
 * Load Linear API key from user preferences if set
 * @returns {Promise<string | null>}
 */
function loadLinearApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['pat'], ({ pat }) => resolve(pat || null));
  });
}

/**
 * Post a GraphQL query to the Linear API and get the parsed data back.
 * @param {string} query GraphQL query
 * @returns {Promise<any>}
 */
async function queryLinearApi(query) {
  try {
    const apiKey = await loadLinearApiKey();
    if (!apiKey) return null;
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}
