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
import { promptForMilestone, promptForProjectInfo, promptForTask, createNewProject } from "prompt.ts";
import dotenv from 'dotenv';
dotenv.config();

// interface ProjectManSettings {
// 	ProjectRepos: {},
// }

// const DEFAULT_SETTINGS: ProjectManSettings = {
// 	ProjectRepos: {},
// }

interface Project {
  name: string;
  repo: string;
  wiki: string;
  projectBoard: string | null;
  projectType: "personal" | "professional";
}



export default class ProjectMan extends Plugin {
  projects: Array<Project> = [];
  currentProject: Project | null = null;

  async onload() {
    console.log("Loading Zenith Project Man");
    await this.loadProjects();

    const statusBarItemEl = this.addStatusBarItem();
    statusBarItemEl.setText("Active Project: None");

    // Create a command to add a New Project In Projects Directory
 	this.addCommand({
      id: "create-new-project",
      name: "Create New Project",
      callback: async () => {
        const { name, repo, wiki, type } = await promptForProjectInfo();
        if (!name) return;

        const newProject: Project = await createNewProject({
          name: name,
          repo: repo,
          wiki: wiki,
          projectBoard: null,
          projectType: type,
        });


       // this.projects.push(newProject); // Push new project to the array
        this.currentProject = newProject; // Set new project as current project
        statusBarItemEl.setText(
          `Active Project: ${
            this.currentProject ? this.currentProject.name : "None"
          }`
        );
        new Notice(`Project '${name}' created.`);

        // Update the list of project names for the toggle active project command
        this.projectNames = this.projects.map((project) => project.name);
      },
    });
this.addCommand({
  id: "create-milestone",
  name: "Create Milestone",
  callback: async () => {
    if (!this.currentProject) {
      new Notice("No active project selected.");
      return;
    }
    console.log(this.currentProject);

    const vaultPath = this.app.vault.adapter.basePath;
    const projectFolder = `${vaultPath}/Projects/${this.currentProject.name}`;
    const { title, description, dueOn } = await promptForMilestone();
    console.log(this.currentProject.repo)
    const repoURL = new URL(this.currentProject.repo);
    const repoName = repoURL.pathname.split("/").pop();
    const ownerName = repoURL.pathname.split("/")[1];

    if (!title) {
      return;
    }

    const git = simpleGit(projectFolder);
    await git.cwd(projectFolder);

    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    try {
      const { data: newMilestone } = await octokit.issues.createMilestone({
        owner: ownerName,
        repo: repoName,
        title,
        description,
        due_on: dueOn,
      });
      new Notice(`Milestone '${newMilestone.title}' created.`);
    } catch (err) {
      new Notice(`Error creating milestone: ${err.message}`);
    }
  },
});
this.addCommand({
  id: "push-to-github",
  name: "Push to GitHub",
  callback: async () => {
    if (!this.currentProject) {
      new Notice("No active project selected.");
      return;
    }

    const vaultPath = this.app.vault.adapter.basePath;
    const projectFolder = `${vaultPath}/Projects/${this.currentProject.name}`;
    const git = simpleGit(projectFolder);

    try {
      const status = await git.status();
      if (status.files.length === 0) {
        new Notice("Nothing to commit.");
        return;
      }

      await git.add(".");
      const { stdout: commitOutput } = await git.commit("Update project files");
      const repoURL = new URL(this.currentProject.repo);
      const repoName = repoURL.pathname.split("/").pop();
      const ownerName = repoURL.pathname.split("/")[1];
      await git.push("origin", `HEAD:refs/heads/master`);

      new Notice(`Changes pushed to ${ownerName}/${repoName}`);
    } catch (err) {
      new Notice(`Error pushing changes: ${err.message}`);
    }
  },
});

this.addCommand({
  id: "toggle-active-project",
  name: "Toggle Active Project",
  callback: async () => {
    const projectsFolderPath = path.join(
      this.app.vault.adapter.basePath,
      "Projects"
    );
    const projectFolderNames = await fs.promises
      .readdir(projectsFolderPath, {
        withFileTypes: true,
      })
      .then((dirents) => {
        return dirents
          .filter((dirent) => dirent.isDirectory())
          .map((dirent) => dirent.name);
      })
      .catch((error) => {
        console.error(error);
        new Notice("Failed to read project folders.");
        return [];
      });

    if (!projectFolderNames || projectFolderNames.length === 0) {
      new Notice("No projects available.");
      return;
    }

    const chosenProjectName = await GenericSuggester.Suggest(
      this.app,
      projectFolderNames,
      projectFolderNames
    );

    const dashboardFilePath = path.join(
      projectsFolderPath,
      chosenProjectName,
      `${chosenProjectName}DashBoard.md`
    );

    try {
      const dashboardFileContent = await fs.promises.readFile(
        dashboardFilePath,
        "utf-8"
      );

      const metadata = matter(dashboardFileContent).data;
      if (!metadata.project) {
        throw new Error("Invalid dashboard file format");
      }

      this.currentProject = {
        name: metadata.project,
        repo: metadata.repo || "",
        wiki: metadata.wiki || "",
        projectBoard: metadata.projectBoard || "",
        projectType: metadata.type || "",
        path: path.join(projectsFolderPath, chosenProjectName),
      };

      statusBarItemEl.setText(`Active Project: ${this.currentProject.name}`);
      console.log(this.currentProject);
    } catch (error) {
      console.error(error);
      new Notice(`Failed to load project data for '${chosenProjectName}'`);
    }
  },
});

this.addCommand({
  id: "create-task",
  name: "Create Task",
  callback: async () => {
    if (!this.currentProject) {
      new Notice("No active project selected.");
      return;
    }

    const { title, description, milestoneTitle, assignee, labels } = await promptForTask();

    if (!title) {
      return;
    }

    const vaultPath = this.app.vault.adapter.basePath;
    const projectFolder = `${vaultPath}/Projects/${this.currentProject.name}`;
    const git = simpleGit(projectFolder);
    await git.cwd(projectFolder);

    const repoURL = new URL(this.currentProject.repo);
    const repoName = repoURL.pathname.split("/").pop();
    const ownerName = repoURL.pathname.split("/")[1];

    try {
      // Get a list of milestones for the repository
      const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
      const { data: milestones } = await octokit.issues.listMilestones({
        owner: ownerName,
        repo: repoName,
        state: "open",
      });

      // Find the milestone with the specified name
      const milestone = milestones.find(m => m.title === milestoneTitle);

      if (!milestone) {
        new Notice(`Milestone '${milestoneTitle}' not found.`);
        return;
      }

      // Create the issue with the specified title, description, and milestone
		const { data: newIssue } = await octokit.issues.create({
		  owner: ownerName,
		  repo: repoName,
		  title,
		  body: description,
		  milestone: milestone.number,
		  assignee,
		  labels,
		});
      new Notice(`Task '${newIssue.title}' created.`);
    } catch (err) {
      new Notice(`Error creating task: ${err.message}`);
    }
  },
});

    // This adds an editor command that can perform some operation on the current editor instance
    this.addCommand({
      id: "clone-project-wiki",
      name: "Clone Project Wiki",
      editorCallback: (editor: Editor, view: MarkdownView) => {
        let frontMatter = getObsidianFrontmatter(view.data);
        console.log(frontMatter);

        let adapter = app.vault.adapter;

        if (adapter instanceof FileSystemAdapter) {
          let basePath = adapter.getBasePath();
          let git = simpleGit(`${basePath}/${view.file.parent.path}`);

          if (this.currentProject) {
            git = simpleGit(
              `${basePath}/7_Projects/${this.currentProject.name}`
            );
            git
              .clone(`https://${this.currentProject.wiki}`, "wiki")
              .then((res) => {
                console.log(res);
                console.log("Successfully cloned.");

                console.log(this.projects);

                this.saveProjects();
              })
              .catch((err) => {
                console.log(err);
              });

            return;
          }

          if (!frontMatter) {
            if (this.projects.length == 0) {
              this.loadProjects();
            }
            GenericSuggester.Suggest(
              this.app,
              this.projects.map((p, i, a) => p.name),
              this.projects.map((p, i, a) => p.name)
            ).then((res) => {
              adapter
                .read(`${basePath}/7_Projects/${res}/ProjectDashboard`)
                .then((data) => {
                  frontMatter = getObsidianFrontmatter(data);
                });

              git = simpleGit(`${basePath}/7_Projects/${res}`);
            });
          }

          if (frontMatter) {
            let cwd = process.cwd();
            let clonePath = `wiki`;
            git
              .clone(`https://${frontMatter.wiki}`, clonePath)
              .then((res) => {
                console.log(res);
                console.log("Successfully cloned.");
                if (frontMatter) {
                  this.projects.push({
                    name: frontMatter.project,
                    repo: null,
                    wiki: frontMatter.wiki,
                    projectBoard: null,
                  });
                  console.log(this.projects);
                }
                this.saveProjects();
              })
              .catch((err) => {
                console.log(err);
              })
              .finally(() => {
                process.chdir(cwd);
              });
          }
        }
      },
    });

    this.addCommand({
      id: "commit-project-wiki",
      name: "Commit Project Wiki",
      editorCallback: (editor: Editor, view: MarkdownView) => {
        let adapter = app.vault.adapter;

        if (adapter instanceof FileSystemAdapter) {
          let basePath = adapter.getBasePath();

          if (this.currentProject) {
            let git = simpleGit(`${basePath}/${view.file.parent.path}/wiki`);

            git.add(".").then((addRes) => {
              console.log(`Added: ${addRes}`);
              git.commit("Wiki Update (Obsidian)", ".").then((res) => {
                console.log("Commit successful. " + res);
                git.push();
              });
            });
            return;
          }

          try {
            let git = simpleGit(`${basePath}/${view.file.parent.path}/wiki`);
            gitAddCommit(git, "Wiki Update (Obsidian)");
          } catch {
            if (this.projects.length == 0) {
              this.loadProjects();
            }
            GenericSuggester.Suggest(
              this.app,
              this.projects.map((p, i, a) => p.name),
              this.projects.map((p, i, a) => p.name)
            ).then((res) => {
              let git = simpleGit(`${basePath}/7_Projects/${res}/wiki`);
              gitAddCommit(git, "Wiki Update (Obsidian)");
            });
          }
        }
      },
    });

    this.addCommand({
      id: "add-issue",
      name: "Add issue",
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        let frontMatter = getObsidianFrontmatter(view.data);

        let project = frontMatter
          ? this.projects.filter((v, i, a) => {
              console.log(`Front matter ${JSON.stringify(frontMatter)}`);
              return frontMatter && v.name === frontMatter.project;
            })[0]
          : null;

        console.log(`Project: ${JSON.stringify(project)}`);

        if (!project) {
          await GenericSuggester.Suggest(
            this.app,
            this.projects.map((p, i, a) => p.name),
            this.projects.map((p, i, a) => p.name)
          ).then((res) => {
            project = this.projects.filter((v, i, a) => {
              console.log(`Project: ${res}`);
              return res && v.name === res;
            })[0];
          });
        }

        if (project) {
          const ghArgs = {
            repo: project.repo,
            // board: project.projectBoard,
            assignees: await this.app.plugins.plugins.quickadd?.api.inputPrompt(
              "Assignees",
              "Enter Assignees (Comma-Separated)"
            ),
            title: await this.app.plugins.plugins.quickadd?.api.inputPrompt(
              "Title",
              "Title of issue"
            ),
            // body: (await this.app.plugins.plugins.quickadd?.api.wideInputPrompt("Body", "Body (Markdown)")),
            // reviewers: (await this.app.plugins.plugins.quickadd?.api.inputPrompt("Reviewers", "Enter reviewer (Comma-Separated)")),
            // milestone: (await this.app.plugins.plugins.quickadd?.api.inputPrompt("Milestone", "Related Milestone")),
            // priority: (await this.app.plugins.plugins.quickadd?.api.suggester(["Priority: 1", "2", "3", "4", "5"], ["1", "2", "3", "4", "5"])),
            // status: (await this.app.plugins.plugins.quickadd?.api.suggester(["Todo", "InProgress", "Done", "Merged", "Archived"], ["Todo", "InProgress", "Done", "Merged", "Archived"])),
            tags: await this.app.plugins.plugins.quickadd?.api.inputPrompt(
              "Tags",
              "Enter Labels (Comma-Separated)"
            ),
          };

          console.log(`Args: ${JSON.stringify(ghArgs)}`);
          // TODO: Try add github project with number
          const command = `gh issue create --repo ${ghArgs.repo} -a \"${ghArgs.assignees}\" --title \"${ghArgs.title}\" --body \"created\"`;

          let result = exec(command, (err, stdout, stderr) => {
            console.log(`OUT > ${stdout}`);
            console.log(`ERR > ${stderr}`);

            if (stdout && !err) {
              this.app.plugins.plugins.quickadd?.api
                .executeChoice("Create Issue Note", {
                  project: project ? project.name : "",
                  assignees: ghArgs.assignees,
                  title: ghArgs.title,
                  tags: ghArgs.tags,
                  issueURL: stdout.split("://")[1],
                })
                .then(async () => {
                  this.app.plugins.plugins.quickadd?.api.executeChoice(
                    "Capture Issue"
                  );
                });
            }
          });
        } else {
          this.saveProjects();
          console.log("Couldn't Locate Valid Project.");
        }
      },
    });

    this.addCommand({
      id: "update-issue",
      name: "Update issue",
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        let frontMatter = getObsidianFrontmatter(view.data);

        let project = frontMatter
          ? this.projects.filter((v, i, a) => {
              console.log(`Front matter ${JSON.stringify(frontMatter)}`);
              return frontMatter && v.name === frontMatter.project;
            })[0]
          : null;

        console.log(`Project: ${JSON.stringify(project)}`);

        if (!project) {
          await GenericSuggester.Suggest(
            this.app,
            this.projects.map((p, i, a) => p.name),
            this.projects.map((p, i, a) => p.name)
          ).then((res) => {
            project = this.projects.filter((v, i, a) => {
              console.log(`Project: ${res}`);
              return res && v.name === res;
            })[0];
          });
        }

        if (project) {
          let adapter = app.vault.adapter;

          if (adapter instanceof FileSystemAdapter) {
            const ghArgs = {
              repo: project.repo,
              body: `${adapter.getBasePath()}/${view.file.path}`,
              url: frontMatter ? frontMatter.issueURL : "",
            };

            console.log(`Args: ${JSON.stringify(ghArgs)}`);
            // TODO: Try add github project with number
            const command = `gh issue edit \"https://${ghArgs.url}\" --repo ${ghArgs.repo} --body-file \"${ghArgs.body}\"`;

            let result = exec(command, (err, stdout, stderr) => {
              console.log(`OUT > ${stdout}`);
              console.log(`ERR > ${stderr}`);

              if (stdout && !err) {
                console.log(`Updated Issue: ${stdout}`);
              }
            });
          }
        } else {
          this.saveProjects();
          console.log("Couldn't Locate Valid Project.");
        }
      },
    });

    this.addCommand({
      id: "commit-all-wikis",
      name: "Commit All Wikis",
      editorCallback: (editor: Editor, view: MarkdownView) => {
        let adapter = app.vault.adapter;

        if (adapter instanceof FileSystemAdapter) {
          let basePath = adapter.getBasePath();
          this.projects.forEach((v) => {
            let git;
            try {
              git = simpleGit(`${basePath}/7_Projects/${v}/wiki`);
            } catch {
              git = simpleGit(`${basePath}/${view.file.parent.path}/wiki`);
            }

            gitAddCommit(git, "Wiki Update (Obsidian)");
          });
        }
      },
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new ZPMSettingTab(this.app, this));

    this.registerInterval(
      window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
    );
  }

  onunload() {
    console.log(`Saving Projects: ${JSON.stringify(this.projects)}`);
    this.saveProjects();
  }

  async loadProjects() {
    this.projects = Object.assign({}, { projects: [] }, await this.loadData())[
      "projects"
    ];
  }

  async saveProjects() {
    await this.saveData({
      projects: this.projects,
    });
  }
}

async function gitAddCommit(git: SimpleGit, message: string) {
  if (git) {
    git.add(".", (addRes) => {
      console.log(`Added: ${addRes}`);
      git.commit(message, ".").then((res) => {
        console.log("Commit successful.");
        git.push();
      });
    });
  }
}

async function captureTask(
  app: App,
  taskName: string,
  scheduled?: string,
  due?: string,
  isReview?: boolean
) {
  const quickadd = app.plugins.plugins.quickadd?.api;

  taskName = isReview ? `REVIEW: ${taskName}` : taskName;

  quickadd?.executeChoice("Capture Task", {
    taskName: taskName,
    scheduled: scheduled ? scheduled : "",
    due: due ? due : "",
  });
}

function getObsidianFrontmatter(
  doc: string
): Record<string, string> | undefined {
  const frontMatterRegex = /^---\n([\s\S]*?)\n---$/m;
  const match = frontMatterRegex.exec(doc);
  if (!match) {
    return undefined;
  }

  const frontMatter = match[1];
  const lines = frontMatter.split("\n");
  const frontMatterObject: Record<string, string> = {};
  for (const line of lines) {
    const [key, value] = line.split(":").map((part) => part.trim());
    frontMatterObject[key] = value;
  }

  return frontMatterObject;
}

class ZPMSettingTab extends PluginSettingTab {
  plugin: ProjectMan;

  constructor(app: App, plugin: ProjectMan) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Project Manager" });

    this.plugin.projects.forEach((p) => {
      new Setting(containerEl)
        .setName("Name")
        .setDesc(p.name)
        .addText((text) =>
          text.setPlaceholder("Project Name").setValue(p.name).setDisabled(true)
        )
        .addText((text) =>
          text.setPlaceholder("Project Wiki").setValue(p.wiki).setDisabled(true)
        )
        .addText((text) =>
          text
            .setPlaceholder("Project Repo")
            .setValue(p.repo ? p.repo : "")
            .onChange(async (value) => {
              console.log("repo: " + value);
              p.repo = value;
              await this.plugin.saveProjects();
            })
        )
        .addText((text) =>
          text
            .setPlaceholder("Project Board")
            .setValue(p.projectBoard ? p.projectBoard : "")
            .onChange(async (value) => {
              console.log("board: " + value);
              p.projectBoard = value;
              await this.plugin.saveProjects();
            })
        );
    });
  }
}

// Credit: https://github.com/chhoumann/quickadd/blob/master/src/gui/GenericSuggester/genericSuggester.ts
class GenericSuggester extends FuzzySuggestModal<string> {
  private resolvePromise: (value: string) => void;
  private rejectPromise: (reason?: any) => void;
  public promise: Promise<string>;
  private resolved: boolean;

  public static Suggest(app: App, displayItems: string[], items: string[]) {
    const newSuggester = new GenericSuggester(app, displayItems, items);
    return newSuggester.promise;
  }

  public constructor(
    app: App,
    private displayItems: string[],
    private items: string[]
  ) {
    super(app);

    this.promise = new Promise<string>((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
    });

    this.open();
  }

  getItemText(item: string): string {
    return this.displayItems[this.items.indexOf(item)];
  }

  getItems(): string[] {
    return this.items;
  }

  selectSuggestion(value: FuzzyMatch<string>, evt: MouseEvent | KeyboardEvent) {
    this.resolved = true;
    super.selectSuggestion(value, evt);
  }

  onChooseItem(item: string, evt: MouseEvent | KeyboardEvent): void {
    this.resolved = true;
    this.resolvePromise(item);
  }

  onClose() {
    super.onClose();

    if (!this.resolved) this.rejectPromise("no input given.");
  }
}
