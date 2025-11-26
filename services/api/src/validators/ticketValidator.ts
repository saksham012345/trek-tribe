import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export const ticketCreateValidators = [
  body('subject')
    .exists().withMessage('Subject is required')
    .isString().withMessage('Subject must be a string')
    .isLength({ min: 1, max: 200 }).withMessage('Subject must be 1-200 characters'),
  body('description')
    .exists().withMessage('Description is required')
    .isString().withMessage('Description must be a string')
    .isLength({ min: 1, max: 1000 }).withMessage('Description must be 1-1000 characters')
];

export const messageValidators = [
  body('message')
    .exists().withMessage('Message is required')
    .isString().withMessage('Message must be a string')
    .isLength({ min: 1, max: 2000 }).withMessage('Message must be 1-2000 characters')
];

export function handleValidationErrors(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msg = errors.array().map(e => `${(e as any).param}: ${e.msg}`).join('; ');
    const err: any = new Error(msg);
    err.statusCode = 400;
    return next(err);
  }
  next();
}

export default { ticketCreateValidators, messageValidators, handleValidationErrors };
