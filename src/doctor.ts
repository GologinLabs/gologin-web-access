import { getRecommendedCredentialStatus, loadConfig } from "./config";
import { getProfile } from "./lib/cloudApi";
import { inspectAgentCli, isDaemonReachable } from "./lib/agentCli";
import { formatDoctorChecks, printJson, printText } from "./lib/output";
import { DoctorCheck } from "./lib/types";

export async function runDoctor(options: { json?: boolean } = {}): Promise<void> {
  const config = await loadConfig();
  const checks: DoctorCheck[] = [];
  const daemonReachable = await isDaemonReachable(config.daemonPort);
  const agentCli = await inspectAgentCli();
  const recommended = getRecommendedCredentialStatus(config);

  checks.push({
    name: "Web Unlocker API key",
    status: config.webUnlockerApiKey ? "ok" : "warn",
    detail: config.webUnlockerApiKey ? `configured via ${config.sources.webUnlockerApiKey}` : "missing",
  });

  checks.push({
    name: "Cloud Browser token",
    status: config.cloudToken ? "ok" : "warn",
    detail: config.cloudToken ? `configured via ${config.sources.cloudToken}` : "missing",
  });

  checks.push({
    name: "Recommended full setup",
    status: recommended.ready ? "ok" : "warn",
    detail: recommended.ready
      ? "both GOLOGIN_WEB_UNLOCKER_API_KEY and GOLOGIN_CLOUD_TOKEN are configured"
      : `missing ${recommended.missing.join(" and ")}`,
  });

  checks.push({
    name: "Embedded browser runtime",
    status: agentCli ? "ok" : "error",
    detail: agentCli
      ? `${agentCli.source}${agentCli.version ? ` v${agentCli.version}` : ""} at ${agentCli.cwd}`
      : "missing embedded Cloud Browser runtime inside this gologin-web-access install",
  });

  if (!config.defaultProfileId) {
    checks.push({
      name: "Default profile",
      status: "warn",
      detail: "missing",
    });
  } else if (!config.cloudToken) {
    checks.push({
      name: "Default profile",
      status: "warn",
      detail: `${config.defaultProfileId} configured, but Cloud Browser token is missing so existence could not be verified`,
    });
  } else {
    try {
      const profile = await getProfile(config.defaultProfileId, config.cloudToken);
      checks.push({
        name: "Default profile",
        status: profile ? "ok" : "error",
        detail: profile ? `${profile.id}${profile.name ? ` (${profile.name})` : ""}` : `${config.defaultProfileId} not found`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "profile lookup failed";
      checks.push({
        name: "Default profile",
        status: "error",
        detail: message,
      });
    }
  }

  checks.push({
    name: "Daemon",
    status: daemonReachable ? "ok" : "warn",
    detail: daemonReachable
      ? `running on 127.0.0.1:${config.daemonPort}`
      : `not running on 127.0.0.1:${config.daemonPort}`,
  });

  if (options.json) {
    printJson({
      configPath: config.configPath,
      agentCli,
      checks,
    });
    return;
  }

  printText(formatDoctorChecks(checks));
}
