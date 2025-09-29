import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

interface CommandResult {
  exitCode: number;
  output: string;
  error: string;
}

export class GitService {
  async isInGitRepository(): Promise<boolean> {
    try {
      const result = await this.runCommand('git', ['rev-parse', '--git-dir'], false);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  async getStagedChanges(verbose = false): Promise<string> {
    const result = await this.runCommand('git', ['--no-pager', 'diff', '--staged'], verbose);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to get staged changes: ${result.error}`);
    }
    return result.output;
  }

  async getStagedChangesWithContext(contextLines: number, verbose = false): Promise<string> {
    const args = ['--no-pager', 'diff', '--staged', `--unified=${contextLines}`];
    const result = await this.runCommand('git', args, verbose);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to get staged changes with context: ${result.error}`);
    }
    return result.output;
  }

  async commitChanges(commitMessage: string, verbose: boolean): Promise<void> {
    // Create temporary file for commit message
    const tempFile = join(tmpdir(), `commit-message-${Date.now()}.txt`);
    try {
      await fs.writeFile(tempFile, commitMessage, 'utf8');

      // Commit using git
      await this.runGitCommand(['commit', '-F', tempFile], verbose);
      console.log('Changes committed successfully!');
    } finally {
      // Clean up temporary file
      try {
        await fs.unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private async runGitCommand(args: string[], verbose: boolean): Promise<void> {
    const result = await this.runCommand('git', args, verbose);
    if (result.exitCode !== 0) {
      throw new Error(`Git command failed: ${result.error}`);
    }
  }

  private async runCommand(command: string, args: string[], verbose: boolean): Promise<CommandResult> {
    if (verbose) {
      console.log(`Running: ${command} ${args.join(' ')}`);
    }

    return new Promise((resolve) => {
      const process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let output = '';
      let error = '';

      process.stdout.on('data', (data: Buffer) => {
        output += data.toString('utf8');
      });

      process.stderr.on('data', (data: Buffer) => {
        error += data.toString('utf8');
      });

      process.on('close', (code) => {
        resolve({
          exitCode: code || 0,
          output: output.trim(),
          error: error.trim(),
        });
      });

      process.on('error', (err) => {
        resolve({
          exitCode: 1,
          output: '',
          error: err.message,
        });
      });
    });
  }
}