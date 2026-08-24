/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS: Fetcher;
}
