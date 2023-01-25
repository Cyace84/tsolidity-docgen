import fs from 'fs';
import { execSync } from 'child_process';
import { Config } from '../config';
import { getAstsFromSources, getContractsList } from './getters';
import path from 'path';

/**
 * It takes the config object, gets a list of contracts, and then compiles the AST for each contract
 * @param {Config} config - The configuration object that we created earlier.
 */
export const compileAst = async (config: Config) => {
  const contracts = getContractsList(config.sourcesDir!);

  if (fs.existsSync(config.astOutputDir!)) {
    fs.rm(path.resolve(config.root!, config.astOutputDir!), () => {});
  }

  contracts.forEach(contract => {
    execSync(
      `${config.compilerPath} --ast-compact-json $PWD/${config.sourcesDir}/${contract} --output-dir=$PWD/${config.astOutputDir}`,
    );
  });
  compileExternalAst(config);
};

/**
 * It compiles all the external sources in the project, and saves the ASTs in the `astOutputDir`
 * directory
 * @param {Config} config - Config
 */
export const compileExternalAst = async (config: Config) => {
  const { fullSources } = getAstsFromSources(
    config.astOutputDir!,
    config.root!,
  );

  Object.values(fullSources).forEach(source => {
    for (const ast of source.asts) {
      const absolutePath = ast.absolutePath;
      if (!absolutePath.startsWith(config.sourcesDir!)) {
        execSync(
          `${config.compilerPath} --ast-compact-json $PWD/${absolutePath} --output-dir=$PWD/${config.astOutputDir}`,
        );
      }
    }
  });
};
