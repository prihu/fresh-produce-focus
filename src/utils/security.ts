
// Security utilities for input validation and sanitization
export const SecurityUtils = {
  // Sanitize string input to prevent XSS
  sanitizeString: (input: string): string => {
    if (!input) return '';
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  },

  // Validate order number format
  validateOrderNumber: (orderNumber: string): { isValid: boolean; error?: string } => {
    if (!orderNumber || orderNumber.trim() === '') {
      return { isValid: false, error: 'Order number is required' };
    }
    
    const trimmed = orderNumber.trim();
    if (trimmed.length < 3 || trimmed.length > 50) {
      return { isValid: false, error: 'Order number must be between 3 and 50 characters' };
    }
    
    if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
      return { isValid: false, error: 'Order number can only contain letters, numbers, hyphens, and underscores' };
    }
    
    return { isValid: true };
  },

  // Validate file upload
  validateFileUpload: (file: File): { isValid: boolean; error?: string } => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 15 * 1024 * 1024; // 15MB
    
    if (!allowedTypes.includes(file.type)) {
      return { 
        isValid: false, 
        error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.' 
      };
    }
    
    if (file.size > maxSize) {
      return { 
        isValid: false, 
        error: 'File size too large. Maximum size is 15MB.' 
      };
    }
    
    return { isValid: true };
  },

  // Safe error message formatting
  formatSafeErrorMessage: (error: unknown): string => {
    if (typeof error === 'string') {
      return error;
    }
    
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message: string }).message;
      
      // Filter out sensitive database errors
      if (message.includes('pgjwt') || message.includes('auth.uid()') || message.includes('RLS')) {
        return 'Access denied. Please check your permissions.';
      }
      
      if (message.includes('violates row-level security')) {
        return 'You do not have permission to perform this action.';
      }
      
      if (message.includes('duplicate key')) {
        return 'This item already exists.';
      }
      
      return message;
    }
    
    return 'An unexpected error occurred. Please try again.';
  }
};
