//src/app/api/auth/login/route.js

/**
 * Your login APIs go here
 */

// implement from here
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getDb } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import {
  errorResponse,
  successResponse,
  printExceptionLog,
} from "@/lib/utils";

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request) {
  const allowedOrigin =
    process.env.FRONTEND_ORIGIN || "http://localhost:5173";

  const origin = request.headers.get("origin");

  if (origin && origin !== allowedOrigin) {
    return errorResponse("Origin not allowed", 403);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  if (
    !body ||
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    !body.email.trim() ||
    !body.password
  ) {
    return errorResponse("Email and password are required", 400);
  }

  const email = body.email.trim().toLowerCase();
  const password = body.password;

  try {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET is missing");
    }

    const db = await getDb();
    const user = await db.collection("users").findOne({ email });

    if (!user) {
      return errorResponse("Invalid email or password", 401);
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      return errorResponse("Invalid email or password", 401);
    }

    if (!["Teacher", "Student"].includes(user.role)) {
      return errorResponse("Account role is not permitted", 403);
    }

    const token = jwt.sign(
      { id: user._id.toString() },
      secret,
      {
        algorithm: "HS256",
        expiresIn: "8h",
      },
    );

    const response = successResponse(
      {
        message: "Login successful",
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
        },
      },
      200,
    );

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (error) {
    printExceptionLog("Login", error);
    return errorResponse("Internal server error", 500);
  }
}