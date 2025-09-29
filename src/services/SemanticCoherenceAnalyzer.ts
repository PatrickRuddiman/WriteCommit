import { DiffChunk } from '../models';

export class SemanticCoherenceAnalyzer {
  private static readonly MAX_TOKENS_PER_CHUNK = 3000; // Conservative estimate for LLM context
  private static readonly TARGET_CHUNK_SIZE = 2500;

  constructor() {}

  chunkDiff(gitDiff: string, verbose = false): DiffChunk[] {
    if (verbose) {
      console.log('Starting semantic coherence analysis of git diff...');
    }

    const chunks: DiffChunk[] = [];
    const lines = gitDiff.split('\n').filter(line => line.length > 0);

    if (this.estimateTokenCount(gitDiff) <= SemanticCoherenceAnalyzer.MAX_TOKENS_PER_CHUNK) {
      if (verbose) {
        console.log('Diff is small enough, no chunking needed');
      }

      chunks.push({
        fileName: 'all_changes',
        content: gitDiff,
        lineCount: lines.length,
        changeType: 'Mixed',
      });
      return chunks;
    }

    if (verbose) {
      console.log('Large diff detected, applying semantic chunking...');
    }

    let currentChunk = '';
    let currentFileName = '';
    const fileChanges = new Map<string, string[]>();

    for (const line of lines) {
      // Detect file boundaries
      if (line.startsWith('diff --git')) {
        // Save previous chunk if it exists
        if (currentChunk && currentFileName) {
          if (!fileChanges.has(currentFileName)) {
            fileChanges.set(currentFileName, []);
          }
          fileChanges.get(currentFileName)!.push(currentChunk);
        }

        // Extract file name
        const match = line.match(/diff --git a\/(.*?) b\/(.*)/);
        if (match) {
          currentFileName = match[2];
        }

        currentChunk = '';
      }

      currentChunk += line + '\n';
    }

    // Add the last chunk
    if (currentChunk && currentFileName) {
      if (!fileChanges.has(currentFileName)) {
        fileChanges.set(currentFileName, []);
      }
      fileChanges.get(currentFileName)!.push(currentChunk);
    }

    // Group files by semantic similarity and size constraints
    chunks.push(...this.groupFilesBySemanticCoherence(fileChanges, verbose));

    if (verbose) {
      console.log(`Created ${chunks.length} semantic chunks`);
    }

    return chunks;
  }

  private groupFilesBySemanticCoherence(
    fileChanges: Map<string, string[]>,
    verbose: boolean
  ): DiffChunk[] {
    const chunks: DiffChunk[] = [];
    const processedFiles = new Set<string>();

    for (const [fileName, changes] of fileChanges) {
      if (processedFiles.has(fileName)) {
        continue;
      }

      const content = changes.join('\n');
      const tokenCount = this.estimateTokenCount(content);

      if (tokenCount > SemanticCoherenceAnalyzer.MAX_TOKENS_PER_CHUNK) {
        // File is too large, split it into smaller chunks
        const splitChunks = this.splitLargeFile(fileName, content, verbose);
        chunks.push(...splitChunks);
      } else {
        // Create chunk with similar files
        const chunk = this.createChunkWithSimilarFiles(fileName, fileChanges, processedFiles, verbose);
        chunks.push(chunk);
      }

      processedFiles.add(fileName);
    }

    return chunks;
  }

  private createChunkWithSimilarFiles(
    primaryFile: string,
    fileChanges: Map<string, string[]>,
    processedFiles: Set<string>,
    verbose: boolean
  ): DiffChunk {
    const similarFiles: string[] = [primaryFile];
    const contents: string[] = [fileChanges.get(primaryFile)!.join('\n')];
    let totalTokens = this.estimateTokenCount(contents[0]);

    // Find semantically similar files that can fit in the same chunk
    for (const [fileName, changes] of fileChanges) {
      if (processedFiles.has(fileName) || fileName === primaryFile) {
        continue;
      }

      if (this.areFilesSemanticallySimilar(primaryFile, fileName)) {
        const content = changes.join('\n');
        const tokens = this.estimateTokenCount(content);

        if (totalTokens + tokens <= SemanticCoherenceAnalyzer.TARGET_CHUNK_SIZE) {
          similarFiles.push(fileName);
          contents.push(content);
          totalTokens += tokens;
          processedFiles.add(fileName);

          if (verbose) {
            console.log(`Grouped ${fileName} with ${primaryFile} (similar files)`);
          }
        }
      }
    }

    return {
      fileName: similarFiles.length > 1 ? `${primaryFile}_and_${similarFiles.length - 1}_more` : primaryFile,
      content: contents.join('\n\n'),
      lineCount: contents.reduce((sum, content) => sum + content.split('\n').length, 0),
      changeType: this.determineChangeType(contents.join('\n')),
    };
  }

  private splitLargeFile(fileName: string, content: string, verbose: boolean): DiffChunk[] {
    const chunks: DiffChunk[] = [];
    const lines = content.split('\n');
    let currentChunk = '';
    let chunkIndex = 1;
    let currentTokens = 0;

    if (verbose) {
      console.log(`Splitting large file ${fileName} into smaller chunks...`);
    }

    for (const line of lines) {
      const lineTokens = this.estimateTokenCount(line);

      if (currentTokens + lineTokens > SemanticCoherenceAnalyzer.TARGET_CHUNK_SIZE && currentChunk.length > 0) {
        // Create chunk
        chunks.push({
          fileName: `${fileName}_chunk_${chunkIndex}`,
          content: currentChunk.trim(),
          lineCount: currentChunk.split('\n').length,
          changeType: this.determineChangeType(currentChunk),
        });

        currentChunk = '';
        currentTokens = 0;
        chunkIndex++;
      }

      currentChunk += line + '\n';
      currentTokens += lineTokens;
    }

    // Add remaining content
    if (currentChunk.length > 0) {
      chunks.push({
        fileName: chunks.length > 0 ? `${fileName}_chunk_${chunkIndex}` : fileName,
        content: currentChunk.trim(),
        lineCount: currentChunk.split('\n').length,
        changeType: this.determineChangeType(currentChunk),
      });
    }

    return chunks;
  }

  private areFilesSemanticallySimilar(file1: string, file2: string): boolean {
    // Simple semantic similarity based on file extensions and path structure
    const ext1 = this.getFileExtension(file1).toLowerCase();
    const ext2 = this.getFileExtension(file2).toLowerCase();

    // Same extension
    if (ext1 === ext2) {
      return true;
    }

    // Related file types
    const webFiles = ['.html', '.css', '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'];
    const codeFiles = ['.cs', '.vb', '.fs', '.cpp', '.h', '.c', '.java', '.py', '.rb', '.go', '.rs'];
    const configFiles = ['.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.config'];

    if (webFiles.includes(ext1) && webFiles.includes(ext2)) return true;
    if (codeFiles.includes(ext1) && codeFiles.includes(ext2)) return true;
    if (configFiles.includes(ext1) && configFiles.includes(ext2)) return true;

    // Check if files are in the same directory
    const dir1 = this.getDirectoryPath(file1);
    const dir2 = this.getDirectoryPath(file2);
    if (dir1 === dir2) return true;

    return false;
  }

  private determineChangeType(content: string): string {
    const hasAdditions = content.includes('\n+') || content.includes('new file mode');
    const hasDeletions = content.includes('\n-') || content.includes('deleted file mode');
    const hasRenames = content.includes('rename from') || content.includes('rename to');

    if (hasRenames) return 'Renamed';
    if (hasAdditions && hasDeletions) return 'Modified';
    if (hasAdditions) return 'Added';
    if (hasDeletions) return 'Deleted';
    return 'Modified';
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token for code
    // This is conservative to ensure we don't exceed LLM limits
    return Math.max(1, Math.floor(text.length / 4));
  }

  private getFileExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    return lastDot === -1 ? '' : filePath.substring(lastDot);
  }

  private getDirectoryPath(filePath: string): string {
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    return lastSlash === -1 ? '' : filePath.substring(0, lastSlash);
  }
}