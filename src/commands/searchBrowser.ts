import { Command } from "commander";
import { addProfileOption, addSessionOption, runOpenLikeCommand } from "./shared";

export function buildSearchBrowserCommand(): Command {
  const command = new Command("search-browser")
    .description("Open a Google search results page inside Gologin Cloud Browser.")
    .argument("<query>", "Search query")
    .option("--country <country>", "Country code for Google search", "us")
    .option("--language <language>", "Language for Google search", "en")
    .option("--idle-timeout-ms <ms>", "Idle timeout for the browser session")
    .option("--proxy-country <country>", "Request a country-based proxy when supported")
    .option("--proxy-mode <mode>", "Custom proxy mode: http, socks4, or socks5")
    .option("--proxy-host <host>", "Custom proxy host")
    .option("--proxy-port <port>", "Custom proxy port")
    .option("--proxy-user <username>", "Custom proxy username")
    .option("--proxy-pass <password>", "Custom proxy password")
    .action(
      async (
        query: string,
        options: {
          country: string;
          language: string;
          profile?: string;
          session?: string;
          idleTimeoutMs?: string;
          proxyCountry?: string;
          proxyMode?: string;
          proxyHost?: string;
          proxyPort?: string;
          proxyUser?: string;
          proxyPass?: string;
        },
      ) => {
        const url = new URL("https://www.google.com/search");
        url.searchParams.set("q", query);
        url.searchParams.set("hl", options.language);
        url.searchParams.set("gl", options.country.toLowerCase());

        await runOpenLikeCommand(url.toString(), options);
      },
    );

  addProfileOption(command);
  return addSessionOption(command);
}
