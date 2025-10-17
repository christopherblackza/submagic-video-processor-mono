import { HttpException, HttpStatus } from '@nestjs/common';

export class SubmagicApiException extends HttpException {
  constructor(message: string, status: HttpStatus, public readonly errorCode?: string) {
    super(message, status);
  }
}

export class InsufficientCreditsException extends SubmagicApiException {
  constructor(message: string = 'Insufficient API credits') {
    super(message, HttpStatus.PAYMENT_REQUIRED, 'INSUFFICIENT_CREDITS');
  }
}

export class InvalidRequestException extends SubmagicApiException {
  constructor(message: string = 'Invalid request parameters') {
    super(message, HttpStatus.BAD_REQUEST, 'INVALID_REQUEST');
  }
}

export class UnauthorizedException extends SubmagicApiException {
  constructor(message: string = 'Unauthorized access to Submagic API') {
    super(message, HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED');
  }
}

export class RateLimitExceededException extends SubmagicApiException {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMIT_EXCEEDED');
  }
}

export class SubmagicServerException extends SubmagicApiException {
  constructor(message: string = 'Submagic API server error') {
    super(message, HttpStatus.BAD_GATEWAY, 'SUBMAGIC_SERVER_ERROR');
  }
}