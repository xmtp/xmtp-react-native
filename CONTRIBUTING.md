# Contributing

If you're seeing this document, you are an early contributor to the development and success of XMTP. We welcome your questions, feedback, suggestions, and code contributions.

## ❔ Questions

Have a question? We welcome you to ask it in [Q&A discussions](https://github.com/orgs/xmtp/discussions/categories/q-a).

## 🐞 Bugs

Bugs should be reported as GitHub Issues. Please confirm there isn't already an open issue and include detailed steps to reproduce.

## ✨ Feature Requests

These should also be submitted as GitHub Issues. Again, please confirm there isn't already an open issue. Let us know what use cases this feature would unlock so that we can investigate and prioritize.

## 🔀 Pull Requests

PRs are encouraged, but we suggest starting with a Feature Request to temperature-check first. If the PR would involve a major change to the protocol, it should be fleshed out as an [XMTP Improvement Proposal](https://github.com/xmtp/XIPs/blob/main/XIPs/xip-0-purpose-process.md) before work begins.

### AI-Generated Contributions Policy

We do not accept pull requests that are generated entirely or primarily by AI/LLM tools (e.g., GitHub Copilot, ChatGPT, Claude). This includes:

- Automated typo fixes or formatting changes
- Generic code improvements without context
- Mass automated updates or refactoring

Pull requests that appear to be AI-generated without meaningful human oversight will be closed without review. We value human-driven, thoughtful contributions that demonstrate an understanding of the codebase and project goals.

> [!CAUTION]
> To protect project quality and maintain contributor trust, we will restrict access for users who continue to submit AI-generated pull requests.

If you use AI tools to assist your development process, please:

1. Thoroughly review and understand all generated code
2. Provide detailed PR descriptions explaining your changes and reasoning
3. Be prepared to discuss your implementation decisions and how they align with the project goals

## 🔧 Developing

### Auto-releasing and commit conventions

A new version of this package will be automatically published whenever there is a merge to the `main` branch. Specifically, new GitHub releases and tags will be created, and a new NPM package version will be published. The release version increment type is derived from the format of the commit messages that were bundled in the merge to `main`, using [semantic-release commit message conventions](https://github.com/semantic-release/semantic-release#commit-message-format).

The table below shows example commits and the resulting release type for a `pencil` project:

<!-- prettier-ignore-start -->
| Commit message                                                                                                                                                                                   | Release type                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `docs: describe scribble feature` | No Release |
| `test: fix failing unit test` | No Release |
| `fix: stop graphite breaking when too much pressure applied` | ~~Patch~~ Fix Release |
| `feat: add 'graphiteWidth' option` | ~~Minor~~ Feature Release |
| `perf: remove graphiteWidth option`<br><br>`BREAKING CHANGE: The graphiteWidth option has been removed.`<br>`The default graphite width of 10mm is always used for performance reasons.` | ~~Major~~ Breaking Release <br /> (Note that the `BREAKING CHANGE:` token must be in the footer of the commit) |
<!-- prettier-ignore-end -->

This is currently configured to use the [Angular Commit Message Conventions](https://github.com/angular/angular/blob/master/CONTRIBUTING.md#-commit-message-format). e.g. `feat: add message signing` would cause a minor release.

If there are multiple commits within a single pull request, each commit will be listed as a separate bullet point in the [release notes](https://github.com/xmtp/xmtp-react-native/releases) and bundled together in a release of the highest increment type specified.

If your commit messages are not to your liking, it is permitted to rewrite the history on your branch and force-push it before merging it. Make sure you are never force-pushing on `main`, and that the following is in your `~/.gitconfig` file.

```
[push]
	default = simple
```

### Pre-release beta branch

A beta release of this package will be automatically published whenever there is a merge to the `beta` branch. For more information on the `beta` branch pre-release workflow, see [semantic-release pre-release workflow](https://semantic-release.gitbook.io/semantic-release/recipes/release-workflow/pre-releases).

#### When to target PRs against the beta branch?

We should only target the `beta` branch when new functionality would benefit from early testing by downstream clients. Otherwise, features and fixes that are easily testable without input from downstream clients should be targeted against the `main` branch as usual.
