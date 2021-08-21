# The example project

This directory is an example project. You can use it as a boilerplate.

ALL `README.md` files inside the example project is only for introduction purpose. They are not required in a real project.

To build the example project, put official packages in [`original`](original) directory, then modify the `androidPackage.signing` fields in `project.yaml` and run:

```bash
export ARC_PROJECT=`pwd`

yarn action unpack

yarn action icon   # Re-run after you changed the icon file
yarn action binary # Re-run after you changed the binary.yaml file
yarn action songs  # Re-run after you updated songs

yarn action repack
```

Then it will print the repacked game package's files paths. You can install them to your devices and play.

The `arcsong.db` database file and `download` directory (if you used `remote_dl`) will be written to `dist/`. You can use it with [Arcaea-server](https://github.com/Lost-MSth/Arcaea-server).

See [`assets`](assets), [`packs`](packs), [`project.yaml`](project.yaml) and [`binary.yaml`](binary.yaml) for more info.
