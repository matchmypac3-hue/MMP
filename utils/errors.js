// utils/errors.js

class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
      this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
      this.isOperational = true;
  
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  class ValidationError extends AppError {
    constructor(message = 'Erreur de validation') {
      super(message, 400);
    }
  }
  
  class UnauthorizedError extends AppError {
    constructor(message = 'Non autorisé') {
      super(message, 401);
    }
  }
  
  class ForbiddenError extends AppError {
    constructor(message = 'Accès interdit') {
      super(message, 403);
    }
  }
  
  class NotFoundError extends AppError {
    constructor(message = 'Ressource non trouvée') {
      super(message, 404);
    }
  }
  
  module.exports = {
    AppError,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError
  };