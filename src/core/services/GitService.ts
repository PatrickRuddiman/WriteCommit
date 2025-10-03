import simpleGit, { SimpleGit } from 'simple-git';

export class GitService {
  private git: SimpleGit;

  constructor() {
    this.git = simpleGit();
  }

  async isInGitRepositoryAsync(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  async getStagedChangesAsync(verbose: boolean = false): Promise<string> {
    try {
      if (verbose) {
        console.log('Getting staged changes...');
      }

      const diff = await this.git.diff(['--cached']);
      
      if (verbose && diff) {
        console.log(`Found ${diff.split('\n').length} lines of staged changes`);
      }

      return diff;
    } catch (error) {
      throw new Error(`Failed to get staged changes: ${error}`);
    }
  }

  async getStagedChangesWithContextAsync(
    contextLines: number = 3,
    verbose: boolean = false
  ): Promise<string> {
    try {
      if (verbose) {
        console.log(`Getting staged changes with ${contextLines} lines of context...`);
      }

      const diff = await this.git.diff(['--cached', `-U${contextLines}`]);
      
      if (verbose && diff) {
        console.log(`Found ${diff.split('\n').length} lines of staged changes with context`);
      }

      return diff;
    } catch (error) {
      throw new Error(`Failed to get staged changes with context: ${error}`);
    }
  }

  async commitChangesAsync(message: string, verbose: boolean = false): Promise<void> {
    try {
      if (verbose) {
        console.log('Committing changes...');
      }

      await this.git.commit(message);

      if (verbose) {
        console.log('Changes committed successfully');
      }

      console.log('✓ Changes committed successfully');
    } catch (error) {
      throw new Error(`Failed to commit changes: ${error}`);
    }
  }

  async getCurrentBranchAsync(): Promise<string> {
    try {
      const branch = await this.git.branchLocal();
      return branch.current;
    } catch (error) {
      throw new Error(`Failed to get current branch: ${error}`);
    }
  }
}
