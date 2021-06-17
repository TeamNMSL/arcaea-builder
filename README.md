# Arcaea Builder

Build your own Arcaea game client to play self-made charts!

# Features

This project can help you automate the entire workflow for building your own Arcaea game client:

* Unpack original packages automatically (with `7z` for iOS and `apktool` for Android).
* Generate app icons for your choosen image (with `puppeteer`).
* Patch the game binary automatically.
  * There're some pre-defined offsets (including pack divider) in the [example](example) project.
  * You can find more patchable offsets with IDA.
* Manage your packs and songs in a structured manner and build for the [server](https://github.com/Lost-MSth/Arcaea-server) and game client easily.
  * The songs are stored inside the directoryr of its pack.
  * The songs' metadata is stored inside each song's directory.
* Repack the game packages automatically, with the custom name, version and so on.
  * The build is fully reproducible!

# Requirements

* Node.js (v16) and Yarn package manager (v1)
* Chrome browser
* 7z (p7zip-full)
* apktool (v2.5.0)
* jarsigner

The version above is tested. Other versions may work.

Only tested on Linux. Window and macOS may work.

# Usage

Install NPM dependencies with `yarn`:

```bash
yarn
```

And follow the instructions below.

## Project

See the [example project](example).

## Utilities

#### Extract songinfo

If your song meta are defined in a `songlist` file, this utility can help you extract them to each song's directory.

```bash
# /path/to/your/songs/songlist must exist
# Extracted song.yaml will be saved in /path/to/your/songs/<songid>
yarn util extract-songinfo /path/to/your/songs
```

#### Fix speed

Automatically remove speed changes from charts.

The being modified AFF files should be part of a project. i.e. There must be a `song.yaml` in its directory.

```bash
# Dry run
yarn util fix-speed /path/to/your/project/packs/<packname>/<songname>/*.aff
# Write changes
yarn util fix-speed -w /path/to/your/project/packs/<packname>/<songname>/*.aff
```

#### AFF fix

Some self-made charts are broken since some numbers are required to keep two decimal places but they doesn't. The utility can fix the numbers in `timing()`, `arc()` and `camera()` statements.

```bash
# Dry run
yarn util aff-fix /path/to/your/project/packs/<packname>/<songname>/*.aff
# Write changes
yarn util aff-fix -w /path/to/your/project/packs/<packname>/<songname>/*.aff
```

# Credits

* [ArcaeaModder (Android)](https://github.com/ArcaeaMemory/ArcaeaModder) for some Android offsets.
* [ArcaeaModder (iOS)](https://github.com/c8763yee/ArcaeaModder) for some iOS offsets.
* [Arcaea-server](https://github.com/Lost-MSth/Arcaea-server)
