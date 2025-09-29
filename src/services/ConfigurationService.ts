import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { AppConfiguration } from '../models';
import OpenAI from 'openai';
import * as readline from 'readline';

export class ConfigurationService {
  private readonly configDirectory: string;
  private readonly configFilePath: string;

  constructor() {
    const homeDirectory = homedir();
    this.configDirectory = join(homeDirectory, '.writecommit');
    this.configFilePath = join(this.configDirectory, 'config.json');
  }

  /**
   * Loads the configuration from file
   */
  async loadConfiguration(): Promise<AppConfiguration | null> {
    try {
      await fs.access(this.configFilePath);
      const json = await fs.readFile(this.configFilePath, 'utf8');
      return JSON.parse(json) as AppConfiguration;
    } catch {
      // If there's any error reading or parsing the config, return null
      return null;
    }
  }

  /**
   * Saves the configuration to file
   */
  async saveConfiguration(config: AppConfiguration): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(this.configDirectory, { recursive: true });

    const json = JSON.stringify(config, null, 2);
    await fs.writeFile(this.configFilePath, json, 'utf8');

    // Set appropriate file permissions on Unix systems
    if (process.platform === 'linux' || process.platform === 'darwin') {
      await this.setUnixFilePermissions(this.configFilePath);
    }
  }

  /**
   * Gets the OpenAI API key from environment variable or config file
   */
  async getOpenAiApiKey(): Promise<string | null> {
    // First check environment variable (highest priority)
    const envApiKey = process.env.OPENAI_API_KEY;
    if (envApiKey) {
      return envApiKey;
    }

    // Then check config file
    const config = await this.loadConfiguration();
    return config?.openai_api_key ?? null;
  }

  /**
   * Gets the configured OpenAI endpoint or null if not set
   */
  async getOpenAiEndpoint(): Promise<string | null> {
    const config = await this.loadConfiguration();
    return config?.openai_endpoint ?? null;
  }

  /**
   * Gets the configured default model or null if not set
   */
  async getDefaultModel(): Promise<string | null> {
    const config = await this.loadConfiguration();
    return config?.default_model ?? null;
  }

  /**
   * Returns true if configuration specifies Azure OpenAI usage
   */
  async useAzureOpenAI(): Promise<boolean> {
    const config = await this.loadConfiguration();
    return config?.use_azure_openai ?? false;
  }

  /**
   * Prompts user to enter and save their OpenAI API key
   */
  async setupApiKey(verbose = false): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      console.log('WriteCommit Setup');
      console.log('=================');
      console.log();
      console.log('Please enter your OpenAI API key (or Azure OpenAI key).');
      console.log('You can get one from: https://platform.openai.com/api-keys or your Azure portal');
      console.log();

      const apiKey = await this.readMaskedInput('API Key (leave blank if not required): ');
      console.log();

      const azureInput = await this.question(rl, 'Use Azure OpenAI service? (y/N): ');
      const useAzure = azureInput.trim().toLowerCase() === 'y' || azureInput.trim().toLowerCase() === 'yes';

      const endpointPrompt = useAzure
        ? 'Azure endpoint (leave blank to use OpenAI): '
        : 'Endpoint (default: https://api.openai.com/v1): ';
      
      const endpointInput = await this.question(rl, endpointPrompt);
      let endpoint: string;
      let finalUseAzure = useAzure;

      if (!endpointInput.trim()) {
        endpoint = 'https://api.openai.com/v1';
        // If no Azure endpoint provided, fall back to OpenAI
        if (useAzure) {
          finalUseAzure = false;
        }
      } else {
        endpoint = endpointInput.trim();
      }

      const modelPrompt = finalUseAzure
        ? 'Deployment name (default: gpt-4o-mini): '
        : 'Default model (default: gpt-4o-mini): ';
      
      const modelInput = await this.question(rl, modelPrompt);
      const model = modelInput.trim() || 'gpt-4o-mini';

      // Load existing config or create new one
      const config = (await this.loadConfiguration()) ?? {};
      config.openai_api_key = apiKey || undefined;
      config.openai_endpoint = endpoint;
      config.default_model = model;
      config.use_azure_openai = finalUseAzure;

      // Save configuration
      await this.saveConfiguration(config);

      console.log(`✅ Configuration saved to ${this.configFilePath}`);

      if (verbose) {
        console.log('Configuration saved successfully.');
        console.log(`Config location: ${this.configFilePath}`);
      }

      // Optionally test the API key
      console.log();
      const testResponse = await this.question(rl, 'Would you like to test the API key? (y/N): ');

      if ((testResponse.trim().toLowerCase() === 'y' || testResponse.trim().toLowerCase() === 'yes') && apiKey) {
        return await this.testApiKey(apiKey, finalUseAzure, endpoint, model, verbose);
      }

      return true;
    } finally {
      rl.close();
    }
  }

  /**
   * Tests if the API key is valid by making a simple request
   */
  private async testApiKey(
    apiKey: string,
    useAzure: boolean,
    endpoint: string,
    model: string,
    verbose: boolean
  ): Promise<boolean> {
    console.log('Testing API key...');

    try {
      const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: endpoint.endsWith('/v1') ? endpoint : `${endpoint}/v1`,
      });

      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say "API key is valid" if you can read this.' },
        ],
        max_tokens: 50,
      });

      if (response.choices && response.choices.length > 0) {
        console.log('✅ API key is valid and working!');
        return true;
      } else {
        console.log('❌ API key test failed: No response received');
        return false;
      }
    } catch (error) {
      console.log(`❌ API key test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (verbose) {
        console.log(`Full error: ${error}`);
      }
      return false;
    }
  }

  /**
   * Sets Unix file permissions to 600 (owner read/write only)
   */
  private async setUnixFilePermissions(filePath: string): Promise<void> {
    // Only try to set Unix file permissions on Unix-based systems
    if (process.platform === 'linux' || process.platform === 'darwin') {
      try {
        await fs.chmod(filePath, 0o600);
      } catch {
        // Silently ignore if setting permissions fails
      }
    }
  }

  /**
   * Reads input from console with masking
   */
  private async readMaskedInput(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      process.stdout.write(prompt);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      let input = '';

      const onData = (char: string) => {
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004': // Ctrl+D
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.off('data', onData);
            console.log();
            resolve(input);
            break;
          case '\u0003': // Ctrl+C
            process.exit();
            break;
          case '\u007f': // Backspace
            if (input.length > 0) {
              input = input.slice(0, -1);
              process.stdout.write('\b \b');
            }
            break;
          default:
            input += char;
            process.stdout.write('*');
            break;
        }
      };

      process.stdin.on('data', onData);
    });
  }

  private question(rl: readline.Interface, prompt: string): Promise<string> {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  }
}