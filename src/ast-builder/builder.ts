import fs from 'fs';
import { SolcInput, SolcOutput } from 'solidity-ast/solc';
import { Sources } from './types';
import { getContractName, getAstsFromSources } from './getters';
import {
  replaceSrc,
  sortASTByDependency,
  updateDependices,
} from './ast-updater';
import { Config } from '../config';
import { Build } from '../site';
import path from 'path';

import { compileAst } from './compile-ast';

const createRawOutput = (sources: Sources) => {
  const output: SolcOutput = { sources: {} };
  let id = 0;
  for (const key of Object.keys(sources)) {
    const source = sources[key]!;
    replaceSrc(source, id);
    output.sources[key] = { ast: source, id: id++ };
  }
  return output;
};

const createInput = (solcOutput: SolcOutput) => {
  const sources = solcOutput.sources;
  const SolcInput: SolcInput = { sources: {} };
  for (const key of Object.keys(sources)) {
    const fileContent = fs.readFileSync(key, 'utf8').toString();
    SolcInput.sources[key] = { content: fileContent };
  }
  return SolcInput;
};

export function isMainContract(absolutePath: string, astPath: string) {
  // Extract the contract name from absolute path
  if (!fileExists(absolutePath) || !fileExists(astPath)) {
    throw new Error('File does not exist');
  }
  const contractName = getContractName(absolutePath);

  // Extract the contract name from ast path
  const astContractName = getContractName(astPath);

  // Compare contract names
  return contractName === astContractName;
}

function fileExists(filePath: string) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return false;
    } else {
      throw err;
    }
  }
}

export const makeBuild = async (
  config: Config,
  contractList: string[] = [],
) => {
  compileAst(config);
  const { sources: astSources, fullSources } = getAstsFromSources(
    config.astOutputDir!,
    config.root!,
  )!;
  const solcOutput = createRawOutput(astSources);
  const sourcesList = Object.values(fullSources).map(source => source.asts);

  const sortedSources = sortASTByDependency(sourcesList, solcOutput);
  updateDependices(fullSources, sortedSources, config);
  const ph = path.join(config.root!, config.sourcesDir!, 'build/astBuild.json');
  fs.writeFileSync(ph, JSON.stringify(sortedSources, null, 2));
  solcOutput.sources = sortedSources;
  const solcInput = createInput(solcOutput);
  const build: Build = {
    input: solcInput,
    output: solcOutput,
  };
  return build;
};
