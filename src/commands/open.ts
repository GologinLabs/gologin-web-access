import { Command } from "commander";
import { addProfileOption, addSessionOption, runOpenLikeCommand } from "./shared";

export function buildOpenCommand(): Command {
  const command = new Command("open")
    .description("Open a URL in Gologin Cloud Browser and create a daemon-backed session.")
    .argument("<url>", "URL to open")
    .option("--idle-timeout-ms <ms>", "Idle timeout for the browser session")
    .option("--proxy-country <country>", "Request a country-based proxy when supported")
    .option("--proxy-mode <mode>", "Custom proxy mode: http, socks4, or socks5")
    .option("--proxy-host <host>", "Custom proxy host")
    .option("--proxy-port <port>", "Custom proxy port")
    .option("--proxy-user <username>", "Custom proxy username")
    .option("--proxy-pass <password>", "Custom proxy password")
    .action(async (url: string, options: Record<string, string | undefined>) => {
      await runOpenLikeCommand(url, options);
    });

  addProfileOption(command);
  return addSessionOption(command);
}
