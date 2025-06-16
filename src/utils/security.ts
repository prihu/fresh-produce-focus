
/**
 * Security utilities for input validation and sanitization
 */

export class SecurityUtils {
  
  /**
   * Validates file uploads for security
   */
  static validateFileUpload(file: File): { isValid: boolean; error?: string } {
    // Check file size (15MB max)
    const maxSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) {
      return { isValid: false, error: 'File size must be less than 15MB' };
    }

    // Check MIME type - only allow images
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return { isValid: false, error: 'Only image files are allowed (JPEG, PNG, WebP, GIF)' };
    }

    // Check file extension
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!allowedExtensions.includes(fileExtension)) {
      return { isValid: false, error: 'Invalid file extension. Only image files are allowed.' };
    }

    // Basic filename validation
    if (!this.validateFileName(file.name)) {
      return { isValid: false, error: 'Invalid filename. Use only letters, numbers, and basic punctuation.' };
    }

    return { isValid: true };
  }

  /**
   * Validates filename for security
   */
  static validateFileName(filename: string): boolean {
    // Allow alphanumeric, dots, hyphens, underscores, spaces
    // Prevent path traversal and special characters
    const validPattern = /^[a-zA-Z0-9._\-\s]+$/;
    const hasValidExtension = /\.(jpg|jpeg|png|webp|gif)$/i.test(filename);
    const noPathTraversal = !filename.includes('..') && !filename.includes('/') && !filename.includes('\\');
    
    return validPattern.test(filename) && hasValidExtension && noPathTraversal && filename.length <= 255;
  }

  /**
   * Validates order number format
   */
  static validateOrderNumber(orderNumber: string): boolean {
    // Order numbers should be 3-50 characters, alphanumeric with dashes/underscores
    const pattern = /^[A-Za-z0-9_-]{3,50}$/;
    return pattern.test(orderNumber);
  }

  /**
   * Sanitizes string input to prevent XSS
   */
  static sanitizeString(input: string): string {
    return input
      .replace(/[<>'"&]/g, (char) => {
        const entities: { [key: string]: string } = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;'
        };
        return entities[char] || char;
      })
      .trim();
  }

  /**
   * Validates UUID format
   */
  static isValidUUID(uuid: string): boolean {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidPattern.test(uuid);
  }

  /**
   * Formats error messages safely for user display
   */
  static formatSafeErrorMessage(error: any): string {
    if (!error) return 'An unknown error occurred';
    
    // Handle string errors
    if (typeof error === 'string') {
      return this.sanitizeString(error);
    }
    
    // Handle error objects
    if (error.message) {
      // Remove sensitive info from common error types
      let message = error.message;
      
      // Generic database errors
      if (message.includes('duplicate key value violates unique constraint')) {
        return 'This item already exists';
      }
      
      if (message.includes('foreign key constraint')) {
        return 'Unable to complete operation due to data dependencies';
      }
      
      if (message.includes('not found')) {
        return 'Requested item not found';
      }
      
      if (message.includes('permission denied') || message.includes('access denied')) {
        return 'You do not have permission to perform this action';
      }
      
      // Generic network errors
      if (message.includes('fetch') || message.includes('network')) {
        return 'Network error. Please check your connection and try again.';
      }
      
      return this.sanitizeString(message);
    }
    
    return 'An unexpected error occurred. Please try again.';
  }

  /**
   * Rate limiting helper for client-side operations
   */
  static createRateLimiter(maxCalls: number, windowMs: number) {
    const calls: number[] = [];
    
    return {
      canMakeCall(): boolean {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        // Remove old calls outside the window
        while (calls.length > 0 && calls[0] < windowStart) {
          calls.shift();
        }
        
        // Check if we're within limits
        if (calls.length < maxCalls) {
          calls.push(now);
          return true;
        }
        
        return false;
      },
      
      getRemainingCalls(): number {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        // Remove old calls outside the window
        while (calls.length > 0 && calls[0] < windowStart) {
          calls.shift();
        }
        
        return Math.max(0, maxCalls - calls.length);
      }
    };
  }
}
