#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { verifyLogbook, verifyReceipt } from "./verify.js";
import type { BidReceipt, Logbook } from "@openbod/core";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (cmd === "logbook") {
    const [path] = args;
    if (!path) return usageAndExit();
    const logbook = readJson<Logbook>(path);
    const result = verifyLogbook(logbook);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.overallValid ? 0 : 1);
  }

  if (cmd === "receipt") {
    const [receiptPath, logPath, publicKeyPath] = args;
    if (!receiptPath || !logPath || !publicKeyPath) return usageAndExit();
    const receipt = readJson<BidReceipt>(receiptPath);
    const fullLog = readJson<Logbook["log"]>(logPath);
    const publicKeyPem = readFileSync(publicKeyPath, "utf8");
    const result = verifyReceipt(receipt, fullLog, publicKeyPem);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.overallValid ? 0 : 1);
  }

  usageAndExit();
}

function usageAndExit(): never {
  console.error(
    [
      "openbod-verify: onafhankelijke verificatie, zonder de instantie te vertrouwen.",
      "",
      "  openbod-verify logbook <logboek.json>",
      "  openbod-verify receipt <ontvangstbewijs.json> <log.json> <instance-public-key.pem>",
    ].join("\n"),
  );
  process.exit(2);
}

main();
