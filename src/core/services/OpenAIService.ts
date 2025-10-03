import OpenAI from 'openai';
import { DiffChunk } from '../models';
import { PatternNames } from '../constants';

export class OpenAIService {
  private static readonly MaxContextTokens = 128000;
  private client: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    if (!apiKey) {
      throw new Error('API key cannot be null or empty');
    }

    const config: any = { apiKey };
    if (baseURL) {
      config.baseURL = baseURL;
    }

    this.client = new OpenAI(config);
  }

  async generateCommitMessageAsync(
    chunks: DiffChunk[],
    pattern: string,
    temperature: number,
    topP: number,
    presence: number,
    frequency: number,
    model: string,
    verbose: boolean,
    patternService: any
  ): Promise<string> {
    if (chunks.length === 1) {
      return await this.processSingleChunkAsync(
        chunks[0],
        pattern,
        temperature,
        topP,
        presence,
        frequency,
        model,
        verbose,
        patternService
      );
    } else {
      // Multiple chunks - process individually and combine
      if (verbose) {
        console.log(`Processing ${chunks.length} chunks in parallel...`);
      }

      const chunkTasks = chunks.map(async (chunk, index) => {
        if (verbose) {
          console.log(`Processing chunk ${index + 1}/${chunks.length}: ${chunk.fileName}`);
        }

        const chunkMessage = await this.processSingleChunkAsync(
          chunk,
          PatternNames.ChunkPattern,
          temperature,
          topP,
          presence,
          frequency,
          model,
          verbose,
          patternService
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
        temperature,
        topP,
        presence,
        frequency,
        model,
        verbose,
        patternService
      );
      return combinedMessage;
    }
  }

  private async processSingleChunkAsync(
    chunk: DiffChunk,
    pattern: string,
    temperature: number,
    topP: number,
    presence: number,
    frequency: number,
    model: string,
    verbose: boolean,
    patternService: any
  ): Promise<string> {
    if (verbose) {
      console.log(`Processing chunk with OpenAI API using pattern: ${pattern}`);
    }

    const patternInfo = await patternService.loadPatternAsync(pattern);
    if (!patternInfo || !patternInfo.systemPrompt) {
      throw new Error(`Failed to load pattern: ${pattern}`);
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: patternInfo.systemPrompt },
      { role: 'user', content: chunk.content }
    ];

    if (verbose) {
      console.log(`Sending request to OpenAI API with model: ${model}`);
    }

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages,
        temperature: this.convertTemperature(temperature),
        top_p: this.convertTopP(topP),
        presence_penalty: this.convertPenalty(presence),
        frequency_penalty: this.convertPenalty(frequency)
      });

      if (verbose) {
        console.log('Received response from OpenAI API');
      }

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response received from OpenAI API');
      }

      return content.trim();
    } catch (error: any) {
      if (verbose) {
        console.log(`Error calling OpenAI API: ${error.message}`);
        if (error.status) {
          console.log(`HTTP Status: ${error.status}`);
        }
        if (error.type) {
          console.log(`Error Type: ${error.type}`);
        }
        if (error.code) {
          console.log(`Error Code: ${error.code}`);
        }
      }
      throw new Error(`Failed to generate commit message: ${error.message}`);
    }
  }

  private async combineChunkMessagesAsync(
    chunkMessages: string[],
    pattern: string,
    temperature: number,
    topP: number,
    presence: number,
    frequency: number,
    model: string,
    verbose: boolean,
    patternService: any
  ): Promise<string> {
    if (verbose) {
      console.log('Combining chunk messages into final commit message...');
    }

    const patternInfo = await patternService.loadPatternAsync(pattern);
    if (!patternInfo || !patternInfo.systemPrompt) {
      throw new Error(`Failed to load pattern: ${pattern}`);
    }

    const combinedContent = chunkMessages.join('\n\n');
    const estimatedTokens =
      this.estimateTokenCount(patternInfo.systemPrompt) +
      this.estimateTokenCount(combinedContent);

    if (estimatedTokens > OpenAIService.MaxContextTokens && chunkMessages.length > 1) {
      if (verbose) {
        console.log('Context length exceeded, re-chunking summaries...');
      }

      const groupedSummaries: string[] = [];
      let currentGroup: string[] = [];
      let currentTokens = this.estimateTokenCount(patternInfo.systemPrompt);

      for (const msg of chunkMessages) {
        const msgTokens = this.estimateTokenCount(msg);
        if (
          currentTokens + msgTokens > OpenAIService.MaxContextTokens / 2 &&
          currentGroup.length > 0
        ) {
          const summary = await this.combineChunkMessagesAsync(
            currentGroup,
            pattern,
            temperature,
            topP,
            presence,
            frequency,
            model,
            verbose,
            patternService
          );
          groupedSummaries.push(summary);
          currentGroup = [];
          currentTokens = this.estimateTokenCount(patternInfo.systemPrompt);
        }

        currentGroup.push(msg);
        currentTokens += msgTokens;
      }

      if (currentGroup.length > 0) {
        const summary = await this.combineChunkMessagesAsync(
          currentGroup,
          pattern,
          temperature,
          topP,
          presence,
          frequency,
          model,
          verbose,
          patternService
        );
        groupedSummaries.push(summary);
      }

      return await this.combineChunkMessagesAsync(
        groupedSummaries,
        pattern,
        temperature,
        topP,
        presence,
        frequency,
        model,
        verbose,
        patternService
      );
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: patternInfo.systemPrompt },
      { role: 'user', content: combinedContent }
    ];

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages,
        temperature: this.convertTemperature(temperature),
        top_p: this.convertTopP(topP),
        presence_penalty: this.convertPenalty(presence),
        frequency_penalty: this.convertPenalty(frequency)
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response received from OpenAI API');
      }

      return content.trim();
    } catch (error: any) {
      if (verbose) {
        console.log(`Error calling OpenAI API: ${error.message}`);
        console.log('Failed to combine messages, using first chunk as fallback');
      }
      const firstMessage = chunkMessages[0].split(':').slice(1).join(':').trim();
      return firstMessage || chunkMessages[0];
    }
  }

  private convertTemperature(temperature: number): number {
    return Math.max(0, Math.min(2, temperature));
  }

  private convertTopP(topP: number): number {
    return Math.max(0, Math.min(1, topP));
  }

  private convertPenalty(penalty: number): number {
    return Math.max(-2, Math.min(2, penalty));
  }

  private estimateTokenCount(text: string): number {
    return Math.max(1, Math.floor(text.length / 4));
  }
}
