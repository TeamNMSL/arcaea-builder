# The example song

Each song directory contains a song's all files.

## Use official song

If you want to add an official song (use the official version directly, or with some `filters`) to your project. You don't need to process it. Just write a song metadata with `from`:

```yaml
# "From" an official song ID
from: brandnewworld
# Apply some filters if you want 
filters:
  - name: tempoScale
    factor: 1.25
# Override some properties of generated matadata
# Such as adding version info and constants
version: '2.0'
difficulties:
  - constant: 2
  - constant: 5
  - constant: 9
```

Then the song will be fetched automatically from the unpacked data.

If the song is remote downloaded, you also need to put the `dl` directory from the app data to `original` directory.

If the song is not in the package you use (i.e. released in a newer version of Arcaea or Nitendo Switch-only), you can put that version's unpacked `songs` directory to `original` and name it whether you want. e.g. If you name it `newer` (`original/newer/songlist` will contain the official song list) and want to use the song Aegleseeker, just write `from: newer/aegleseeker` in your metadata.

## Audio

The filename must be `base.ogg`.

You can convert MP3 or WAV to OGG with [Audacity](https://www.audacityteam.org/) and choose the maximum quality.

## Cover image

For the main cover image, the filename is `b.ase.jpg` and `base_256.jpg`

`base.jpg` should be **512 x 512**. If not, the builder will scale it to 512 x 512 automatically.

`base_256.jpg` should be **256 x 256**. It's **optional**. If not exists, the builder will scale `base.jpg` to `base_256.jpg`.

You can use different images for different difficulties. Put some of `0.jpg` (PST), `1.jpg` (PRS), `2.jpg` (FTR) and `3.jpg` (BYD) files here. The `_256` files are also optional.

## Background image

If you want to use the background image bundled in the original game, just enter the background name in `song.yaml`'s `bg` field(s).

To use a custom background image, put the image in this directory with the name `bg.jpg`. The size should be **1280 x 960**.

To use different custom background images for some difficulties, put image files with the names `bg_0.jpg` (PST), `bg_1.jpg` (PRS), `bg_2.jpg` (FTR) and `bg_3.jpg` (BYD).

## Charts files

Put the song's charts here. The filenames are `0.aff` (PST), `1.aff` (PRS), `2.aff` (FTR) and `3.aff` (BYD).

If a difficulty's chart file isn't exist, please don't add its metadata in `song.yaml`. It will be locked in the game.

## Metadata

The metadata file is `song.yaml`. See the (example)[song.yaml] for more info.
