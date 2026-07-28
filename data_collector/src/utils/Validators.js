/**
 * Validators - Utility module for data validation
 * 
 * Responsibilities:
 * - Validate OHLCV records (required fields, price consistency)
 * - Validate transaction records (required fields)
 * - Validate filesystem-safe names
 */

/**
 * Validate OHLCV record structure and data consistency
 * @param {Object} record - OHLCV record to validate
 * @returns {Object} Validation result { valid: boolean, errors: Array<string> }
 */
export function validateOHLCVRecord(record) {
  const errors = [];

  // Check if record is an object
  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['OHLCV record must be an object'] };
  }

  // Check required fields exist
  const requiredFields = ['timestamp', 'open', 'high', 'low', 'close', 'volume'];
  for (const field of requiredFields) {
    if (record[field] === undefined || record[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // If required fields are missing, return early
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Validate timestamp
  if (typeof record.timestamp !== 'number' || !Number.isInteger(record.timestamp)) {
    errors.push('timestamp must be an integer');
  } else if (record.timestamp <= 0) {
    errors.push('timestamp must be positive');
  }

  // Validate price fields are numbers
  const priceFields = ['open', 'high', 'low', 'close'];
  for (const field of priceFields) {
    if (typeof record[field] !== 'number' || isNaN(record[field])) {
      errors.push(`${field} must be a valid number`);
    } else if (record[field] < 0) {
      errors.push(`${field} must be non-negative`);
    }
  }

  // Validate volume
  if (typeof record.volume !== 'number' || isNaN(record.volume)) {
    errors.push('volume must be a valid number');
  } else if (record.volume < 0) {
    errors.push('volume must be non-negative');
  }

  // If basic type validation failed, return early
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Validate price consistency (high >= low, high >= open, high >= close, low <= open, low <= close)
  if (record.high < record.low) {
    errors.push('high price must be greater than or equal to low price');
  }
  if (record.high < record.open) {
    errors.push('high price must be greater than or equal to open price');
  }
  if (record.high < record.close) {
    errors.push('high price must be greater than or equal to close price');
  }
  if (record.low > record.open) {
    errors.push('low price must be less than or equal to open price');
  }
  if (record.low > record.close) {
    errors.push('low price must be less than or equal to close price');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate transaction record structure
 * @param {Object} record - Transaction record to validate
 * @returns {Object} Validation result { valid: boolean, errors: Array<string> }
 */
export function validateTransaction(record) {
  const errors = [];

  // Check if record is an object
  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['Transaction record must be an object'] };
  }

  // Check required fields exist
  const requiredFields = ['txHash', 'blockTime', 'from', 'to', 'amount'];
  for (const field of requiredFields) {
    if (record[field] === undefined || record[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // If required fields are missing, return early
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Validate txHash
  if (typeof record.txHash !== 'string' || record.txHash.trim() === '') {
    errors.push('txHash must be a non-empty string');
  }

  // Validate blockTime (timestamp)
  if (typeof record.blockTime !== 'number' || !Number.isInteger(record.blockTime)) {
    errors.push('blockTime must be an integer');
  } else if (record.blockTime <= 0) {
    errors.push('blockTime must be positive');
  }

  // Validate from address
  if (typeof record.from !== 'string' || record.from.trim() === '') {
    errors.push('from address must be a non-empty string');
  }

  // Validate to address
  if (typeof record.to !== 'string' || record.to.trim() === '') {
    errors.push('to address must be a non-empty string');
  }

  // Validate amount
  if (typeof record.amount !== 'number' || isNaN(record.amount)) {
    errors.push('amount must be a valid number');
  } else if (record.amount < 0) {
    errors.push('amount must be non-negative');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate and sanitize a name for filesystem safety
 * @param {string} name - Name to validate
 * @returns {Object} Validation result { valid: boolean, sanitized: string, errors: Array<string> }
 */
export function validateFilesystemSafeName(name) {
  const errors = [];

  // Check if name is a string
  if (typeof name !== 'string') {
    return { 
      valid: false, 
      sanitized: '', 
      errors: ['Name must be a string'] 
    };
  }

  // Check if name is empty or whitespace-only
  if (name.trim() === '') {
    return { 
      valid: false, 
      sanitized: '', 
      errors: ['Name cannot be empty'] 
    };
  }

  // Check if name ends with a period or space BEFORE trimming (not allowed on Windows)
  if (name.endsWith('.') || name.endsWith(' ')) {
    errors.push('Name cannot end with a period or space');
  }

  // Trim the name for further processing
  const trimmedName = name.trim();

  // Define forbidden characters for filesystem safety
  // Forbidden: / \ : * ? " < > |
  const forbiddenChars = /[\/\\:*?"<>|]/g;
  const hasForbiddenChars = forbiddenChars.test(trimmedName);

  // Create sanitized version by replacing forbidden characters with underscore
  const sanitized = trimmedName.replace(forbiddenChars, '_');

  // Check for reserved names on Windows
  const reservedNames = [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
  ];
  
  const upperName = sanitized.toUpperCase();
  const isReserved = reservedNames.includes(upperName) || 
                     reservedNames.some(reserved => upperName.startsWith(reserved + '.'));

  if (isReserved) {
    errors.push(`Name "${sanitized}" is a reserved system name`);
  }

  // Add warning if forbidden characters were found
  if (hasForbiddenChars) {
    errors.push(`Name contains forbidden characters (/ \\ : * ? " < > |), sanitized to: ${sanitized}`);
  }

  return {
    valid: errors.length === 0,
    sanitized,
    errors
  };
}

/**
 * Batch validate multiple OHLCV records
 * @param {Array} records - Array of OHLCV records to validate
 * @returns {Object} Validation summary { validCount: number, invalidCount: number, invalidRecords: Array }
 */
export function validateOHLCVBatch(records) {
  if (!Array.isArray(records)) {
    throw new Error('Records must be an array');
  }

  const invalidRecords = [];
  let validCount = 0;

  records.forEach((record, index) => {
    const result = validateOHLCVRecord(record);
    if (result.valid) {
      validCount++;
    } else {
      invalidRecords.push({
        index,
        record,
        errors: result.errors
      });
    }
  });

  return {
    validCount,
    invalidCount: invalidRecords.length,
    invalidRecords
  };
}

/**
 * Batch validate multiple transaction records
 * @param {Array} records - Array of transaction records to validate
 * @returns {Object} Validation summary { validCount: number, invalidCount: number, invalidRecords: Array }
 */
export function validateTransactionBatch(records) {
  if (!Array.isArray(records)) {
    throw new Error('Records must be an array');
  }

  const invalidRecords = [];
  let validCount = 0;

  records.forEach((record, index) => {
    const result = validateTransaction(record);
    if (result.valid) {
      validCount++;
    } else {
      invalidRecords.push({
        index,
        record,
        errors: result.errors
      });
    }
  });

  return {
    validCount,
    invalidCount: invalidRecords.length,
    invalidRecords
  };
}

export default {
  validateOHLCVRecord,
  validateTransaction,
  validateFilesystemSafeName,
  validateOHLCVBatch,
  validateTransactionBatch
};
