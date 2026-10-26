// Creates your login and the default categories.
// Usage: npm run create-user
import { createInterface } from "node:readline";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const CATEGORIES = ["Work", "Building", "Sales", "Brand", "Learning", "Practice", "Career", "Health", "Personal"];

function ask(question, { hidden = false } = {}) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    rl._writeToOutput = (s) => rl.output.write(s.startsWith(question) ? s : "");
  }
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    }),
  );
}

const sql = neon(process.env.DATABASE_URL);
const email = (await ask("Email: ")).toLowerCase();
const password = await ask("Password (min 8 chars): ", { hidden: true });
if (!email || password.length < 8) {
  console.error("Need an email and a password of at least 8 characters.");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
const [user] = await sql`
  insert into users (email, password_hash) values (${email}, ${hash})
  on conflict (email) do update set password_hash = excluded.password_hash
  returning id
`;
await sql`
  insert into categories (user_id, name, position)
  select ${user.id}, name, ord::smallint - 1 from unnest(${CATEGORIES}::text[]) with ordinality as t(name, ord)
  on conflict (user_id, name) do nothing
`;
console.log(`Ready. Sign in as ${email}.`);
