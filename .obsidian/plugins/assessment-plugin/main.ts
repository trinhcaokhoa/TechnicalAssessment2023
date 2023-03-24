import { App, Component, Editor, FileSystemAdapter, FileView, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, Vault, FuzzySuggestModal, WorkspaceLeaf, FileManager, Plugin_2,} from 'obsidian';
import type { FuzzyMatch } from "obsidian";
import simpleGit, { SimpleGit } from 'simple-git';
import { exec } from 'child_process';

// interface ProjectManSettings {
// 	ProjectRepos: {},
// }

// const DEFAULT_SETTINGS: ProjectManSettings = {
// 	ProjectRepos: {},
// }

interface Project {
  projectName: string,
  projectRepo: string,
  projectWiki: string,
  projectBoard: string | null
  projectType: 'personal' | 'professional',
}


export default class ProjectMan extends Plugin {
	projects: Array<Project> = [];
	currentProject: Project | null = null;

// Show a modal dialog box prompting the user to enter a project name, wiki,
	async promptForProjectInfo(): Promise<{ name: string, repo: string | null, wiki: string, type: string }> {
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
				cls: "mod-cta"
			});
			submitButton.addEventListener("click", () => {
				resolve({
					name: nameInput.value,
					repo: repoInput.value ? repoInput.value : null,
					wiki: wikiInput.value,
					type: typeInput.value
				});
				prompt.close();
			});
			nameInput.focus();
			prompt.open();
		});
	}

		async createNewProject(project: Project) {
			const { vault } = this.app;
			const projectFolderPath = `Projects/${project.projectName}`;

		  // Add the following code to retrieve the GitHub repo and wiki names from the URLs
			const githubRepo = project.projectRepo;
		 	const githubWiki = project.projectWiki.match(/github\.com\/([^\/]+\/[^\/]+)\/wiki\/(.+)/i)?.[2];
			await vault.createFolder(projectFolderPath);
			// Clone project repository if specified
		  	if (project.projectRepo) {
				const git: SimpleGit = simpleGit(vault.adapter.basePath);
				const repoFolderPath = `${vault.adapter.basePath}/${projectFolderPath}`;
				await git.cwd(repoFolderPath);
				console.log(repoFolderPath)
				await git.clone(project.projectRepo, repoFolderPath);
		  	}

		  // Create and save project file with metadata and dashboard template
			const metadataContent = `---\n project: ${project.projectName}\n repo: ${githubRepo}\n wiki: ${githubWiki}\n tags: [project,${project.projectName}] \n type: ${project.projectType} \n---`;
			const metadataFilePath = `${projectFolderPath}/${project.projectName + 'DashBoard'}.md`;
			await vault.create(metadataFilePath, metadataContent);

			// Create tasks and wiki directories
			await vault.createFolder(`${projectFolderPath}/tasks`);
			await vault.createFolder(`${projectFolderPath}/wiki`);

		  // Set currentProject to newly created project
			this.currentProject = project;
		}
		async onload() {
			console.log("Loading Zenith Project Man");
			await this.loadProjects();

			const statusBarItemEl = this.addStatusBarItem();
			statusBarItemEl.setText('Active Project: None');

// Create a command to add a New Project In Projects Directory
		this.addCommand({
			id: 'create-new-project',
			name: 'Create New Project',
			callback: async () => {
				const { name, repo, wiki, type } = await this.promptForProjectInfo();
				if (!name) return;

				await this.createNewProject({ projectName: name, projectRepo: repo, projectWiki: wiki, projectBoard: null, projectType: type });

				new Notice(`Project '${name}' created.`);
			}
		});

		this.addCommand({
			id: 'push-changes',
			name: 'Push Changes to GitHub',
			callback: async () => {
				const git: SimpleGit = simpleGit(vault.adapter.basePath);
				const commitMessage = await this.app.vault.adapter.promisifyPrompt('Enter commit message:');
				await git.add('.');
				await git.commit(commitMessage);
				await git.push();
				new Notice('Changes pushed to remote repository.');
		  	}
		});

		this.addCommand({
		  id: 'toggle-active-project',
		  name: 'Toggle Active Project',
		  callback: async () => {
			if (this.currentProject) {
			  this.currentProject = null;
			  statusBarItemEl.setText('Active Project: None');
			} else {
			  const projectNames = this.projects.map((p) => p.name);
			  const chosenProjectName = await GenericSuggester.Suggest(this.app, projectNames, projectNames);
			  this.currentProject = this.projects.find((p) => p.name === chosenProjectName);
			  statusBarItemEl.setText(`Active Project: ${this.currentProject ? this.currentProject.name : 'None'}`);
			}
		  },
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'clone-project-wiki',
			name: 'Clone Project Wiki',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				let frontMatter = getObsidianFrontmatter(view.data);
				console.log(frontMatter);

				let adapter = app.vault.adapter;

				if (adapter instanceof FileSystemAdapter) {
					let basePath = adapter.getBasePath();
					let git = simpleGit(`${basePath}/${view.file.parent.path}`);

					if (this.currentProject) {
						git = simpleGit(`${basePath}/7_Projects/${this.currentProject.name}`);
						git.clone(`https://${this.currentProject.wiki}`, 'wiki').then(res => {
							console.log(res)
							console.log("Successfully cloned.");

							console.log(this.projects)

							this.saveProjects();
						}).catch(err => {
							console.log(err);
						})

						return
					}

					if(!frontMatter) {
						if (this.projects.length == 0) {
							this.loadProjects()
						}
						GenericSuggester.Suggest(this.app, this.projects.map((p, i, a) => p.name), this.projects.map((p, i, a) => p.name)).then(res => {
							adapter.read(`${basePath}/7_Projects/${res}/ProjectDashboard`).then(data => {
								frontMatter = getObsidianFrontmatter(data)
							});

							git = simpleGit(`${basePath}/7_Projects/${res}`);
						});


					}

					if (frontMatter) {
						let cwd = process.cwd()
						let clonePath = `wiki`
						git.clone(`https://${frontMatter.wiki}`, clonePath).then(res => {
							console.log(res)
							console.log("Successfully cloned.");
							if (frontMatter){
								this.projects.push({name: frontMatter.project, repo: null, wiki: frontMatter.wiki, projectBoard: null});
								console.log(this.projects)
							}
							this.saveProjects();
						}).catch(err => {
							console.log(err);
						}).finally(() => {
							process.chdir(cwd)
						});
					}
				}


			}
		});

		this.addCommand({
			id: 'commit-project-wiki',
			name: 'Commit Project Wiki',
			editorCallback: (editor: Editor, view: MarkdownView) => {

				let adapter = app.vault.adapter;

				if (adapter instanceof FileSystemAdapter) {
					let basePath = adapter.getBasePath();

					if (this.currentProject) {
						let git = simpleGit(`${basePath}/${view.file.parent.path}/wiki`);

						git.add(".").then(addRes => {
							console.log(`Added: ${addRes}`);
							git.commit("Wiki Update (Obsidian)", ".").then(res => {
								console.log("Commit successful. " + res);
								git.push();
							})
						})
						return
					}

					try {
						let git = simpleGit(`${basePath}/${view.file.parent.path}/wiki`);
						gitAddCommit(git, "Wiki Update (Obsidian)");
					} catch {
						if (this.projects.length == 0) {
							this.loadProjects()
						}
						GenericSuggester.Suggest(this.app, this.projects.map((p, i, a) => p.name), this.projects.map((p, i, a) => p.name)).then(res => {
							let git = simpleGit(`${basePath}/7_Projects/${res}/wiki`);
							gitAddCommit(git, "Wiki Update (Obsidian)");
						});

					}

				}
			}
		});

		this.addCommand({
			id: 'add-issue',
			name: 'Add issue',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				let frontMatter = getObsidianFrontmatter(view.data);

				let project = frontMatter ? this.projects.filter((v, i, a) => {
					console.log(`Front matter ${JSON.stringify(frontMatter)}`);
					return frontMatter && v.name === frontMatter.project
				})[0] : null

				console.log(`Project: ${JSON.stringify(project)}`)

				if (!project) {
					await GenericSuggester.Suggest(this.app, this.projects.map((p, i, a) => p.name), this.projects.map((p, i, a) => p.name)).then(res => {
						project = this.projects.filter((v, i, a) => {
							console.log(`Project: ${res}`)
							return res && v.name === res
						})[0]
					});
				}

				if (project) {

					const ghArgs = {
						repo: project.repo,
						// board: project.projectBoard,
						assignees: (await this.app.plugins.plugins.quickadd?.api.inputPrompt("Assignees", "Enter Assignees (Comma-Separated)")),
						title: (await this.app.plugins.plugins.quickadd?.api.inputPrompt("Title", "Title of issue")),
						// body: (await this.app.plugins.plugins.quickadd?.api.wideInputPrompt("Body", "Body (Markdown)")),
						// reviewers: (await this.app.plugins.plugins.quickadd?.api.inputPrompt("Reviewers", "Enter reviewer (Comma-Separated)")),
						// milestone: (await this.app.plugins.plugins.quickadd?.api.inputPrompt("Milestone", "Related Milestone")),
						// priority: (await this.app.plugins.plugins.quickadd?.api.suggester(["Priority: 1", "2", "3", "4", "5"], ["1", "2", "3", "4", "5"])),
						// status: (await this.app.plugins.plugins.quickadd?.api.suggester(["Todo", "InProgress", "Done", "Merged", "Archived"], ["Todo", "InProgress", "Done", "Merged", "Archived"])),
						tags: (await this.app.plugins.plugins.quickadd?.api.inputPrompt("Tags", "Enter Labels (Comma-Separated)")),
					}

					console.log(`Args: ${JSON.stringify(ghArgs)}`);
					// TODO: Try add github project with number
					const command = `gh issue create --repo ${ghArgs.repo} -a \"${ghArgs.assignees}\" --title \"${ghArgs.title}\" --body \"created\"`

					let result = exec(command, (err, stdout, stderr) => {
						console.log(`OUT > ${stdout}`);
						console.log(`ERR > ${stderr}`);

						if (stdout && !err){
							this.app.plugins.plugins.quickadd?.api.executeChoice("Create Issue Note", {
								project: project ? project.name : "",
								assignees: ghArgs.assignees,
								title: ghArgs.title,
								tags: ghArgs.tags,
								issueURL: stdout.split("://")[1]
							}).then(async ()=> {
								this.app.plugins.plugins.quickadd?.api.executeChoice("Capture Issue");
							})
						}

					})

				} else {
					this.saveProjects();
					console.log("Couldn't Locate Valid Project.")
				}

			}
		});

		this.addCommand({
			id: 'update-issue',
			name: 'Update issue',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				let frontMatter = getObsidianFrontmatter(view.data);

				let project = frontMatter ? this.projects.filter((v, i, a) => {
					console.log(`Front matter ${JSON.stringify(frontMatter)}`);
					return frontMatter && v.name === frontMatter.project
				})[0] : null

				console.log(`Project: ${JSON.stringify(project)}`)

				if (!project) {
					await GenericSuggester.Suggest(this.app, this.projects.map((p, i, a) => p.name), this.projects.map((p, i, a) => p.name)).then(res => {
						project = this.projects.filter((v, i, a) => {
							console.log(`Project: ${res}`)
							return res && v.name === res
						})[0]
					});
				}

				if (project) {
					let adapter = app.vault.adapter;

					if (adapter instanceof FileSystemAdapter) {
						const ghArgs = {
							repo: project.repo,
							body: `${adapter.getBasePath()}/${view.file.path}`,
							url: frontMatter ? frontMatter.issueURL : ""
						}

						console.log(`Args: ${JSON.stringify(ghArgs)}`);
						// TODO: Try add github project with number
						const command = `gh issue edit \"https://${ghArgs.url}\" --repo ${ghArgs.repo} --body-file \"${ghArgs.body}\"`

						let result = exec(command, (err, stdout, stderr) => {
							console.log(`OUT > ${stdout}`);
							console.log(`ERR > ${stderr}`);

							if (stdout && !err){
								console.log(`Updated Issue: ${stdout}`)
							}

						});
					}
				} else {
					this.saveProjects();
					console.log("Couldn't Locate Valid Project.")
				}

			}
		});

		this.addCommand({
			id: 'commit-all-wikis',
			name: 'Commit All Wikis',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				let adapter = app.vault.adapter;

				if (adapter instanceof FileSystemAdapter) {
					let basePath = adapter.getBasePath();
					this.projects.forEach(v => {
						let git;
						try {
							git = simpleGit(`${basePath}/7_Projects/${v}/wiki`);
						} catch {

							git = simpleGit(`${basePath}/${view.file.parent.path}/wiki`);
						}

						gitAddCommit(git, "Wiki Update (Obsidian)");
					});

				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new ZPMSettingTab(this.app, this));

		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
		console.log(`Saving Projects: ${JSON.stringify(this.projects)}`)
		this.saveProjects();
	}

	async loadProjects() {
		this.projects = Object.assign({}, {projects: []}, await this.loadData())['projects'];
	}

	async saveProjects() {
		await this.saveData({
			projects: this.projects
		});
	}
}

async function gitAddCommit(git: SimpleGit, message: string) {
	if (git) {
		git.add(".", addRes => {
			console.log(`Added: ${addRes}`);
			git.commit(message, ".").then(res => {
				console.log("Commit successful.");
				git.push();
			});
		})
	}
}

async function captureTask(app: App, taskName: string, scheduled?: string, due?: string, isReview?: boolean) {
	const quickadd = app.plugins.plugins.quickadd?.api

	taskName = isReview ? `REVIEW: ${taskName}` : taskName

	quickadd?.executeChoice("Capture Task", {
		taskName: taskName,
		scheduled: scheduled ? scheduled : "",
		due: due ? due : ""
	});
}

function getObsidianFrontmatter(doc: string): Record<string, string> | undefined {
	const frontMatterRegex = /^---\n([\s\S]*?)\n---$/m;
	const match = frontMatterRegex.exec(doc);
	if (!match) {
	  return undefined;
	}

	const frontMatter = match[1];
	const lines = frontMatter.split('\n');
	const frontMatterObject: Record<string, string> = {};
	for (const line of lines) {
	  const [key, value] = line.split(':').map(part => part.trim());
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
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Project Manager'});

		this.plugin.projects.forEach(p => {
			new Setting(containerEl)
			.setName('Name')
			.setDesc(p.name)
			.addText(text => text
				.setPlaceholder('Project Name')
				.setValue(p.name)
				.setDisabled(true)
			)
			.addText(text => text
				.setPlaceholder('Project Wiki')
				.setValue(p.wiki)
				.setDisabled(true)
			)
			.addText(text => text
				.setPlaceholder('Project Repo')
				.setValue(p.repo ? p.repo : "")
				.onChange(async (value) => {
					console.log('repo: ' + value);
					p.repo = value;
					await this.plugin.saveProjects();
				})
			)
			.addText(text => text
				.setPlaceholder('Project Board')
				.setValue(p.projectBoard ? p.projectBoard : "")
				.onChange(async (value) => {
					console.log('board: ' + value);
					p.projectBoard = value;
					await this.plugin.saveProjects();
				})
			)
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

	selectSuggestion(
		value: FuzzyMatch<string>,
		evt: MouseEvent | KeyboardEvent
	) {
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
