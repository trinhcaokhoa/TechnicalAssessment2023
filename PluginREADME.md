# ProjectMan Plugin Documentation

## Overview

The ProjectMan plugin is designed to help users manage projects within their Obsidian vaults by providing a variety of useful commands to streamline project management tasks. This plugin uses the Obsidian API, as well as other external APIs such as GitHub and Dotenv.

## Installation

To run the ProjectMan plugin locally in Obsidian, follow these steps:

1. Clone the ProjectMan repository to your local machine.
2. Open the Obsidian app.
3. Click on the Settings icon in the bottom left corner.
4. Click on the Plugins tab in the left sidebar.
5. Click on the "Open folder" button next to the "Community plugins" section at the bottom of the page.
6. Move the cloned ProjectMan repository into the "community-plugins" folder.
7. In the Obsidian app, click on the Community plugins button in the left sidebar.
8. Enable the ProjectMan plugin.
9. Once enabled, the plugin will appear in the Installed plugins section of the Community plugins settings.

## Create environment variable
1. Open a text editor such as Notepad, Sublime Text, or Visual Studio Code.
2. Create a new file and save it as .env in the root directory of your ProjectMan plugin.
3. In the .env file, add the following line: GITHUB_TOKEN=your_token_here
4. Replace your_token_here with your GitHub personal access token.
5. Save the .env file.

## Usage

The ProjectMan plugin offers several useful commands for managing projects within your Obsidian vault. Below is a list of available commands and their functionality.

### Create New Project command

This command allows you to create a new project within your Obsidian vault. When you run this command, you will be prompted to enter information about the project, such as its name, repository URL, wiki URL, and project type. Once you have provided this information, the plugin will create a new directory for the project and add it to the list of available projects. The new project will also be set as the current project.

### Create Milestone command

This command allows you to create a new milestone in the GitHub repository associated with the current project. When you run this command, you will be prompted to enter information about the milestone, such as its title, description, and due date. The plugin will then create the milestone in the GitHub repository.

### Push to GitHub command

This command allows you to push changes made to the files within the current project to the associated GitHub repository. When you run this command, the plugin will check if there are any changes to commit. If there are changes to commit, the plugin will push them to the GitHub repository.

### Toggle Active Project command

This command allows you to switch between different projects within your Obsidian vault. When you run this command, you will be presented with a list of available projects. Selecting a project from the list will set it as the current project.

## Dependencies

The ProjectMan plugin relies on the following external dependencies:

- Obsidian API
- SimpleGit
- Child Process
- Octokit
- FileSystem
- RestEndpointMethods
- QuickAdd
- Dotenv
