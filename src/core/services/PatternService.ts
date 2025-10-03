import * as fs from 'fs-extra';
import * as path from 'path';
import { PatternInfo } from '../models';

export class PatternService {
  private verbose: boolean;
  private patternsDirectory: string;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;
    // Patterns are located relative to the project root
    this.patternsDirectory = path.join(__dirname, '../../../patterns');
  }

  async ensurePatternsInstalledAsync(): Promise<void> {
    if (this.verbose) {
      console.log(`Checking for patterns in: ${this.patternsDirectory}`);
    }

    if (!await fs.pathExists(this.patternsDirectory)) {
      throw new Error(
        `Patterns directory not found at ${this.patternsDirectory}. ` +
        'Please ensure the patterns directory is included with the installation.'
      );
    }
  }

  async loadPatternAsync(patternName: string): Promise<PatternInfo> {
    const patternPath = path.join(this.patternsDirectory, patternName);
    const systemFilePath = path.join(patternPath, 'system.md');

    if (this.verbose) {
      console.log(`Loading pattern from: ${systemFilePath}`);
    }

    if (!await fs.pathExists(systemFilePath)) {
      throw new Error(
        `Pattern file not found: ${systemFilePath}. ` +
        `Available patterns should be in the ${this.patternsDirectory} directory.`
      );
    }

    const systemPrompt = await fs.readFile(systemFilePath, 'utf-8');

    if (this.verbose) {
      console.log(`Pattern loaded successfully: ${patternName}`);
    }

    return {
      name: patternName,
      systemPrompt: systemPrompt.trim()
    };
  }

  async listAvailablePatternsAsync(): Promise<string[]> {
    if (!await fs.pathExists(this.patternsDirectory)) {
      return [];
    }

    const entries = await fs.readdir(this.patternsDirectory, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  }
}
