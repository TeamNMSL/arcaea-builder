# Base packages

For copyright consideration, thie project isn't shipped with the official base packages. Please get the them yourself and put here.

The filenames are defined in [`project.yaml`](../project.yaml).

# Extra songs

If you want to use (with `from` in a metadata file, see the [README](../packs/pack1/song1)) a song marked as `remote_dl` in the official package, you need to put the `dl` directory in this directory. You can find the `dl` directory in the app data of the mobile client (root access or repacking may be needed).

If you want to use a official song that isn't in package of the version you selected (i.e. released in a newer version of Arcaea or Nitendo Switch-only), you can put that version's unpacked `songs` directory to `original` and name it whether you want. e.g. If you name it `newer` (`original/newer/songlist` will contain the official song list) and want to use the song Aegleseeker, just write `from: newer/aegleseeker` in your metadata.
