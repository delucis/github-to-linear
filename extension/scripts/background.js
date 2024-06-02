/**
 * Load Linear API key from user preferences if set
 * @returns {Promise<string | null>}
 */
function loadLinearApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['pat'], ({ pat }) => resolve(pat || null));
  });
}

/** @type {Map<string, { data: any; t: number}>} */
const queryCache = new Map();

/**
 * Post a GraphQL query to the Linear API and get the parsed data back.
 * @param {string} query GraphQL query
 * @returns {Promise<any>}
 */
async function queryLinearApi(query) {
  const apiKey = await loadLinearApiKey();
  if (!apiKey) return null;
  const cached = queryCache.get(query);
  if (cached && Date.now() - cached.t < 30_000) return cached.data;
  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const data = await response.json();
  queryCache.set(query, { data, t: Date.now() });
  return data;
}

// Handle messages from other parts of the extension.
// Currently handles messages containing a `linearQuery` GraphQL query,
// responding with data from the Linear API. All other messages will return null.
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  let query = Promise.resolve(null);
  if (request && typeof request === 'object' && 'linearQuery' in request) {
    query = queryLinearApi(request.linearQuery);
  }
  query
    .then((json) => sendResponse(json || null))
    .catch((error) => {
      console.error({ error });
      sendResponse(null);
    });
  return true;
});
