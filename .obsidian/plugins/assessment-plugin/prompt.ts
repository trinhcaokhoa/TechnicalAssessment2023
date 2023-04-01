import {
  App,
  Component,
  Editor,
  FileSystemAdapter,
  FileView,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  Vault,
  FuzzySuggestModal,
  WorkspaceLeaf,
  FileManager,
  Plugin_2,
  Task,
} from "obsidian";
import type { FuzzyMatch } from "obsidian";
import simpleGit, { SimpleGit } from "simple-git";
import { exec } from "child_process";
import { Octokit } from "@octokit/rest";
import fs from "fs";
import { RestEndpointMethods } from "@octokit/plugin-rest-endpoint-methods";
import { QuickAdd, TemplateSuggester } from "obsidian-quickadd";
const path = require("path");
const matter = require('gray-matter');
require('dotenv').config();

export async function promptForProjectInfo(): Promise<{
    name: string;
    repo: string | null;
    wiki: string;
    type: string;
  }> {
    return new Promise((resolve) => {
      const prompt = new Modal(this.app);
      prompt.onClose(() => {
        resolve({ name: "", repo: null, wiki: "", type: "" });
      });
      prompt.titleEl.setText("Create New Project:");
      const nameInput = prompt.contentEl.createEl("input", {
        attr: {
          type: "text",
        },
        cls: "prompt-input",
      }) as HTMLInputElement;
      nameInput.placeholder = "Project Name";
      const repoInput = prompt.contentEl.createEl("input", {
        attr: {
          type: "text",
        },
        cls: "prompt-input",
      }) as HTMLInputElement;
      repoInput.placeholder = "Repository URL (optional)";
      const wikiInput = prompt.contentEl.createEl("input", {
        attr: {
          type: "text",
        },
        cls: "prompt-input",
      }) as HTMLInputElement;
      wikiInput.placeholder = "Wiki URL or path";
      const typeInput = prompt.contentEl.createEl("input", {
        attr: {
          type: "text",
        },
        cls: "prompt-input",
      }) as HTMLInputElement;
      typeInput.placeholder = "Project Type (personal/professional)";

      const submitButton = prompt.contentEl.createEl("button", {
        text: "Create Project",
        cls: "mod-cta",
      });
      submitButton.addEventListener("click", () => {
        resolve({
          name: nameInput.value,
          repo: repoInput.value ? repoInput.value : null,
          wiki: wikiInput.value,
          type: typeInput.value,
        });
        prompt.close();
      });
      nameInput.focus();
      prompt.open();
    });
  }



export async function promptForMilestone(): Promise<{
  title: string;
  description: string;
  dueOn: string;
}> {
  return new Promise((resolve) => {
    const prompt = new Modal(this.app);
    prompt.onClose(() => {
      resolve({ title: "", description: "", dueOn: "" });
    });
    prompt.titleEl.setText("Create New Milestone:");
    const titleInput = prompt.contentEl.createEl("input", {
      attr: {
        type: "text",
      },
      cls: "prompt-input",
    }) as HTMLInputElement;
    titleInput.placeholder = "Title";
    const descriptionInput = prompt.contentEl.createEl("textarea", {
      attr: {
        rows: "5",
        cols: "50",
      },
      cls: "prompt-input",
    }) as HTMLTextAreaElement;
    descriptionInput.placeholder = "Description";
    const dueOnInput = prompt.contentEl.createEl("input", {
      attr: {
        type: "text",
      },
      cls: "prompt-input",
    }) as HTMLInputElement;
    dueOnInput.placeholder = "Due On (YYYY/MM/DD)";

    const submitButton = prompt.contentEl.createEl("button", {
      text: "Create Milestone",
      cls: "mod-cta",
    });
    submitButton.addEventListener("click", () => {
      const dueOnInputValue = dueOnInput.value.trim();
      if (!dueOnInputValue || !/^\d{4}\/\d{2}\/\d{2}$/.test(dueOnInputValue)) {
        new Notice("Invalid due date. Please enter a date in the format YYYY/MM/DD.");
        return;
      }
      const [year, month, day] = dueOnInputValue.split("/");
      const dueOn = new Date(Number(year), Number(month) - 1, Number(day)).toISOString();
      resolve({
        title: titleInput.value.trim(),
        description: descriptionInput.value.trim(),
        dueOn,
      });
      prompt.close();
    });
    titleInput.focus();
    prompt.open();
  });
}
export async function promptForTask(): Promise<{
  title: string;
  description: string;
  milestoneTitle: string;
  assignee: string;
  label: string;
}> {
  return new Promise((resolve) => {
    const prompt = new Modal(this.app);
    prompt.onClose(() => {
      resolve({ title: "", description: "", milestoneTitle: "", assignee: "", label: "" });
    });
    prompt.titleEl.setText("Create New Task:");
    const titleInput = prompt.contentEl.createEl("input", {
      attr: {
        type: "text",
      },
      cls: "prompt-input",
    }) as HTMLInputElement;
    titleInput.placeholder = "Title";
    const descriptionInput = prompt.contentEl.createEl("textarea", {
      attr: {
        rows: "5",
        cols: "50",
      },
      cls: "prompt-input",
    }) as HTMLTextAreaElement;
    descriptionInput.placeholder = "Description";
    const milestoneInput = prompt.contentEl.createEl("input", {
      attr: {
        type: "text",
      },
      cls: "prompt-input",
    }) as HTMLInputElement;
    milestoneInput.placeholder = "Milestone";
    const assigneeInput = prompt.contentEl.createEl("input", {
      attr: {
        type: "text",
      },
      cls: "prompt-input",
    }) as HTMLInputElement;
    assigneeInput.placeholder = "Assignee";
    const labelInput = prompt.contentEl.createEl("input", {
      attr: {
        type: "text",
      },
      cls: "prompt-input",
    }) as HTMLInputElement;
    labelInput.placeholder = "Label";
    const submitButton = prompt.contentEl.createEl("button", {
      text: "Create Task",
      cls: "mod-cta",
    });
    submitButton.addEventListener("click", () => {
      resolve({
        title: titleInput.value,
        description: descriptionInput.value,
        milestoneTitle: milestoneInput.value,
        assignee: assigneeInput.value,
        label: labelInput.value,
      });
      prompt.close();
    });
    titleInput.focus();
    prompt.open();
  });
}




export async function createNewProject(project: Project) {
    const { vault } = this.app;
    const projectFolderPath = `Projects/${project.name}`;

    // Add the following code to retrieve the GitHub repo and wiki names from the URLs
    const githubRepo = project.repo;
    const githubWiki = project.wiki.match(
      /github\.com\/([^\/]+\/[^\/]+)\/wiki\/(.+)/i
    )?.[2];
    await vault.createFolder(projectFolderPath);
    // Clone project repository if specified
    if (project.repo) {
      const git: SimpleGit = simpleGit(vault.adapter.basePath);
      const repoFolderPath = `${vault.adapter.basePath}/${projectFolderPath}`;
      await git.cwd(repoFolderPath);
      console.log(repoFolderPath);
      await git.clone(project.repo, repoFolderPath);
    }

    // Create and save project file with metadata and dashboard template
    const metadataContent = `---\n project: ${project.name}\n repo: ${githubRepo}\n wiki: ${githubWiki}\n tags: [project,${project.name}] \n type: ${project.projectType} \n---`;
    const metadataFilePath = `${projectFolderPath}/${
      project.name + "DashBoard"
    }.md`;
    await vault.create(metadataFilePath, metadataContent);

    // Create tasks and wiki directories
    await vault.createFolder(`${projectFolderPath}/tasks`);
    await vault.createFolder(`${projectFolderPath}/wiki`);

    const newProject: Project = {
      name: project.name,
      repo: project.repo,
      wiki: project.wiki,
      projectBoard: project.projectBoard,
      projectType: project.projectType,
    };
    return newProject;
  }



