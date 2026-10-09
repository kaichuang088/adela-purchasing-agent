declare namespace Cloudflare {
  interface Env {
    VAPID_PRIVATE_JWK?: string;
    VAPID_PUBLIC_KEY?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ADMIN_PASSWORD?: string;
    ADMIN_ORIGIN?: string;
    ADMIN_ORIGINS?: string;
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
    SHOP_PUBLIC_URL?: string;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    KK_AI_GATEWAY_URL?: string;
    KK_AI_GATEWAY_SECRET?: string;
    ASSETS?: Fetcher;
  }
}
