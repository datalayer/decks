<!--
  ~ Copyright (c) 2022-2026 Datalayer, Inc.
  ~
  ~ Datalayer License
-->

# Making a release

One tag releases every package, with no stored token: PyPI and npm trust
`.github/workflows/release.yaml` through OIDC (trusted publishing).

| Package                             | Registry | GitHub environment |
| ----------------------------------- | -------- | ------------------ |
| `datalayer-decks`                   | PyPI     | `pypi`             |
| `@datalayer/decks`                  | npm      | `npm`              |
| `@datalayer/decks-plugin-ai-agents` | npm      | `npm`              |

`@datalayer/decks-app` is private: the interface it builds travels inside the
wheel (`share/datalayer/reactor/apps/decks`), it is not published on its own.

Every package carries **one version**. It lives in
`datalayer_decks/__version__.py` — hatch reads it, and so do the plugin
manifests — and the three `package.json` files carry copies.
`dev/bump_version.py` moves all four together, or refuses:

```bash
make bump-patch    # 1.0.3 -> 1.0.4
make bump-minor    # 1.0.3 -> 1.1.0
make bump-major    # 1.0.3 -> 2.0.0
```

## Steps

1. `make bump-patch` (or minor, major) on a branch, and open a pull request.
   CI (`ci.yaml`) builds and tests both halves.

1. Merge, then tag the merge commit and push the tag:

   ```bash
   git checkout main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

1. The `Release` workflow checks that the tag names the version every package
   carries, builds the reactor beside the checkout (the TypeScript
   configuration resolves `@datalayer/reactor` from `../reactor`, as in the
   Datalayer workspace), builds and tests the package and its plugin, builds
   the interface and the container into `share/`, builds the wheel and sdist
   with them inside, publishes what is not on the registries yet, and creates
   a GitHub release with generated notes.

The reactor checked out beside the repository is the release the package
floors on: `REACTOR_REF` in both workflows, to move with the floors in
`pyproject.toml` and `package.json`.

## Trusted publishing

- PyPI project `datalayer-decks`: owner `datalayer`, repository `decks`,
  workflow `release.yaml`, environment `pypi`. The project does not exist on
  PyPI until the first release, so it is registered as a *pending* publisher.
- npm packages `@datalayer/decks` and `@datalayer/decks-plugin-ai-agents`:
  GitHub Actions, organization `datalayer`, repository `decks`, workflow
  filename `release.yaml`, environment `npm`. npm provenance also checks each
  `package.json`'s `repository.url`, which names this repository.

The registry matches the repository, the workflow filename and the
environment exactly; renaming any of them means re-registering.
