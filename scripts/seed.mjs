// implement the code 
import nextEnv from "@next/env";
import { MongoClient } from "mongodb";
import bcrypt from "bcrypt";

nextEnv.loadEnvConfig(process.cwd());

const testUsers = [
  {
    username: "teacher1",
    email: "teacher1@example.com",
    password: "Teacher1!Exam",
    role: "Teacher",
  },
  {
    username: "teacher2",
    email: "teacher2@example.com",
    password: "Teacher2!Exam",
    role: "Teacher",
  },
  {
    username: "teacher3",
    email: "teacher3@example.com",
    password: "Teacher3!Exam",
    role: "Teacher",
  },
  {
    username: "student1",
    email: "student1@example.com",
    password: "Student1!Exam",
    role: "Student",
  },
  {
    username: "student2",
    email: "student2@example.com",
    password: "Student2!Exam",
    role: "Student",
  },
  {
    username: "student3",
    email: "student3@example.com",
    password: "Student3!Exam",
    role: "Student",
  },
];

async function seed() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from .env.local");
  }

  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();

    const db = client.db(process.env.MONGODB_DB || "wad_final");
    const users = db.collection("users");

    await users.createIndex({ username: 1 }, { unique: true });
    await users.createIndex({ email: 1 }, { unique: true });

    for (const user of testUsers) {
      const passwordHash = await bcrypt.hash(user.password, 12);
      const now = new Date();

      await users.updateOne(
        { email: user.email },
        {
          $set: {
            username: user.username,
            email: user.email,
            passwordHash,
            role: user.role,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true },
      );

      console.log(`Ready: ${user.username} (${user.role})`);
    }

    console.log("All six test users are ready.");
  } finally {
    await client.close();
  }
}

seed().catch((error) => {
  console.error("Seeding failed:", error.message);
  process.exitCode = 1;
});