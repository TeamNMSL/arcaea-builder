import path from "path";
import fs from "fs-extra";
import plist from "plist";
import yaml from "js-yaml";
import { DOMParser, XMLSerializer } from "xmldom";

import { Action } from "@/action";
import { exec } from "@/lib/exec";

async function patchiOSMetadata(appDir: string) {
  const plistPath = path.join(appDir, "Info.plist");
  const metadata = plist.parse(await fs.readFile(plistPath, "utf-8")) as any;

  // Name
  metadata.CFBundleDisplayName = projectConfig.name;

  // ID
  metadata.CFBundleIdentifier = projectConfig.packageId;

  // Icons
  delete metadata.CFBundleIcons;
  delete metadata["CFBundleIcons~ipad"];
  metadata.CFBundleIconFile = "AppIcon83.5x83.5@2x~ipad.png";
  metadata.CFBundleIconFiles = ["AppIcon20x20", "AppIcon29x29", "AppIcon40x40", "AppIcon60x60", "AppIcon76x76", "AppIcon83.5x83.5"];

  // Version
  metadata.CFBundleShortVersionString = metadata.CFBundleVersion = projectConfig.version;

  // Enable file sharing
  metadata.UIFileSharingEnabled = true;

  // Allow installing on both iPhone and iPad
  metadata.UISupportedDevices = ["MacFamily20,1", "iPad11,1", "iPad11,2", "iPad11,3", "iPad11,4", "iPad11,6", "iPad11,7", "iPad13,1", "iPad13,2", "iPad5,1", "iPad5,2", "iPad5,3", "iPad5,4", "iPad6,11", "iPad6,12", "iPad6,3", "iPad6,4", "iPad6,7", "iPad6,8", "iPad7,1", "iPad7,11", "iPad7,12", "iPad7,2", "iPad7,3", "iPad7,4", "iPad7,5", "iPad7,6", "iPad8,1", "iPad8,10", "iPad8,11", "iPad8,12", "iPad8,2", "iPad8,3", "iPad8,4", "iPad8,5", "iPad8,6", "iPad8,7", "iPad8,8", "iPad8,9", "iPhone10,1", "iPhone10,4", "iPhone12,8", "iPhone8,1", "iPhone8,4", "iPhone9,1", "iPhone9,3", "iPod9,1"];

  await fs.writeFile(plistPath, plist.build(metadata, { pretty: true, indent: "\t" }))
}

function replaceOnce(filename: string, replaces: [src: string, dst: string][]) {
  let content = fs.readFileSync(filename, "utf-8");
  for (const [src, dst] of replaces) {
    const splitted = content.split(src);
    if (splitted.length !== 2) {
      logger.error(`Failed to patch ${filename}:`);

      if (splitted.length === 1) logger.fatal(`replaceOnce() doesn't find ${JSON.stringify(src)}`);
      else logger.fatal(`replaceOnce() find multiple occurrences of ${JSON.stringify(src)}`);
    }

    content = splitted.join(dst);
  }
  fs.writeFileSync(filename, content);
}

async function patchAndroidMetadata(packageDir: string) {
  const manifestFile = path.join(packageDir, "AndroidManifest.xml");
  const manifest = new DOMParser().parseFromString(await fs.readFile(manifestFile, "utf-8"));

  // ID
  const originalId = manifest.documentElement.getAttribute("package");
  manifest.documentElement.setAttribute("package", projectConfig.packageId);

  // Enable debugging
  manifest.getElementsByTagName("application")[0].setAttribute("android:debuggable", "true");

  // Remove conflict permissions
  [
    ...Array.from(manifest.getElementsByTagName("permission")),
    ...Array.from(manifest.getElementsByTagName("uses-permission")),
  ].filter(e => e.getAttribute("android:name").startsWith(originalId)).forEach(e => e.parentNode.removeChild(e));

  // Rename conflict permissions
  Array.from(manifest.getElementsByTagName("provider")).map(
    e => e.setAttribute("android:authorities", e.getAttribute("android:authorities").replace(originalId, projectConfig.packageId))
  );

  // Rename conflict intent receivers
  Array.from(manifest.getElementsByTagName("category")).map(
    e => e.setAttribute("android:name", e.getAttribute("android:name").replace(originalId, projectConfig.packageId))
  );

  await fs.writeFile(manifestFile, new XMLSerializer().serializeToString(manifest));

  // Name
  const stringsFile = path.join(packageDir, "res/values/strings.xml");
  const strings = new DOMParser().parseFromString(await fs.readFile(stringsFile, "utf-8"));
  Array.from(strings.getElementsByTagName("string")).find(e => e.getAttribute("name") === "app_name").textContent = projectConfig.name;
  await fs.writeFile(stringsFile, new XMLSerializer().serializeToString(strings));

  // Version

  const apktoolYamlFile = path.join(packageDir, "apktool.yml");
  const apktoolYamlContent = await fs.readFile(apktoolYamlFile, "utf-8");
  const apktoolYamlLines = apktoolYamlContent.split("\n");

  // With the first line "!!brut.androlib.meta.MetaInfo" the yaml parser fails
  const illegalFirstLine = "!!brut.androlib.meta.MetaInfo";
  const isFirstLineIllegal = apktoolYamlLines[0] === illegalFirstLine;
  if (isFirstLineIllegal) apktoolYamlLines.shift();

  const apktoolYaml = yaml.load(apktoolYamlLines.join("\n")) as any;
  const originalVersionCode = Number(apktoolYaml.versionInfo.versionCode);
  const originalVersionName = apktoolYaml.versionInfo.versionName as string;

  apktoolYaml.versionInfo.versionCode = String(projectConfig.androidPackage.versionCode);
  apktoolYaml.versionInfo.versionName = projectConfig.version;

  fs.writeFile(apktoolYamlFile, (isFirstLineIllegal ? illegalFirstLine + "\n" : "") + yaml.dump(apktoolYaml));

  // Modify version info in smali files
  replaceOnce(
    path.join(packageDir, "smali/low/moe/AppActivity.smali"),
    [
      [
        `const-string p1, "${originalVersionName}"`,
        `const-string p1, "${projectConfig.version}"`
      ]
    ]
  );
  replaceOnce(
    path.join(packageDir, "smali/moe/low/arcdev/BuildConfig.smali"),
    [
      [
        `.field public static final APPLICATION_ID:Ljava/lang/String; = "${originalId}"`,
        `.field public static final APPLICATION_ID:Ljava/lang/String; = "${projectConfig.packageId}"`
      ],
      [
        `.field public static final VERSION_NAME:Ljava/lang/String; = "${originalVersionName}"`,
        `.field public static final VERSION_NAME:Ljava/lang/String; = "${projectConfig.version}"`
      ],
      [
        `.field public static final VERSION_CODE:I = 0x${originalVersionCode.toString(16)}`,
        `.field public static final VERSION_CODE:I = 0x${projectConfig.androidPackage.versionCode.toString(16)}`
      ]
    ]
  );
}

export const action: Action = {
  dependencies: ["unpack", "icon", "songs", "binary"],
  action: async (args: string[]) => {
    const allTargets = Object.keys(projectConfig.targets);
    const targets = args.length === 0 ? allTargets : args;
    for (const target of targets)
      if (!allTargets.includes(target))
        logger.fatal(`Unknown repack target ${JSON.stringify(target)}`);

    const iconDir = path.join(projectDistDir, "icon");
    const assetsDir = path.join(projectDistDir, "assets");
    const binaryDir = path.join(projectDistDir, "binary");
    const packagesDir = path.join(projectDistDir, "packages");
    const customAssetsDir = path.join(projectDir, "assets");

    const packageName = `${projectConfig.name}_${projectConfig.version}`;

    const tempDir = path.join(projectDistDir, "temp");
    await fs.remove(tempDir);
    await fs.mkdir(tempDir);
    logger.info(`Copying original packages to the temp directory: ${tempDir}`);

    const androidSubDir = "package";
    const iOSSubDir = "Payload";

    await Promise.all([androidSubDir, iOSSubDir].map(
      subDir => fs.copy(path.join(projectOriginalDir, subDir), path.join(tempDir, subDir))
    ));
    
    const androidPackageDir = path.join(tempDir, androidSubDir);
    const iOSPackageDir = path.join(tempDir, iOSSubDir);
    
    const androidAssetsDir = path.join(androidPackageDir, "assets");
    const iOSAssetsDir = path.join(iOSPackageDir, "Arc-mobile.app");

    // Android
    const apkFile = path.join(packagesDir, `${packageName}.apk`);
    if (targets.includes("android")) {
      logger.info("Patching Android app metadata");
      await patchAndroidMetadata(androidPackageDir);
  
      logger.info("Copying icons to Android app directory");
      await fs.copy(path.join(iconDir, "android"), path.join(androidPackageDir, "res"));
  
      logger.info("Copying assets to Android app directory");
      await fs.copy(assetsDir, androidAssetsDir);
  
      if (await fs.pathExists(customAssetsDir)) {
        logger.info("Copying custom assets to Android app directory");
        await fs.copy(customAssetsDir, androidAssetsDir);
      }
  
      logger.info("Copying patched binary to Android app directory");
      await fs.copy(path.join(binaryDir, "android"), path.join(androidPackageDir, "lib/armeabi-v7a/libcocos2dcpp.so"));
  
      logger.info("Repacking android app");
      await fs.remove(apkFile);
      exec("apktool", [
        "b",
        androidPackageDir,
        "-o",
        apkFile
      ]);
  
      if (!await fs.pathExists(apkFile))
        logger.fatal("Failed to repack Android app. Please refer to the log above!");
  
      logger.info("Signing android app");
      exec("jarsigner", [
        "-sigalg", "SHA1withRSA", "-digestalg", "SHA1", "-keystore",
        projectConfig.androidPackage.signing.keystore,
        "-storepass",
        projectConfig.androidPackage.signing.storepass,
        apkFile,
        projectConfig.androidPackage.signing.alias
      ]);  
    }

    // iOS
    const ipaFile = path.join(packagesDir, `${packageName}.ipa`);
    if (targets.includes("ios")) {
      logger.info("Patching iOS app metadata (Info.plist)");
      await patchiOSMetadata(iOSAssetsDir);
  
      logger.info("Copying icons to iOS app directory");
      await fs.copy(path.join(iconDir, "ios"), iOSAssetsDir);
  
      logger.info("Copying assets to iOS app directory");
      await fs.copy(assetsDir, iOSAssetsDir);
  
      if (await fs.pathExists(customAssetsDir)) {
        logger.info("Copying custom assets to iOS app directory");
        await fs.copy(customAssetsDir, iOSAssetsDir);
      }
  
      logger.info("Copying patched binary to iOS app directory");
      await fs.copy(path.join(binaryDir, "ios"), path.join(iOSAssetsDir, "Arc-mobile"));
  
      logger.info("Repacking iOS app");
      await fs.remove(ipaFile);
      exec("7z", [
        "a",
        ipaFile,
        iOSPackageDir
      ]);

      if (!await fs.pathExists(ipaFile))
        logger.fatal("Failed to repack iOS app. Please refer to the log above!");
    }

    logger.info("Finished!");
    if (targets.includes("android"))
      logger.info("The repacked Android app: " + apkFile);
    if (targets.includes("ios"))
      logger.info("The repacked iOS app:     " + ipaFile);

    return true;
  }
}
