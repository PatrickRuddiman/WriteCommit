import * as vscode from 'vscode';
import { DiffChunk } from '../models';
import { PatternNames } from '../constants';

export class VSCodeLMService {
  constructor(private verbose: boolean = false) {}

  async generateCommitMessageAsync(
    chunks: DiffChunk[],
    pattern: string,
    patternService: any
  ): Promise<string> {
    // Check if Language Model API is available
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    });

    if (models.length === 0) {
      throw new Error(
        'No Copilot models available. Please ensure you have GitHub Copilot enabled in VSCode.'
      );
    }

    const model = models[0];

    if (chunks.length === 1) {
      return await this.processSingleChunkAsync(chunks[0], pattern, patternService, model);
    } else {
      // Multiple chunks - process individually and combine
      if (this.verbose) {
        console.log(`Processing ${chunks.length} chunks...`);
      }

      const chunkTasks = chunks.map(async (chunk, index) => {
        if (this.verbose) {
          console.log(`Processing chunk ${index + 1}/${chunks.length}: ${chunk.fileName}`);
        }

        const chunkMessage = await this.processSingleChunkAsync(
          chunk,
          PatternNames.ChunkPattern,
          patternService,
          model
        );

        return {
          index,
          fileName: chunk.fileName,
          message: chunkMessage
        };
      });

      const results = await Promise.all(chunkTasks);

      const commitMessages = results
        .sort((a, b) => a.index - b.index)
        .filter(r => r.message && r.message.trim())
        .map(r => `Chunk ${r.index + 1} (${r.fileName}): ${r.message.trim()}`);

      if (commitMessages.length === 0) {
        throw new Error('Failed to generate commit message from any chunk');
      }

      const combinedMessage = await this.combineChunkMessagesAsync(
        commitMessages,
        pattern,
        patternService,
        model
      );
      return combinedMessage;
    }
  }

  private async processSingleChunkAsync(
    chunk: DiffChunk,
    pattern: string,
    patternService: any,
    model: vscode.LanguageModelChat
  ): Promise<string> {
    if (this.verbose) {
      console.log(`Processing chunk with VSCode LM API using pattern: ${pattern}`);
    }

    const patternInfo = await patternService.loadPatternAsync(pattern);
    if (!patternInfo || !patternInfo.systemPrompt) {
      throw new Error(`Failed to load pattern: ${pattern}`);
    }

    const messages = [
      vscode.LanguageModelChatMessage.User(patternInfo.systemPrompt),
      vscode.LanguageModelChatMessage.User(chunk.content)
    ];

    if (this.verbose) {
      console.log(`Sending request to VSCode LM API with model: ${model.id}`);
    }

    try {
      const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

      let fullResponse = '';
      for await (const chunk of response.text) {
        fullResponse += chunk;
      }

      if (this.verbose) {
        console.log('Received response from VSCode LM API');
      }

      if (!fullResponse.trim()) {
        throw new Error('No response received from VSCode LM API');
      }

      return fullResponse.trim();
    } catch (error: any) {
      if (this.verbose) {
        console.log(`Error calling VSCode LM API: ${error.message}`);
      }
      throw new Error(`Failed to generate commit message: ${error.message}`);
    }
  }

  private async combineChunkMessagesAsync(
    chunkMessages: string[],
    pattern: string,
    patternService: any,
    model: vscode.LanguageModelChat
  ): Promise<string> {
    if (this.verbose) {
      console.log('Combining chunk messages into final commit message...');
    }

    const patternInfo = await patternService.loadPatternAsync(pattern);
    if (!patternInfo || !patternInfo.systemPrompt) {
      throw new Error(`Failed to load pattern: ${pattern}`);
    }

    const combinedContent = chunkMessages.join('\n\n');

    const messages = [
      vscode.LanguageModelChatMessage.User(patternInfo.systemPrompt),
      vscode.LanguageModelChatMessage.User(combinedContent)
    ];

    try {
      const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

      let fullResponse = '';
      for await (const chunk of response.text) {
        fullResponse += chunk;
      }

      if (!fullResponse.trim()) {
        throw new Error('No response received from VSCode LM API');
      }

      return fullResponse.trim();
    } catch (error: any) {
      if (this.verbose) {
        console.log(`Error calling VSCode LM API: ${error.message}`);
        console.log('Failed to combine messages, using first chunk as fallback');
      }
      const firstMessage = chunkMessages[0].split(':').slice(1).join(':').trim();
      return firstMessage || chunkMessages[0];
    }
  }
}
