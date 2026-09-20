import { runIndexNowNotification } from '../../scripts/indexnow.mjs';

export const onSuccess = async ({ constants }) => {
  const result = await runIndexNowNotification({
    cwd: process.cwd(),
    distDir: constants.PUBLISH_DIR,
    env: process.env,
    isLocal: constants.IS_LOCAL,
    fetchImpl: globalThis.fetch,
    log: console
  });

  if (result.kind === 'skipped') {
    console.log(`IndexNow: ${result.reason}`);
    return;
  }

  if (result.kind === 'submitted') {
    console.log(`IndexNow: submission accepted with HTTP ${result.status}; ${result.urlCount} production canonical URL(s) notified`);
    return;
  }

  console.error(`IndexNow: submission failed after deploy success; ${result.error}`);
};
