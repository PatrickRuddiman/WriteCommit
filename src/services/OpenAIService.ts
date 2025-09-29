import OpenAI from 'openai';
import { promises as fs } from 'fs';
import { join } from 'path';
import { DiffChunk } from '../models';
import { PatternNames } from '../constants';

export class OpenAIService {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly useAzure: boolean;
  private readonly patternsDirectory: string;
  private static readonly MAX_CONTEXT_TOKENS = 128000;
  private readonly openai: OpenAI;

  constructor(apiKey: string, endpoint?: string, useAzure = false) {
    if (!apiKey) {
      throw new Error('API key cannot be null or empty');
    }

    this.apiKey = apiKey;
    this.endpoint = endpoint || 'https://api.openai.com/v1';
    this.useAzure = useAzure;
    this.patternsDirectory = join(__dirname, '..', '..', 'patterns');

    // Create OpenAI client
    this.openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.endpoint.endsWith('/v1') ? this.endpoint : `${this.endpoint}/v1`,
    });
  }

  async generateCommitMessage(
    chunks: DiffChunk[],
    pattern: string,
    temperature: number,
    topP: number,
    presence: number,
    frequency: number,
    model: string,
    verbose: boolean
  ): Promise<string> {
    if (chunks.length === 1) {
      // Single chunk - process normally
      return await this.processSingleChunk(
        chunks[0],
        pattern,
        temperature,
        topP,
        presence,
        frequency,
        model,
        verbose
      );
    } else {
      // Multiple chunks - process individually and combine
      const commitMessages: string[] = [];
      if (verbose) {
        console.log(`Processing ${chunks.length} chunks in parallel...`);
      }

      // Create tasks for parallel processing
      const chunkTasks = chunks.map(async (chunk, index) => {
        if (verbose) {
          console.log(`Processing chunk ${index + 1}/${chunks.length}: ${chunk.fileName}`);
        }

        const chunkMessage = await this.processSingleChunk(
          chunk,
          PatternNames.CHUNK_PATTERN,
          temperature,
          topP,
          presence,
          frequency,
          model,
          verbose
        );

        return {
          index,
          fileName: chunk.fileName,
          message: chunkMessage,
        };
      });

      // Wait for all tasks to complete
      const results = await Promise.all(chunkTasks);

      // Process results in order
      for (const result of results.sort((a, b) => a.index - b.index)) {
        if (result.message && result.message.trim()) {
          commitMessages.push(`Chunk ${result.index + 1} (${result.fileName}): ${result.message.trim()}`);
        }
      }

      // Combine all chunk messages into a coherent commit message
      if (commitMessages.length === 0) {
        throw new Error('Failed to generate commit message from any chunk');
      }

      // For multiple chunks, create a summary message
      const combinedMessage = await this.combineChunkMessages(
        commitMessages,
        pattern,
        temperature,
        topP,
        presence,
        frequency,
        model,
        verbose
      );
      return combinedMessage;
    }
  }

  private async processSingleChunk(
    chunk: DiffChunk,
    pattern: string,
    temperature: number,
    topP: number,
    presence: number,
    frequency: number,
    model: string,
    verbose: boolean
  ): Promise<string> {
    if (verbose) {
      console.log(`Processing chunk with OpenAI API using pattern: ${pattern}`);
    }

    // Load the system prompt from the pattern file
    const systemPrompt = await this.loadPattern(pattern);
    if (!systemPrompt) {
      throw new Error(`Failed to load pattern: ${pattern}`);
    }

    if (verbose) {
      console.log(`Sending request to OpenAI API with model: ${model}`);
    }

    try {
      // Send request to OpenAI
      const response = await this.openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: chunk.content },
        ],
        temperature: this.convertTemperature(temperature),
        top_p: this.convertTopP(topP),
        presence_penalty: this.convertPenalty(presence),
        frequency_penalty: this.convertPenalty(frequency),
      });

      if (verbose) {
        console.log('Received response from OpenAI API');
      }

      if (response.choices && response.choices[0] && response.choices[0].message) {
        return response.choices[0].message.content?.trim() || '';
      } else {
        throw new Error('No response received from OpenAI API');
      }
    } catch (error) {
      if (verbose) {
        console.log(`Error calling OpenAI API: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      throw new Error(`Failed to generate commit message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async combineChunkMessages(
    chunkMessages: string[],
    pattern: string,
    temperature: number,
    topP: number,
    presence: number,
    frequency: number,
    model: string,
    verbose: boolean
  ): Promise<string> {
    if (verbose) {
      console.log('Combining chunk messages into final commit message...');
    }

    // Load the system prompt from the pattern file
    const systemPrompt = await this.loadPattern(pattern);
    if (!systemPrompt) {
      throw new Error(`Failed to load pattern: ${pattern}`);
    }

    const combinedContent = chunkMessages.join('\n\n');
    const estimatedTokens = this.estimateTokenCount(systemPrompt) + this.estimateTokenCount(combinedContent);

    if (estimatedTokens > OpenAIService.MAX_CONTEXT_TOKENS && chunkMessages.length > 1) {
      if (verbose) {
        console.log('Context length exceeded, re-chunking summaries...');
      }

      const groupedSummaries: string[] = [];
      const currentGroup: string[] = [];
      let currentTokens = this.estimateTokenCount(systemPrompt);

      for (const msg of chunkMessages) {
        const msgTokens = this.estimateTokenCount(msg);
        if (currentTokens + msgTokens > OpenAIService.MAX_CONTEXT_TOKENS / 2 && currentGroup.length > 0) {
          const summary = await this.combineChunkMessages(
            currentGroup,
            pattern,
            temperature,
            topP,
            presence,
            frequency,
            model,
            verbose
          );
          groupedSummaries.push(summary);
          currentGroup.length = 0;
          currentTokens = this.estimateTokenCount(systemPrompt);
        }

        currentGroup.push(msg);
        currentTokens += msgTokens;
      }

      if (currentGroup.length > 0) {
        const summary = await this.combineChunkMessages(
          currentGroup,
          pattern,
          temperature,
          topP,
          presence,
          frequency,
          model,
          verbose
        );
        groupedSummaries.push(summary);
      }

      return await this.combineChunkMessages(
        groupedSummaries,
        pattern,
        temperature,
        topP,
        presence,
        frequency,
        model,
        verbose
      );
    }

    try {
      // Send request to OpenAI
      const response = await this.openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: combinedContent },
        ],
        temperature: this.convertTemperature(temperature),
        top_p: this.convertTopP(topP),
        presence_penalty: this.convertPenalty(presence),
        frequency_penalty: this.convertPenalty(frequency),
      });

      if (response.choices && response.choices[0] && response.choices[0].message) {
        return response.choices[0].message.content?.trim() || '';
      } else {
        throw new Error('No response received from OpenAI API');
      }
    } catch (error) {
      // If combining fails, return the first chunk message as fallback
      if (verbose) {
        console.log(`Error calling OpenAI API: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.log('Failed to combine messages, using first chunk as fallback');
      }
      const fallback = chunkMessages[0].split(':').slice(1).join(':').trim();
      return fallback || chunkMessages[0];
    }
  }

  /**
   * Loads a pattern file from the patterns directory
   */
  private async loadPattern(patternName: string): Promise<string> {
    const patternPath = join(this.patternsDirectory, patternName, 'system.md');

    try {
      return await fs.readFile(patternPath, 'utf8');
    } catch {
      throw new Error(`Pattern file not found: ${patternPath}`);
    }
  }

  /**
   * Converts the temperature value from the CLI (0-2) to OpenAI API range (0-2)
   */
  private convertTemperature(temperature: number): number {
    // OpenAI uses 0-2 for temperature
    return Math.max(0, Math.min(temperature, 2));
  }

  /**
   * Converts the top-p value from the CLI (0-1) to OpenAI API range (0-1)
   */
  private convertTopP(topP: number): number {
    // OpenAI uses 0-1 for top-p
    return Math.max(0, Math.min(topP, 1));
  }

  /**
   * Converts the penalty value from the CLI (-2 to 2) to OpenAI API range (-2 to 2)
   */
  private convertPenalty(penalty: number): number {
    // OpenAI uses -2 to 2 for penalties
    return Math.max(-2, Math.min(penalty, 2));
  }

  /**
   * Estimates token count using a rough 4 chars per token heuristic
   */
  private estimateTokenCount(text: string): number {
    return Math.max(1, Math.floor(text.length / 4));
  }
}