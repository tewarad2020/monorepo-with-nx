# MonorepoWithNx

## CI performance experiment

CI runs on pushes to `main` and pull requests. `nx affected` selects projects
relative to the last successful main CI commit (PRs use the merge base), so a
failed main commit is not silently skipped. Manual **Run workflow** runs all
checks, which is useful for establishing a baseline and warming the cache.

- Frontend: TypeScript, all Vitest tests (non-watch), and production build.
- Backend: all Go tests with `-race -count=1`, `go vet`, and build.
- Changes limited to the frontend skip backend checks and Go setup, and vice versa.
- Shared configuration changes can affect both projects. Task inputs include
	toolchain versions; the backend additionally hashes Go platform/CGO settings.
- Nx can reuse successful task results and restore the backend binary from its
	declared output directory. It does not cache failures. Tests that depend on
	external services or nondeterministic state should not be cached.

### Optional remote cache

The workspace is already linked to Nx Cloud. Add the repository Actions secret
`NX_CLOUD_ACCESS_TOKEN` using a token from this workspace to enable cross-run task
caching. Use appropriate read/write permissions for trusted branches and restrict
untrusted PRs in Nx Cloud. Do not commit the token or expose it to fork PRs.
Without the secret, CI disables Nx Cloud and still benefits from affected
selection and parallel execution, but fresh runners have no prior Nx task cache.
Bun download and Go compiler caches are separate from Nx task caching.

### Compare fairly with the repository without Nx

Use the same runner, Node/Bun/Go versions, source changes, checks, and dependency
and Go compiler cache policies in both repositories. Do not compare an uncached
baseline with only a warm Nx run and call that an across-the-board speedup.

1. **Cold/full:** run all checks in both repositories with empty caches.
2. **Frontend-only:** change the same UI source in both and push a PR.
3. **Backend-only:** change the same Go source in both and push a PR.
4. **Warm/repeated:** repeat the same inputs after caches are populated; manual
	 Nx runs demonstrate task reuse without relying on an empty affected set.
5. **Shared config:** change configuration that requires both projects to run.

Repeat each case at least three times and compare median **total job duration**,
including checkout/setup/install/cache transfer. The GitHub job summary also
shows selected projects and check-only duration; Nx logs distinguish actual
execution from cache hits. If the other repo implements equivalent change
filtering and caching, compare against that optimized baseline too.

There is no guaranteed speedup: with just two small projects, Nx startup, Git
history checkout, and cache/network overhead can outweigh saved execution time.
This configuration is an experiment, not a measured performance claim.

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

✨ Your new, shiny [Nx workspace](https://nx.dev) is ready ✨.

[Learn more about this workspace setup and its capabilities](https://nx.dev/getting-started/intro#learn-nx?utm_source=nx_project&amp;utm_medium=readme&amp;utm_campaign=nx_projects) or run `npx nx graph` to visually explore what was created. Now, let's get you up to speed!

## Run tasks

To run tasks with Nx use:

```sh
npx nx <target> <project-name>
```

For example:

```sh
npx nx build myproject
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Add new projects

While you could add new projects to your workspace manually, you might want to leverage [Nx plugins](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) and their [code generation](https://nx.dev/features/generate-code?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) feature.

To install a new plugin you can use the `nx add` command. Here's an example of adding the React plugin:
```sh
npx nx add @nx/react
```

Use the plugin's generator to create new projects. For example, to create a new React app or library:

```sh
# Generate an app
npx nx g @nx/react:app demo

# Generate a library
npx nx g @nx/react:lib some-lib
```

You can use `npx nx list` to get a list of installed plugins. Then, run `npx nx list <plugin-name>` to learn about more specific capabilities of a particular plugin. Alternatively, [install Nx Console](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) to browse plugins and generators in your IDE.

[Learn more about Nx plugins &raquo;](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) | [Browse the plugin registry &raquo;](https://nx.dev/plugin-registry?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Set up CI!

### Step 1

To connect to Nx Cloud, run the following command:

```sh
npx nx connect
```

Connecting to Nx Cloud ensures a [fast and scalable CI](https://nx.dev/ci/intro/why-nx-cloud?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) pipeline. It includes features such as:

- [Remote caching](https://nx.dev/ci/features/remote-cache?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task distribution across multiple machines](https://nx.dev/ci/features/distribute-task-execution?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Automated e2e test splitting](https://nx.dev/ci/features/split-e2e-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task flakiness detection and rerunning](https://nx.dev/ci/features/flaky-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

### Step 2

Use the following command to configure a CI workflow for your workspace:

```sh
npx nx g ci-workflow
```

[Learn more about Nx on CI](https://nx.dev/ci/intro/ci-with-nx#ready-get-started-with-your-provider?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/getting-started/intro#learn-nx?utm_source=nx_project&amp;utm_medium=readme&amp;utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:
- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
