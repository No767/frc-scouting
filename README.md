# FRC 5507 Scouting

A match scouting app for FRC. Scouts record match data on a phone or
tablet, and the app generates a QR code that is scanned into a spreadsheet.
No network connection is needed at the venue.

Live site: <https://jsneer23.github.io/frc-scouting/>

## Setup

Follow the section for your operating system, then continue to
"Install project tools".

### macOS

Install [Homebrew](https://brew.sh), a package manager for command-line
software:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

The installer prints two or three commands at the end under **Next steps**.
**Run them.** They add Homebrew to your PATH. If you skip this, the `brew`
command will not be found in new terminal windows.

Open a new terminal window and verify:

```bash
brew --version
```

Then install mise:

```bash
brew install mise
```

Add mise to your shell. Check whether the line is already there first —
some installers add it for you:

```bash
grep mise ~/.zshrc
```

If nothing is printed, add it:

```bash
echo 'eval "$(mise activate zsh)"' >> ~/.zshrc
```

**Open a new terminal window.** The change does not apply to the window you
are using.

### Windows

Windows uses WSL2, which runs Ubuntu inside Windows. This means everyone on
the team runs the same commands, and problems are easier to solve together.

Open **PowerShell as Administrator** and run:

```powershell
wsl --install
```

Restart your computer. Then open the **Ubuntu** app from the Start menu. The
first launch asks you to create a username and password — this account is
separate from your Windows account.

**Every remaining instruction runs inside Ubuntu**, not in PowerShell or
Command Prompt.

Install Homebrew:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Run the commands it prints under **Next steps**.

Install mise and add it to your shell:

```bash
brew install mise
echo 'eval "$(mise activate bash)"' >> ~/.bashrc
```

Note `bash`, not `zsh` — Ubuntu uses bash by default.

Open a new Ubuntu window.

## Install project tools

mise reads `mise.toml` and installs the exact Node and pnpm versions this
project expects. You do not install pnpm separately.

```bash
git clone https://github.com/jsneer23/frc-scouting.git
cd frc-scouting
mise install
```

> **Windows users:** clone into your Linux home directory
> (`~/dev/frc-scouting`), **not** into `/mnt/c/...`. Running the project from
> the Windows filesystem makes `pnpm install` many times slower.

Verify that Node and pnpm come from mise:

```bash
which node
which pnpm
```

You should see paths containing `mise`:

```
/Users/<username>/.local/share/mise/installs/node/24/bin/node
/Users/<username>/.local/share/mise/installs/pnpm/12.14.0/bin/pnpm
```

If the paths do **not** contain `mise`, see
[Conflicting version managers](#conflicting-version-managers).

Finally, install dependencies:

```bash
cd web
pnpm install
```

## mise tasks

mise runs project tasks defined in `mise.toml`. Run them from the repository
root, not from `web`.

List all available tasks:

```bash
mise tasks
```

### Updating pnpm

The pnpm version is pinned in two files that must agree: `mise.toml` and
`web/package.json`. If they disagree, `pnpm install` fails while trying
to switch versions.

Two tasks handle this together.

**See recent versions:**

```bash
mise run pnpm:check_version
```

This prints the five newest pnpm releases.

**Update to a version:**

```bash
mise run pnpm:update 12.14.0
```

The version argument is required. Without it the task fails with
`Missing required arg: <version>`.

The task updates both files, then runs `pnpm install`, `pnpm typecheck`, and
`pnpm build` to confirm nothing broke.

Commit all three changed files together:

```bash
git add mise.toml web/package.json web/pnpm-lock.yaml
git commit -m "update pnpm to 12.14.0"
```

Committing only some of them leaves the repo in a state where the two pinned
versions disagree.

## Available Commands

This project uses [Biome](https://biomejs.dev/) for linting and formatting. The following commands are available:

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev server with hot reload |
| `pnpm typecheck` | Type check — Biome does **not** check types |
| `pnpm build` | Production build into `dist/` |
| `pnpm preview` | Serve the production build locally |
| `pnpm biome check --write src/` | Format and fix lint issues |

Run `pnpm typecheck` before committing. CI runs it and will fail the build.



## Troubleshooting

### Conflicting version managers

If `which node` or `which pnpm` shows a path without `mise`, another tool is
taking priority. The usual causes are **fnm** and a **pnpm setup block**.

Check your shell config (`~/.zshrc` on macOS, `~/.bashrc` on Ubuntu):

```bash
cat ~/.zshrc
```

Delete or comment out:

- any line containing `fnm env`
- the block between `# pnpm` and `# pnpm end`

Keep the mise line. Then **open a new terminal window** — `eval` in your
current window cannot undo a PATH that is already set.

### `brew: command not found`

The post-install PATH commands were not run. Re-run the Homebrew installer
and follow its **Next steps** output.

### `pnpm: command not found`

mise is not activated, or you did not open a new terminal after editing your
shell config.

### `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`

A dependency was published too recently for pnpm's supply-chain policy. This
is working as intended. Wait a day, or delete `web/pnpm-lock.yaml` and
run `pnpm install` for a fresh resolution.


## Getting Started

To run this application:

```bash
cd web
pnpm dev
```

Open <http://localhost:3000/frc-scouting/>.

**Note the path.** This app is served from a subdirectory on GitHub Pages,
so the dev server uses the same path. `http://localhost:3000/` will not work.

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.


## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).


# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
