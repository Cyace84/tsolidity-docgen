import { makeBuild } from './ast-builder';
import { defaults, Config } from './config';

export { main as docgen } from './main';
export { docItemTypes } from './doc-item';
export { DocItemWithContext } from './site';

export async function defaultDocgen(userConfig: Config = defaults) {
  const { main } = await import('./main');
  const config = { ...defaults, ...userConfig };
  await main([await makeBuild(config)], config);
}

// We ask Node.js not to cache this file.
delete require.cache[__filename];
