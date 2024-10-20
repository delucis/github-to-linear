# Contributor Guide

## Prerequisites

You will need the following installed on your development machine:

- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/)

## Set-up

1. Clone the repository

2. Install development dependencies:

   ```sh
   pnpm install
   ```

## Development

This package use the [`web-ext`](https://www.npmjs.com/package/web-ext) package to provide some development utilities to test your work locally.

The development script will watch the extension source code and open a temporary Firefox instance in which the extension is running.
To start it, run the following command in your terminal:

```sh
pnpm dev
```

You can configure the extension options and browse GitHub as usual to test out if changes you make work as expected.

## Release notes

Releases are handled automatically by [Changesets](https://github.com/changesets/changesets/).

To add release notes for changes you made, run the following command in your terminal:

```sh
pnpm changeset
```

An interactive shell will ask you to specify the type of change you made (patch/minor/major), and then ask for a summary of the changes.

Add the generated Markdown file to your PR.
When creating a release, your Markdown file will be automatically integrated into the release notes.

## Publishing

Publishing is automatically handled by GitHub actions.

When there are unpublished changesets, a “Version Packages” PR will be opened.
Merging this PR will trigger the new version of the extension to be published to the Chrome and Firefox extension stores.

N.B. new versions are not always instantly available to users as they may sometimes be subject to review.
