import { AuthPayload } from '../middleware/auth';

declare global {
    namespace Express {
        interface Request {
            user?: AuthPayload;
            auth?: AuthPayload;
            cookies?: Record<string, string>;
        }
    }
}
