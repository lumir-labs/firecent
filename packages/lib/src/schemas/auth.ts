import * as z from "zod";

export const LoginSchema = z.object({
  email: z.string().min(1, { message: "Username is required" }),
  password_plain: z.string().min(1, { message: "Password is required" }),
});

export const PasswordResetSchema = z.object({
  newPwd: z.string().min(6, { message: "Min 6 characters" }),
  confirmPwd: z.string(),
});
