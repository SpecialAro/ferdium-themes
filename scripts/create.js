/* eslint-disable no-console */

/**
 * Create a new theme for your service
 */
const fs = require("fs-extra");
const path = require("path");
const child_process = require('child_process');

if (process.argv.length < 3) {
  console.log(`Usage: pnpm create <Theme name> [Folder name]
For example:
pnpm create WhatsApp
pnpm create "Google Hangouts"
You can set "Folder name" to "FerdiumDev" to use Ferdium's development instance instead:

pnpm create WhatsApp FerdiumDev
`);
  throw new Error("Please provide the correct number of args!");
}

const themeName = process.argv[2];
const theme = themeName.toLowerCase().replaceAll(/\s/g, "-");
const folderName = process.argv[3] || "Ferdium";
const filesThatNeedTextReplace = ["theme.json"];

const toPascalCase = (str) => {
  const words = str
    .replaceAll(/[^a-z]/g, "")
    .split(/\W/)
    .map((word) => {
      if (word.length === 0) {
        return word;
      }
      // Capitalize the first letter, lowercase the rest
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
  return words.join("");
};
const pascalCasedName = toPascalCase(theme); // PascalCased theme ID only containing a-z, for usage as the JavaScript class name

function dirOpen(dirPath) {
  let command = "";
  switch (process.platform) {
    case "darwin":
      command = "open";
      break;
    case "win32":
      command = "explorer";
      break;
    default:
      command = "xdg-open";
      break;
  }
  // console.log('child_process.execSync', `${command} "${dirPath}"`);
  child_process.exec(`${command} "${dirPath}"`);
  
}

(async () => {
  // Folder paths
  const userData =
    process.env.APPDATA ||
    (process.platform === "darwin"
      ? `${process.env.HOME}/Library/Application Support`
      : `${process.env.HOME}/.config`);
  const themesFolder = path.join(userData, folderName, "config", "themes");
  const devThemeFolder = path.join(themesFolder, "dev");
  const newThemeFolder = path.join(devThemeFolder, theme);
  const sampleTheme = path.join(__dirname, "sample_theme");

  // Make sure dev theme folder exists
  if (!fs.existsSync(themesFolder)) {
    console.log(
      `Couldn't find your theme folder (${themesFolder}). Is Ferdium installed?`
    );
    return;
  }
  fs.ensureDirSync(devThemeFolder);

  if (fs.existsSync(newThemeFolder)) {
    console.log("⚠️ Theme already exists");
    return;
  }

  console.log("[Info] Passed pre-checks");

  // Copy sample theme to theme folder
  fs.copySync(sampleTheme, newThemeFolder);
  console.log("[Info] Copied theme");

  // Replace placeholders with the theme-specific values
  for (const file of filesThatNeedTextReplace) {
    const filePath = path.join(newThemeFolder, file);
    let contents = fs.readFileSync(filePath, "utf8");
    contents = contents.replaceAll("THEME", theme);
    contents = contents.replaceAll("SNAME", themeName);
    contents = contents.replaceAll("SPASCAL", pascalCasedName);
    fs.writeFileSync(filePath, contents);
  }
  console.log("[Info] Prepared new theme");

  dirOpen(newThemeFolder);
  console.log(`✅ Successfully created your theme.

What's next?
- Make sure you open the Themes Marketplace again in Ferdium in order for the theme to show up
- Customise "theme.json", "custom.css" and "preview.png" (see https://github.com/ferdium/ferdium-themes/blob/main/docs/integration.md#theme-structure)
- Publish your theme (see https://github.com/ferdium/ferdium-themes/blob/main/docs/integration.md#publishing)`);
})();
