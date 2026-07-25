import { existsSync } from "fs";
import path from "path";

const SCREENSHOT_DIR = path.join(process.cwd(), "public", "screenshots");

/** Returns a public URL if the screenshot file exists, otherwise undefined. */
export function screenshotSrc(fileName: string): string | undefined {
  const filePath = path.join(SCREENSHOT_DIR, fileName);
  return existsSync(filePath) ? `/screenshots/${fileName}` : undefined;
}
