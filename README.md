# Arcaea Builder

Build your own Arcaea game client to play self-made or modified official charts!

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
  * You can modify official songs (see the [example](example/packs/pack1/song1)) with [`filters`](#Filters).
  * Supports generate downloadable assets with `remote_dl`. Previews are made automatically.
* Repack the game packages automatically, with the custom name, version and so on.
  * The build is fully reproducible!

# Requirements

* Node.js (v16) and Yarn package manager (v1)
* Chrome browser
* 7z (p7zip-full)
* apktool (v2.5.0)
* jarsigner
* ffmpeg (4.4)

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

## Filters

You can add **filters** to a song. Supported filters are:

* `cut`
  * **Params:** `start`, `end`
  * Cut a song's part from `start` millseconds to `end` millseconds. The chart of all difficulties are also cut.
* `chartFixSpeed`
  * **Params:** none
  * Remove speed changes from a song's charts. i.e. Set all `timing()`'s BPM to the song's `bpm_base`.
* `tempoScale`
  * **Params:** `factor`
  * Speed up or down a song. The chart of all difficulties are also scaled.
  * The `factor` param is for the *tempo*. A value < 1 will speed down a song while a value > 1 will speed up a song.
  * Supported `factor` range is 0.5 - 2.

To apply filters, append a `filters` key to your `song.yaml`. For example:

```yaml
# Cut, then scale tempo to 0.9x
filters:
  - name: cut
    start: 111000
    end: 222000
  - name: tempoScale
    factor: 0.9
```

## Utilities

#### Extract songinfo

**NOTE:** You may not need to use this utiltily (especially for official songs). Use [`from`](example/packs/pack1/song1) to use an original song in your project.

If your song meta are defined in a `songlist` file, this utility can help you extract them to each song's directory.

```bash
# /path/to/your/songs/songlist must exist
# Extracted song.yaml will be saved in /path/to/your/songs/<songid>
yarn util extract-songinfo /path/to/your/songs
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
