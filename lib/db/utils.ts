import { generateId } from "ai";
import { genSaltSync, hashSync } from "bcrypt-ts";

export function generateHashedPassword(password: string) {
  const BCRYPT_COST = 12;
  const salt = genSaltSync(BCRYPT_COST);
  const hash = hashSync(password, salt);

  return hash;
}

export function generateDummyPassword() {
  const password = generateId();
  const hashedPassword = generateHashedPassword(password);

  return hashedPassword;
}
