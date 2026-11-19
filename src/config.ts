import "dotenv/config";

export const config = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "1d",
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  adminName: process.env.ADMIN_NAME ?? "Admin",
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
};

export function assertConfig() {
  const problems: string[] = [];
  if (!config.mongoUri) problems.push("MONGODB_URI is required");
  if (config.jwtSecret.length < 32) problems.push("JWT_SECRET must be at least 32 characters");
  if (problems.length) throw new Error(`Invalid configuration: ${problems.join("; ")}`);
}
