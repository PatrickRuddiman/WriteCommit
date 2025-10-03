import * as path from 'path';
import { DiffChunk } from '../models';

export class SemanticAnalyzer {
  private static readonly MaxTokensPerChunk = 3000;
  private static readonly TargetChunkSize = 2500;

  constructor(private verbose: boolean = false) {}

  chunkDiff(gitDiff: string): DiffChunk[] {
    if (this.verbose) {
      console.log('Starting semantic coherence analysis of git diff...');
    }

    const chunks: DiffChunk[] = [];
    const lines = gitDiff.split('\n').filter(line => line.length > 0);

    if (this.estimateTokenCount(gitDiff) <= SemanticAnalyzer.MaxTokensPerChunk) {
      if (this.verbose) {
        console.log('Diff is small enough, no chunking needed');
      }

      chunks.push({
        fileName: 'all_changes',
        content: gitDiff,
        lineCount: lines.length,
        changeType: 'Mixed'
      });
      return chunks;
    }

    if (this.verbose) {
      console.log('Large diff detected, applying semantic chunking...');
    }

    let currentChunk: string[] = [];
    let currentFileName = '';
    const fileChanges = new Map<string, string[]>();

    for (const line of lines) {
      // Detect file boundaries
      if (line.startsWith('diff --git')) {
        // Save previous chunk if it exists
        if (currentChunk.length > 0 && currentFileName) {
          if (!fileChanges.has(currentFileName)) {
            fileChanges.set(currentFileName, []);
          }
          fileChanges.get(currentFileName)!.push(...currentChunk);
        }

        // Extract file name
        const match = line.match(/diff --git a\/(.*?) b\/(.*)/);
        if (match) {
          currentFileName = match[2];
        }

        currentChunk = [];
      }

      currentChunk.push(line);
    }

    // Add the last chunk
    if (currentChunk.length > 0 && currentFileName) {
      if (!fileChanges.has(currentFileName)) {
        fileChanges.set(currentFileName, []);
      }
      fileChanges.get(currentFileName)!.push(...currentChunk);
    }

    // Group files by semantic similarity and size constraints
    const groupedChunks = this.groupFilesBySemanticCoherence(fileChanges);

    if (this.verbose) {
      console.log(`Created ${groupedChunks.length} semantic chunks`);
    }

    return groupedChunks;
  }

  private groupFilesBySemanticCoherence(
    fileChanges: Map<string, string[]>
  ): DiffChunk[] {
    const chunks: DiffChunk[] = [];
    const processedFiles = new Set<string>();

    for (const [fileName, lines] of fileChanges) {
      if (processedFiles.has(fileName)) {
        continue;
      }

      const content = lines.join('\n');
      const estimatedTokens = this.estimateTokenCount(content);

      if (estimatedTokens <= SemanticAnalyzer.TargetChunkSize) {
        // Try to group with similar files
        const chunk = this.createChunkWithSimilarFiles(
          fileName,
          fileChanges,
          processedFiles
        );
        chunks.push(chunk);
      } else {
        // File is too large, split it further
        const subChunks = this.splitLargeFile(fileName, content);
        chunks.push(...subChunks);
        processedFiles.add(fileName);
      }
    }

    return chunks;
  }

  private createChunkWithSimilarFiles(
    primaryFile: string,
    fileChanges: Map<string, string[]>,
    processedFiles: Set<string>
  ): DiffChunk {
    const chunkContent: string[] = [];
    const chunkFiles: string[] = [primaryFile];
    let totalTokens = this.estimateTokenCount(fileChanges.get(primaryFile)!.join('\n'));

    chunkContent.push(...fileChanges.get(primaryFile)!);
    processedFiles.add(primaryFile);

    // Look for semantically similar files that can fit in the same chunk
    for (const [fileName, lines] of fileChanges) {
      if (processedFiles.has(fileName)) {
        continue;
      }

      const content = lines.join('\n');
      const fileTokens = this.estimateTokenCount(content);

      // Check if files are semantically related and fit within token limits
      if (
        totalTokens + fileTokens <= SemanticAnalyzer.TargetChunkSize &&
        this.areFilesSemanticallySimilar(primaryFile, fileName)
      ) {
        chunkContent.push('');
        chunkContent.push(...lines);
        chunkFiles.push(fileName);
        totalTokens += fileTokens;
        processedFiles.add(fileName);

        if (this.verbose) {
          console.log(`Grouped ${fileName} with ${primaryFile} (semantic similarity)`);
        }
      }
    }

    const finalContent = chunkContent.join('\n');
    const displayName =
      chunkFiles.length === 1
        ? primaryFile
        : `${chunkFiles.length}_files_(${chunkFiles.slice(0, 3).join(', ')}${chunkFiles.length > 3 ? '...' : ''})`;

    return {
      fileName: displayName,
      content: finalContent,
      lineCount: chunkContent.length,
      changeType: this.determineChangeType(finalContent)
    };
  }

  private splitLargeFile(fileName: string, content: string): DiffChunk[] {
    const chunks: DiffChunk[] = [];
    const lines = content.split('\n');
    let currentChunk: string[] = [];
    let chunkIndex = 1;
    let currentTokens = 0;

    if (this.verbose) {
      console.log(`Splitting large file ${fileName} into smaller chunks...`);
    }

    for (const line of lines) {
      const lineTokens = this.estimateTokenCount(line);

      if (
        currentTokens + lineTokens > SemanticAnalyzer.TargetChunkSize &&
        currentChunk.length > 0
      ) {
        // Create chunk
        const chunkContent = currentChunk.join('\n');
        chunks.push({
          fileName: `${fileName}_chunk_${chunkIndex}`,
          content: chunkContent,
          lineCount: currentChunk.length,
          changeType: this.determineChangeType(chunkContent)
        });

        currentChunk = [];
        currentTokens = 0;
        chunkIndex++;
      }

      currentChunk.push(line);
      currentTokens += lineTokens;
    }

    // Add remaining content
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      chunks.push({
        fileName: chunks.length > 0 ? `${fileName}_chunk_${chunkIndex}` : fileName,
        content: chunkContent,
        lineCount: currentChunk.length,
        changeType: this.determineChangeType(chunkContent)
      });
    }

    return chunks;
  }

  private areFilesSemanticallySimilar(file1: string, file2: string): boolean {
    const ext1 = path.extname(file1).toLowerCase();
    const ext2 = path.extname(file2).toLowerCase();

    // Same extension
    if (ext1 === ext2) {
      return true;
    }

    // Related file types
    const webFiles = ['.html', '.css', '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'];
    const codeFiles = [
      '.cs',
      '.vb',
      '.fs',
      '.cpp',
      '.h',
      '.c',
      '.java',
      '.py',
      '.rb',
      '.go',
      '.rs'
    ];
    const configFiles = ['.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.config'];
    const docFiles = ['.md', '.txt', '.rst', '.adoc'];

    const isInCategory = (ext: string, category: string[]) => category.includes(ext);

    return (
      (isInCategory(ext1, webFiles) && isInCategory(ext2, webFiles)) ||
      (isInCategory(ext1, codeFiles) && isInCategory(ext2, codeFiles)) ||
      (isInCategory(ext1, configFiles) && isInCategory(ext2, configFiles)) ||
      (isInCategory(ext1, docFiles) && isInCategory(ext2, docFiles)) ||
      path.dirname(file1) === path.dirname(file2) // Same directory
    );
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
    return Math.max(1, Math.floor(text.length / 4));
  }
}
