const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { EOL } = require("os");

// This is the path where the new library will be created
const libraryPath = path.join(__dirname, ".obsidian", "plugins", "assessment-plugin");

// This is the path to the template directory
const templatePath = path.join(__dirname, "template");

// Copy the template directory to the new library path
try {
  execSync(`xcopy /E /I /Y "${templatePath}" "${libraryPath}"`);
  console.log("Template copied successfully!");
} catch (error) {
  console.error("Error copying template:", error);
  return;
}

// Load the package.json file from the new library
const packageJsonPath = path.join(libraryPath, "package.json");
let packageJson;
try {
  packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
} catch (error) {
  console.warn(`Warning: package.json file not found at ${packageJsonPath}, creating new one...`);
  packageJson = {
    name: "my-library",
    version: "1.0.0",
    main: "main.js",
    author: "Your Name",
    description: "A brief description of your library",
    repository: {
      type: "git"
    },
    dependencies: {},
  };
}






// Build the library
try {
  execSync('npm run build', { cwd: libraryPath, stdio: "inherit" });
  console.log("Library built successfully!");
} catch (error) {
  console.error("Error building library:", error);
  return;
}
