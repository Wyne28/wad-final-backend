import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";

export function verifyJWT(req) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is missing");
  }

  const token = req.cookies.get("token")?.value;

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
    });

    if (
      typeof decoded !== "object" ||
      typeof decoded.id !== "string" ||
      !/^[a-fA-F0-9]{24}$/.test(decoded.id)
    ) {
      return null;
    }

    return decoded;
  } catch {
    // Invalid or expired token.
    return null;
  }
}

export async function getAuthenticatedUser(req) {
  const decoded = verifyJWT(req);

  if (!decoded) {
    return null;
  }

  const db = await getDb();

  const user = await db.collection("users").findOne(
    { _id: new ObjectId(decoded.id) },
    {
      projection: {
        _id: 1,
        username: 1,
        email: 1,
        role: 1,
      },
    },
  );

  return user;
}