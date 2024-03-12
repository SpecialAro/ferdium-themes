/* eslint-disable no-console */

/**
 * Package all themes
 */
const targz = require("targz");
const fs = require("fs-extra");
const path = require("path");
const sizeOf = require("image-size");
const simpleGit = require("simple-git");
const semver = require("semver");

const pkgVersionChangedMatcher = /\n\+.*version.*/;

// Publicly availible link to this repository's theme folder
// Used for generating public icon URLs
const repo = "https://cdn.jsdelivr.net/gh/ferdium/ferdium-themes/themes/";

// Helper: Compress src folder into dest file
const compress = (src, dest) =>
  new Promise((resolve, reject) => {
    targz.compress(
      {
        src,
        dest,
        tar: {
          // Don't package .DS_Store files and .md files
          ignore(name) {
            return path.basename(name) === ".DS_Store" || name.endsWith(".md");
          },
        },
      },
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(dest);
        }
      }
    );
  });

// Let us work in an async environment
(async () => {
  // Create paths to important files
  const repoRoot = path.join(__dirname, "..");
  const themesFolder = path.join(repoRoot, "themes");
  const outputFolder = path.join(repoRoot, "archives");
  const allJson = path.join(repoRoot, "all.json");
  let themeList = [];
  let unsuccessful = 0;

  await fs.ensureDir(outputFolder);
  await fs.emptyDir(outputFolder);
  await fs.remove(allJson);

  const git = await simpleGit(repoRoot);
  const isGitRepo = await git.checkIsRepo();
  if (!isGitRepo) {
    console.debug("NOT A git repo: will bypass dirty state checks");
  }

  const availableThemes = fs
    .readdirSync(themesFolder, { withFileTypes: true })
    .filter((dir) => dir.isDirectory())
    .map((dir) => dir.name);

  for (const theme of availableThemes) {
    const themeSrc = path.join(themesFolder, theme);
    // const mandatoryFiles = ["theme.json", "preview.png", "custom.css"];
    const mandatoryFiles = ["theme.json", "custom.css"];

    // Check that each mandatory file exists
    for (const file of mandatoryFiles) {
      const filePath = path.join(themeSrc, file);
      // eslint-disable-next-line no-await-in-loop
      if (!(await fs.pathExists(filePath))) {
        console.log(
          `⚠️ Couldn't package "${theme}": Folder doesn't contain a "${file}".`
        );
        unsuccessful += 1;
      }
    }
    if (unsuccessful > 0) {
      continue;
    }

    // Check icons sizes
    // const svgIcon = path.join(themeSrc, "icon.svg");
    // const svgSize = sizeOf(svgIcon);
    // const svgHasRightSize = svgSize.width === svgSize.height;
    // if (!svgHasRightSize) {
    //   console.log(
    //     `⚠️ Couldn't package "${theme}": theme SVG icon isn't a square`
    //   );
    //   unsuccessful += 1;
    //   continue;
    // }

    // Read theme.json
    const themeJson = path.join(themeSrc, "theme.json");
    // eslint-disable-next-line no-await-in-loop
    const config = await fs.readJson(themeJson);

    // Make sure it contains all required fields
    if (!config) {
      console.log(
        `⚠️ Couldn't package "${theme}": Could not read or parse "theme.json"`
      );
      unsuccessful += 1;
      continue;
    }
    const configErrors = [];
    if (!config.id) {
      configErrors.push(
        "The theme's theme.json contains no 'id' field. This field should contain a unique ID made of lowercase letters (a-z), numbers (0-9), hyphens (-), periods (.), and underscores (_)"
      );
      // eslint-disable-next-line no-useless-escape
    } else if (!/^[\w.\-]+$/.test(config.id)) {
      configErrors.push(
        "The theme's theme.json defines an invalid theme ID. Please make sure the 'id' field only contains lowercase letters (a-z), numbers (0-9), hyphens (-), periods (.), and underscores (_)"
      );
    }
    if (config.id !== theme) {
      configErrors.push(
        `The theme's id (${config.id}) does not match the folder name (${theme})`
      );
    }
    if (!config.name) {
      configErrors.push(
        "The theme's theme.json contains no 'name' field. This field should contain the name of the service (e.g. 'Google Keep')"
      );
    }
    if (!config.version) {
      configErrors.push(
        "The theme's theme.json contains no 'version' field. This field should contain the a semver-compatible version number for your theme (e.g. '1.0.0')"
      );
    }

    if (!config.preview) {
      if (!(await fs.pathExists(path.join(themeSrc, "preview.png")))) {
        configErrors.push(
          "The theme's theme.json contains no 'preview' field and no 'preview.png' file. This field should contain a URL to a preview image for your theme or you can add a 'preview.png' file to the theme folder and delete this field."
        );
      }
    }
    // if (!config.config || typeof config.config !== "object") {
    //   configErrors.push(
    //     "The theme's theme.json contains no 'config' object. This field should contain a configuration for your service."
    //   );
    // }

    if (semver.valid(config.version) === null) {
      configErrors.push(
        `The theme's theme.json contains an invalid version number: ${config.version}`
      );
    }

    const topLevelKeys = Object.keys(config);
    for (const key of topLevelKeys) {
      if (typeof config[key] === "string") {
        if (config[key] === "") {
          configErrors.push(
            `The theme's theme.json contains empty value for key: ${key}`
          );
        }
      } else if (
        (key === "config" || key === "aliases") &&
        typeof config[key] !== "object"
      ) {
        configErrors.push(
          `The theme's theme.json contains unexpected value for key: ${key}`
        );
      }
    }

    const knownTopLevelKeys = new Set([
      "id",
      "name",
      "description",
      "author",
      "version",
      "preview",
    ]);
    const unrecognizedKeys = topLevelKeys.filter(
      (x) => !knownTopLevelKeys.has(x)
    );
    if (unrecognizedKeys.length > 0) {
      configErrors.push(
        `The theme's theme.json contains the following keys that are not recognized: ${unrecognizedKeys}`
      );
    }
    if (config.config && typeof config.config === "object") {
      const configKeys = Object.keys(config.config);
      const knownConfigKeys = new Set([
        "serviceURL",
        "hasTeamId",
        "urlInputPrefix",
        "urlInputSuffix",
        "hasHostedOption",
        "hasCustomUrl",
        "hasNotificationSound",
        "hasDirectMessages",
        "hasIndirectMessages",
        "allowFavoritesDelineationInUnreadCount",
        "message",
        "disablewebsecurity",
      ]);
      const unrecognizedConfigKeys = configKeys.filter(
        (x) => !knownConfigKeys.has(x)
      );
      if (unrecognizedConfigKeys.length > 0) {
        configErrors.push(
          `The theme's theme.json contains the following keys that are not recognized: ${unrecognizedConfigKeys}`
        );
      }

      // if (config.config.hasCustomUrl !== undefined && config.config.hasHostedOption !== undefined) {
      //   configErrors.push("The theme's theme.json contains both 'hasCustomUrl' and 'hasHostedOption'. Please remove 'hasCustomUrl' since it is overridden by 'hasHostedOption'");
      // }

      for (const key of configKeys) {
        if (
          typeof config.config[key] === "string" &&
          config.config[key] === ""
        ) {
          configErrors.push(
            `The theme's theme.json contains empty value for key: ${key}`
          );
        }
      }
    }

    if (isGitRepo) {
      const relativeRepoSrc = path.relative(repoRoot, themeSrc);

      // Check for changes in theme's directory, and if changes are present, then the changes should contain a version bump
      // eslint-disable-next-line no-await-in-loop
      await git.diffSummary(relativeRepoSrc, (err, result) => {
        if (err) {
          configErrors.push(
            `Got the following error while checking for git changes: ${err}`
          );
        } else if (
          result &&
          (result.changed !== 0 ||
            result.insertions !== 0 ||
            result.deletions !== 0)
        ) {
          const pkgJsonRelative = path.relative(repoRoot, themeJson);
          if (result.files.some(({ file }) => file === pkgJsonRelative)) {
            git.diff(pkgJsonRelative, (_diffErr, diffResult) => {
              if (diffResult && !pkgVersionChangedMatcher.test(diffResult)) {
                configErrors.push(
                  `Found changes in '${relativeRepoSrc}' without the corresponding version bump in '${pkgJsonRelative}' (found other changes though)`
                );
              }
            });
          } else {
            configErrors.push(
              `Found changes in '${relativeRepoSrc}' without the corresponding version bump in '${pkgJsonRelative}'`
            );
          }
        }
      });
    }

    if (configErrors.length > 0) {
      console.log(`⚠️ Couldn't package "${theme}": There were errors in the theme's theme.json:
  ${configErrors.reduce((str, err) => `${str}\n${err}`)}`);
      unsuccessful += 1;
    }

    // if (!fs.existsSync(path.join(themeSrc, "index.js"))) {
    //   console.log(
    //     `⚠️ Couldn't package "${theme}": The theme doesn't contain a "index.js"`
    //   );
    //   unsuccessful += 1;
    // }

    // Package to .tar.gz
    compress(themeSrc, path.join(outputFolder, `${config.id}.tar.gz`));

    // Add theme to all.json
    const packageInfo = {
      id: config.id,
      name: config.name,
      description: config.description,
      author: config.author,
      version: config.version,
      preview: config.preview
        ? config.preview
        : `${repo}${config.id}/preview.png`,
    };
    themeList.push(packageInfo);
  }

  // Sort package list alphabetically
  themeList = themeList.sort((a, b) => {
    const textA = a.id.toLowerCase();
    const textB = b.id.toLowerCase();
    return textA < textB ? -1 : textA > textB ? 1 : 0;
  });
  await fs.writeJson(allJson, themeList, {
    spaces: 2,
    EOL: "\n",
  });

  console.log(
    `✅ Successfully packaged and added ${themeList.length} themes (${unsuccessful} unsuccessful themes)`
  );

  if (unsuccessful > 0) {
    throw new Error(`One or more themes couldn't be packaged.`);
  }
})();
