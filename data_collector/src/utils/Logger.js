/**
 * Logger - Utility module for context-aware logging
 * 
 * Responsibilities:
 * - Implement log levels (ERROR, WARN, INFO, DEBUG)
 * - Format timestamps consistently
 * - Provide context-aware logging (token name, address, API endpoint)
 * - Support structured logging with metadata
 */
class Logger {
  constructor() {
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
    
    // Default log level is INFO
    this.currentLevel = this.levels.INFO;
    
    // Context storage for enriching log messages
    this.context = {};
  }

  /**
   * Set the current log level
   * @param {string} level - Log level (ERROR, WARN, INFO, DEBUG)
   */
  setLevel(level) {
    const upperLevel = level.toUpperCase();
    if (this.levels[upperLevel] !== undefined) {
      this.currentLevel = this.levels[upperLevel];
    } else {
      throw new Error(`Invalid log level: ${level}. Valid levels: ERROR, WARN, INFO, DEBUG`);
    }
  }

  /**
   * Get the current log level name
   * @returns {string} Current log level name
   */
  getLevel() {
    return Object.keys(this.levels).find(key => this.levels[key] === this.currentLevel);
  }

  /**
   * Set context for enriching log messages
   * @param {Object} context - Context object (e.g., { tokenName, tokenAddress, apiEndpoint })
   */
  setContext(context) {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear specific context keys or all context
   * @param {string|Array<string>} keys - Optional key(s) to clear. If not provided, clears all context
   */
  clearContext(keys = null) {
    if (keys === null) {
      this.context = {};
    } else if (typeof keys === 'string') {
      delete this.context[keys];
    } else if (Array.isArray(keys)) {
      keys.forEach(key => delete this.context[key]);
    }
  }

  /**
   * Get current context
   * @returns {Object} Current context object
   */
  getContext() {
    return { ...this.context };
  }

  /**
   * Format timestamp in ISO 8601 format with local timezone
   * @returns {string} Formatted timestamp
   */
  formatTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Build context string from current context
   * @returns {string} Formatted context string
   */
  buildContextString() {
    const parts = [];
    
    if (this.context.tokenName) {
      parts.push(`token=${this.context.tokenName}`);
    }
    
    if (this.context.tokenAddress) {
      // Show first 8 characters of address for brevity
      const shortAddress = this.context.tokenAddress.substring(0, 8);
      parts.push(`address=${shortAddress}...`);
    }
    
    if (this.context.apiEndpoint) {
      parts.push(`endpoint=${this.context.apiEndpoint}`);
    }
    
    return parts.length > 0 ? ` [${parts.join(', ')}]` : '';
  }

  /**
   * Check if a log level should be output
   * @param {number} level - Log level to check
   * @returns {boolean} True if level should be logged
   */
  shouldLog(level) {
    return level <= this.currentLevel;
  }

  /**
   * Format and output a log message
   * @param {string} level - Log level name
   * @param {string} message - Log message
   * @param {Object} metadata - Optional metadata object
   */
  log(level, message, metadata = null) {
    const levelValue = this.levels[level];
    
    if (!this.shouldLog(levelValue)) {
      return;
    }
    
    const timestamp = this.formatTimestamp();
    const contextStr = this.buildContextString();
    const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
    
    const formattedMessage = `[${timestamp}] [${level}]${contextStr} ${message}${metadataStr}`;
    
    // Output to appropriate stream
    if (level === 'ERROR') {
      console.error(formattedMessage);
    } else if (level === 'WARN') {
      console.warn(formattedMessage);
    } else {
      console.log(formattedMessage);
    }
  }

  /**
   * Log an ERROR level message
   * @param {string} message - Error message
   * @param {Object} metadata - Optional metadata object
   */
  error(message, metadata = null) {
    this.log('ERROR', message, metadata);
  }

  /**
   * Log a WARN level message
   * @param {string} message - Warning message
   * @param {Object} metadata - Optional metadata object
   */
  warn(message, metadata = null) {
    this.log('WARN', message, metadata);
  }

  /**
   * Log an INFO level message
   * @param {string} message - Info message
   * @param {Object} metadata - Optional metadata object
   */
  info(message, metadata = null) {
    this.log('INFO', message, metadata);
  }

  /**
   * Log a DEBUG level message
   * @param {string} message - Debug message
   * @param {Object} metadata - Optional metadata object
   */
  debug(message, metadata = null) {
    this.log('DEBUG', message, metadata);
  }
}

// Export singleton instance
const logger = new Logger();

export default logger;
export { Logger };
