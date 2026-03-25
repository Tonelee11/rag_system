import readline from "readline";
import * as dotenv from "dotenv";
import { ask } from "../agent.js"; 

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function run() {
  console.log("\n========================================");
  console.log("   TANZLITE AGENT — ZARA (with memory)");
  console.log("========================================");
  console.log("  Type 'exit' to quit | 'reset' to clear history");
  console.log("========================================\n");

  console.log("Zara: Hi! I'm Zara from Tanzlite Digital. How can I help you today?\n");

  // Conversation history — grows with each turn
  let history = [];

  while (true) {
    const userInput = await prompt("You: ");

    if (!userInput.trim()) continue;

    if (userInput.toLowerCase() === "exit") {
      console.log("\nZara: Thanks for chatting! Have a great day.");
      rl.close();
      break;
    }

    if (userInput.toLowerCase() === "reset") {
      history = [];
      console.log("Zara: Sure! Let's start fresh. How can I help you?\n");
      continue;
    }

    process.stdout.write("Zara: thinking...");

    try {
      const result = await ask(userInput, history);

      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      console.log(`Zara: ${result.answer}\n`);

      // Add this turn to history for next question
      history.push({ role: "user", content: userInput });
      history.push({ role: "assistant", content: result.answer });

      // Keep history to last 10 turns to avoid token bloat
      if (history.length > 20) {
        history = history.slice(history.length - 20);
      }

      if (process.env.DEBUG === "true") {
        console.log("  Sources:");
        result.sources.forEach((s) => {
          console.log(`    [${s.score.toFixed(2)}] ${s.title} — ${s.url}`);
        });
        console.log();
      }
    } catch (err) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      console.error(`Zara: Sorry, something went wrong. (${err.message})\n`);
    }
  }
}

run();