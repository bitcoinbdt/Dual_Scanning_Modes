import fs from 'fs';
import path from 'path';

/**
 * ConfigManager - Handles configuration loading and validation
 * 
 * Responsibilities:
 * - Load and validate environment variables (BIRDEYE_API_KEY)
 * - Read and parse tokens.json file
 * - Validate token specifications (name, address, launch_time)
 * - Validate address formats (Ethereum 0x, Solana base58)
 * - Validate launch timestamps
 * - Handle missing file and invalid JSON errors
 */
class ConfigManager {
  constructor() {
    this.config = {
      apiKey: null,
      tokensFilePath: null,
      outputDirectory: 'output',
      tokens: []
    };
  }

  /**
   * Load environment variables and validate API key
   * @throws {Error} If BIRDEYE_API_KEY is not set
   */
  loadEnvironment() {
    const apiKey = process.env.BIRDEYE_API_KEY;
    
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('BIRDEYE_API_KEY environment variable is not set. Please set it before running the tool.');
    }
    
    this.config.apiKey = apiKey.trim();
  }

  /**
   * Validate that API key is loaded
   * @returns {boolean} True if API key is valid
   * @throws {Error} If API key is not loaded
   */
  validateApiKey() {
    if (!this.config.apiKey) {
      throw new Error('API key not loaded. Call loadEnvironment() first.');
    }
    return true;
  }

  /**
   * Load and parse tokens from JSON file
   * @param {string} filePath - Path to tokens.json file
   * @throws {Error} If file doesn't exist, can't be read, or contains invalid JSON
   */
  loadTokensFile(filePath) {
    // Store the file path
    this.config.tokensFilePath = filePath;

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Tokens file not found: ${filePath}`);
    }

    // Read file content
    let fileContent;
    try {
      fileContent = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read tokens file: ${error.message}`);
    }

    // Parse JSON
    let tokens;
    try {
      tokens = JSON.parse(fileContent);
    } catch (error) {
      throw new Error(`Invalid JSON in tokens file: ${error.message}`);
    }

    // Validate that tokens is an array
    if (!Array.isArray(tokens)) {
      throw new Error('Tokens file must contain a JSON array of token specifications');
    }

    // Validate each token
    this.validateTokens(tokens);

    // Store validated tokens
    this.config.tokens = tokens;
  }

  /**
   * Validate array of token specifications
   * @param {Array} tokens - Array of token objects
   * @throws {Error} If any token is invalid
   */
  validateTokens(tokens) {
    if (tokens.length === 0) {
      throw new Error('Tokens file must contain at least one token');
    }

    tokens.forEach((token, index) => {
      this.validateTokenSpecification(token, index);
    });
  }

  /**
   * Validate a single token specification
   * @param {Object} token - Token object to validate
   * @param {number} index - Index of token in array (for error messages)
   * @throws {Error} If token specification is invalid
   */
  validateTokenSpecification(token, index) {
    const tokenLabel = token.name || `Token at index ${index}`;

    // Check required fields exist
    if (!token.name) {
      throw new Error(`${tokenLabel}: Missing required field 'name'`);
    }
    if (!token.address) {
      throw new Error(`${tokenLabel}: Missing required field 'address'`);
    }
    if (token.launch_time === undefined || token.launch_time === null) {
      throw new Error(`${tokenLabel}: Missing required field 'launch_time'`);
    }

    // Validate name is a non-empty string
    if (typeof token.name !== 'string' || token.name.trim() === '') {
      throw new Error(`${tokenLabel}: 'name' must be a non-empty string`);
    }

    // Validate address format
    this.validateAddress(token.address, tokenLabel);

    // Validate launch timestamp
    this.validateLaunchTimestamp(token.launch_time, tokenLabel);
  }

  /**
   * Validate token address format (Ethereum 0x or Solana base58)
   * @param {string} address - Token address to validate
   * @param {string} tokenLabel - Token label for error messages
   * @throws {Error} If address format is invalid
   */
  validateAddress(address, tokenLabel) {
    if (typeof address !== 'string' || address.trim() === '') {
      throw new Error(`${tokenLabel}: 'address' must be a non-empty string`);
    }

    const trimmedAddress = address.trim();

    // Check for Ethereum address (0x followed by 40 hex characters)
    const ethereumPattern = /^0x[0-9a-fA-F]{40}$/;
    const isEthereum = ethereumPattern.test(trimmedAddress);

    // Check for Solana address (base58, typically 32-44 characters)
    // Base58 alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
    const solanaPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    const isSolana = solanaPattern.test(trimmedAddress);

    if (!isEthereum && !isSolana) {
      throw new Error(
        `${tokenLabel}: Invalid address format. ` +
        `Address must be either Ethereum format (0x followed by 40 hex characters) ` +
        `or Solana format (32-44 base58 characters)`
      );
    }
  }

  /**
   * Validate launch timestamp
   * @param {number} timestamp - Unix timestamp to validate
   * @param {string} tokenLabel - Token label for error messages
   * @throws {Error} If timestamp is invalid
   */
  validateLaunchTimestamp(timestamp, tokenLabel) {
    // Check if it's a number
    if (typeof timestamp !== 'number' || isNaN(timestamp)) {
      throw new Error(`${tokenLabel}: 'launch_time' must be a valid number`);
    }

    // Check if it's an integer
    if (!Number.isInteger(timestamp)) {
      throw new Error(`${tokenLabel}: 'launch_time' must be an integer (Unix timestamp in seconds)`);
    }

    // Check if it's positive
    if (timestamp <= 0) {
      throw new Error(`${tokenLabel}: 'launch_time' must be a positive Unix timestamp`);
    }

    // Check if it's in a reasonable range (after 2000-01-01 and before year 2100)
    const minTimestamp = 946684800; // 2000-01-01
    const maxTimestamp = 4102444800; // 2100-01-01
    
    if (timestamp < minTimestamp) {
      throw new Error(
        `${tokenLabel}: 'launch_time' is too old (before year 2000). ` +
        `Please provide a valid Unix timestamp in seconds.`
      );
    }
    
    if (timestamp > maxTimestamp) {
      throw new Error(
        `${tokenLabel}: 'launch_time' is too far in the future (after year 2100). ` +
        `Please provide a valid Unix timestamp in seconds.`
      );
    }
  }

  /**
   * Get the complete configuration object
   * @returns {Object} Configuration object
   */
  getConfig() {
    return {
      ...this.config,
      tokens: [...this.config.tokens] // Return a copy to prevent external modification
    };
  }

  /**
   * Get API key
   * @returns {string} API key
   */
  getApiKey() {
    return this.config.apiKey;
  }

  /**
   * Get tokens array
   * @returns {Array} Array of token specifications
   */
  getTokens() {
    return [...this.config.tokens]; // Return a copy
  }

  /**
   * Get output directory path
   * @returns {string} Output directory path
   */
  getOutputDirectory() {
    return this.config.outputDirectory;
  }
}

export default ConfigManager;
