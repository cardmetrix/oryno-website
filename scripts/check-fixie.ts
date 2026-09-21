import "dotenv/config";
import {
  DEFAULT_FIXIE_OUTBOUND_IP,
  flutterwaveHttp,
  flutterwavePinnedProxyIp,
  flutterwaveProxyUrl,
  hasFlutterwaveProxy,
} from "../lib/flutterwave/http";

async function main() {
  const url = flutterwaveProxyUrl();
  console.log(
    JSON.stringify(
      {
        hasProxy: hasFlutterwaveProxy(),
        pinned: flutterwavePinnedProxyIp() || DEFAULT_FIXIE_OUTBOUND_IP,
        host: url
          ? (() => {
              try {
                return new URL(url).host;
              } catch {
                return null;
              }
            })()
          : null,
      },
      null,
      2,
    ),
  );

  if (!url) {
    console.error("No FIXIE_URL / FLUTTERWAVE_HTTPS_PROXY configured.");
    process.exitCode = 1;
    return;
  }

  try {
    // Cheap HTTP probe — Fixie returns a clear quota body on this endpoint.
    const res = await flutterwaveHttp("http://welcome.usefixie.com/");
    const body = (await res.text()).trim();
    console.log("welcome", res.status, body.slice(0, 200));
    if (/quota exceeded/i.test(body) || res.status === 407) {
      console.error(
        "Fixie monthly request quota exceeded. Upgrade the Fixie plan before withdrawals can work.",
      );
      process.exitCode = 1;
      return;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("welcome_error", msg);
    if (/quota exceeded/i.test(msg) || /407/.test(msg)) {
      console.error(
        "Fixie monthly request quota exceeded. Upgrade the Fixie plan before withdrawals can work.",
      );
    }
    process.exitCode = 1;
    return;
  }

  try {
    const res = await flutterwaveHttp("https://api.ipify.org?format=json");
    console.log("egress", res.status, await res.text());
  } catch (e) {
    console.error("egress_error", e instanceof Error ? e.message : e);
      process.exitCode = 1;
  }
}

main();
