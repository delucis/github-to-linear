# <img src="resources/store-icon.svg" alt="" align="left" width="45"> GitHub to Linear

> Browser extension that adds an “Add to Linear” button to GitHub issues and PRs.

## Install

[link-chrome]: https://chrome.google.com/webstore/detail/github-to-linear/hlambaminaoofejligodincejhcbljik 'Version published on Chrome Web Store'
[link-firefox]: https://addons.mozilla.org/firefox/addon/github-to-linear/ 'Version published on Mozilla Add-ons'

[<img src="https://raw.githubusercontent.com/alrra/browser-logos/90fdf03c/src/chrome/chrome.svg" width="48" alt="Chrome" valign="middle">][link-chrome] [<img valign="middle" src="https://img.shields.io/chrome-web-store/v/hlambaminaoofejligodincejhcbljik.svg?label=%20">][link-chrome] and other Chromium browsers

[<img src="https://raw.githubusercontent.com/alrra/browser-logos/90fdf03c/src/firefox/firefox.svg" width="48" alt="Firefox" valign="middle">][link-firefox] [<img valign="middle" src="https://img.shields.io/amo/v/github-to-linear.svg?label=%20">][link-firefox]

## Usage

### Basics

By default, this extension will show an <kbd>Add to Linear</kbd> button on every GitHub issue and PR.

### Enabling more features

You can enable more functionality by authenticating with the Linear API.

Currently, authenticating enables the following features:

- Set the default team and assignee to use when creating a new Linear issue.
- Show a link to an existing Linear issue instead of the “Add to Linear” button when one exists.

#### How to authenticate with Linear

1. [Create a new personal API key](https://linear.app/settings/api) in the Linear dashboard.
2. Open the extension options and paste your API key into the **Linear personal API key** field.

## Contribute

This is an open-source repository. You can

- [Create an issue](https://github.com/delucis/github-to-linear/issues/new/choose) to report a bug or make a feature request.
- Open a PR to submit changes to the code you made yourself.

## License

This software is free to use, modify, and redistribute under the [GNU General Public License v3.0](/LICENSE).
