# Memory River

A complete React + Three.js project featuring a winding photo river, a scroll-controlled camera, background music, and a spiral galaxy finale at the final photo.

The current version includes broader river bends, a camera distance of 8, a camera height of 6, a baseline photo spacing of 4.6, and a continuous photo sequence in upload order. Photos stay fixed and opaque along the river; camera movement no longer triggers visibility selection or fade-in.

## Use in CodeSandbox

This is a **React + Vite project**. Use a Vite or Devbox environment with Node.js support.
Unlike older React templates, Vite keeps `index.html` in the project root instead of `public/`.

1. Extract the generated CodeSandbox ZIP archive.
2. Create a React + Vite project or Node.js Devbox in CodeSandbox.
3. Upload all extracted files and folders to the project root, preserving their structure and replacing matching files. Include `package.json`, `package-lock.json`, `index.html`, `vite.config.js`, `src/`, and `.codesandbox/`.
4. Run `npm ci`, followed by `npm run dev`. Skip these commands if the environment has already installed dependencies and started the application automatically.
5. Open the preview on port 5173, select your photos, and scroll to explore.

If your import interface supports ZIP archives, you can select the archive directly. Otherwise, extract it before uploading. Do not upload the ZIP as an application asset inside `src/`.

Do not mix this project's entry files with an older template's `src/index.js` or `public/index.html`.

## Project Files

- `src/App.jsx`: Main application, including photo placement, river geometry, camera movement, and particle effects.
- `src/GalaxyFinale.jsx`: Animated spiral galaxy, star glow, and dust layers behind the final photo.
- `src/galaxy.js`: Seeded galaxy geometry and final-photo trigger logic.
- `src/photoRiver.js`: Shared layout settings, the winding path, fixed photo poses, and frame clearance checks.
- `src/index.jsx`: React entry point.
- `src/styles.css`: Global styles.
- `index.html`: HTML entry point.
- `public/`: Optional static assets.
- `package.json` / `package-lock.json`: Dependencies and application commands.
- `vite.config.js`: Development server configuration.
- `.codesandbox/tasks.json`: CodeSandbox development task.
- `scripts/galaxy.test.js`: Regression tests for the finale trigger and stable galaxy geometry.
- `scripts/river-layout.test.js`: Regression tests for photo order, stable poses, and frame clearance.
- `scripts/package-project.py`: Rebuilds the CodeSandbox ZIP archive from the current source files.

## Run Locally

Requires Node.js 22.12 or later.

```sh
npm ci
npm run dev
```

Build the production application with `npm run build`. The output is written to `dist/`.

Run the river layout regression tests:

```sh
node --test scripts/*.test.js
```

Rebuild the upload archive with Python:

```sh
python3 scripts/package-project.py
```

## Update and Sync

Uploading a ZIP creates a one-time copy. It does not automatically send subsequent local changes to CodeSandbox.

For continued synchronization, use the same GitHub repository and branch locally and in CodeSandbox:

1. Import the GitHub repository into CodeSandbox using **Import from GitHub**.
2. Make changes locally, verify them, then commit and push to GitHub.
3. Pull or sync the latest commits from the same branch in CodeSandbox. Saving a local file alone does not trigger remote synchronization.
4. If you also edit files in CodeSandbox, commit and push those changes, then pull them locally before continuing.

Repository: [201870041/Memory_River](https://github.com/201870041/Memory_River)

Working branch: `main`. The original `Reverie` repository is retained; subsequent updates use `Memory_River`.

[Import into CodeSandbox](https://codesandbox.io/p/github/201870041/Memory_River)

The local project is connected to the remote repository. Changes requested in this chat are checked, committed, and pushed to the working branch. Use the same branch in CodeSandbox and pull the latest commits.

There is no background file watcher, automatic commit service, or automatic push service. Each synchronization requires a Git commit and push.

## Galaxy Finale

The galaxy begins fading in when the camera reaches the final photo's position. It features five spiral arms, 16,000 stars, and 3,500 soft dust particles. The galaxy sits behind the final image, which remains visible. It stays present while you rest at the endpoint and fades out when you scroll back.

For a single-photo journey, the trigger uses that photo's midpoint position rather than the end of the empty path. The galaxy replaces the previous fireworks finale.

## Photos and Music

Photos and music are selected in the browser at runtime and accessed through local object URLs. The application does not save selected files to GitHub.

The sequence follows the file order supplied by the browser file picker, which may depend on the operating system. All selected photo textures load together before the journey proceeds; scrolling does not load or reveal photos one at a time. Natural perspective can still cause a nearer photo to obscure a distant one.

Select your files again after refreshing the preview. Photos currently use a fixed 4:3 display frame, so portrait images may be cropped.

## References

- [CodeSandbox GitHub Projects](https://projects.codesandbox.io/)
- [Add a Local Project to GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)
