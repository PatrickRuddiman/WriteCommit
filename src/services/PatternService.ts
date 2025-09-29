import { promises as fs } from 'fs';
import { join } from 'path';

export class PatternService {
  private readonly patternsDirectory: string;
  private readonly verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
    // In Node.js, we'll use the patterns directory relative to the dist folder
    this.patternsDirectory = join(__dirname, '..', '..', 'patterns');
  }

  /**
   * Ensures all patterns are available
   */
  async ensurePatternsInstalled(): Promise<void> {
    try {
      await fs.access(this.patternsDirectory);
    } catch {
      if (this.verbose) {
        console.log('Patterns directory not found.');
      }
      throw new Error(`Patterns directory not found: ${this.patternsDirectory}`);
    }

    const patternDirectories = await fs.readdir(this.patternsDirectory, { withFileTypes: true });
    const directories = patternDirectories.filter(dirent => dirent.isDirectory());

    if (this.verbose) {
      console.log(`Found ${directories.length} patterns available.`);
    }

    // Verify each pattern has a system.md file
    for (const dirent of directories) {
      const patternName = dirent.name;
      const systemFile = join(this.patternsDirectory, patternName, 'system.md');

      try {
        await fs.access(systemFile);
        if (this.verbose) {
          console.log(`✓ Pattern '${patternName}' is available`);
        }
      } catch {
        throw new Error(`Pattern '${patternName}' is missing system.md file`);
      }
    }
  }
}