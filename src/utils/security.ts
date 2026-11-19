import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "../config.js";

const BCRYPT_COST = 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, BCRYPT_COST);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

// Used so a login for an unknown email takes as long as one for a known email.
export const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_COST);

export function signToken(user: { _id: unknown; role: string }) {
  return jwt.sign({ role: user.role }, config.jwtSecret, {
    subject: String(user._id),
    algorithm: "HS256",
    expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): { sub: string } {
  const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
  if (typeof payload === "string" || !payload.sub) throw new Error("Bad token");
  return { sub: payload.sub };
}
