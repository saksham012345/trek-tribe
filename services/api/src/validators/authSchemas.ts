import { z } from 'zod';

export const sendPhoneOtpSchema = z.object({
    phone: z.string().regex(/^[+]?[1-9]\d{1,14}$/)
});

export const verifyPhoneOtpSchema = z.object({
    phone: z.string().regex(/^[+]?[1-9]\d{1,14}$/),
    otp: z.string().regex(/^\d{6}$/)
});
