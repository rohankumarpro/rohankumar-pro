# Rohan Kumar desktop app (personal)

rohankumar.pro in its own window with no browser or Windows title bar. For the owner only; visitors keep using the website.

- The app is a thin shell: it loads the live site, so every deploy shows up in the app straight away.
  Rebuild only when something in this folder changes.
- Inside the app the site adds its own minimise, maximise and close buttons to the top bar. Drag the empty part of the top bar to move
  the window; double-click it to maximise. Size and position are remembered.
- Links to other sites open in your normal browser.
- Sign in to Owner mode once inside the app (it keeps its own cookies, separate from Chrome).

## Get the installer

GitHub builds it whenever this folder changes (workflow "Desktop app", also runnable by hand from the Actions tab).
Open the latest run, download "Rohan-Kumar-Windows", unzip, run the setup .exe.
Windows SmartScreen may say "Windows protected your PC" because the app isn't code-signed: More info → Run anyway.

## Build it yourself (Windows)

Needs Node 22 and Rust (rustup.rs). Then, in this folder: `npm ci` and `npx tauri build`.
The installer lands in `src-tauri/target/release/bundle/nsis/`.
