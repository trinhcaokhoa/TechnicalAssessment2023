const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

// This is the path where the new library will be created
const libraryPath = path.join(__dirname, ".obsidian", "plugins", "assessment-plugin");

// This is the URL of the GitHub repository for the template
const templateRepoUrl = "https://github.com/obsidianmd/obsidian-sample-plugin.git";

// Clone the template repository to the new library path
try {
  execSync(`git clone ${templateRepoUrl} ${libraryPath}`);
  console.log("Template cloned successfully!");
} catch (error) {
  console.error("Error cloning template:", error);
  return;
}

// Remove the existing origin and add a new remote named "task_2"
try {
  execSync(`git remote remove origin`);
  execSync(`git remote add task_2 ${templateRepoUrl}`);
  console.log("Remote updated successfully!");
} catch (error) {
  console.error("Error updating remote:", error);
  return;
}

// Add the remote repository for pushing changes
const remoteRepoUrl = "https://github.com/trinhcaokhoa/TechnicalAssessment2023.git";
try {
  execSync(`git remote add origin ${remoteRepoUrl}`);
  console.log(`Remote repository ${remoteRepoUrl} added successfully!`);
} catch (error) {
  console.error("Error adding remote repository:", error);
  return;
}

// Load the package.json file from the new library
const packageJsonPath = path.join(libraryPath, "package.json");
let packageJson;
try {
  packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
} catch (error) {
  console.error(`Error loading package.json file from ${libraryPath}:`, error);
  return;
}

// Modify the package.json file as necessary
packageJson.name = "my-library";
packageJson.version = "1.0.0";

// Save the modified package.json file
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log("package.json file updated successfully!");
