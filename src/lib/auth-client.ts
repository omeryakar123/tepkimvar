import { createAuthClient } from "better-auth/react";
import { emailOTPClient, inferAdditionalFields } from "better-auth/client/plugins";
import type { Auth } from "@/lib/auth";

// baseURL verilmezse mevcut origin kullanılır (aynı origin'de /api/auth altında).
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL || undefined,
  plugins: [emailOTPClient(), inferAdditionalFields<Auth>()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
