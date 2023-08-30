import fs from "fs";
import { SolcInput, SolcOutput } from "solidity-ast/solc";
import { Sources } from "./types";
import { getContractName, getAstsFromSources } from "./getters";
import {
  replaceSrc,
  sortASTByDependency,
  updateDependices,
} from "./ast-updater";
import { Config } from "../config";
import { Build } from "../site";

import path, { resolve } from "path";

import { compileAst } from "./compile-ast";

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

const createInput = (solcOutput: SolcOutput, sourcesDir: string) => {
  const sources = solcOutput.sources;
  const SolcInput: SolcInput = { sources: {} };

  for (let key of Object.keys(sources)) {
    const tempKey = key.startsWith("contracts")
      ? resolve(sourcesDir.replace("/contracts", "/"), key)
      : resolve(sourcesDir.replace("/contracts", "/node_modules"), key);
    const fileContent = fs.readFileSync(tempKey, "utf8").toString();

    SolcInput.sources[key] = { content: fileContent };
  }
  return SolcInput;
};

export function isMainContract(
  absolutePath: string,
  astPath: string,
  sourcesDir: string
) {
  // checking if its in the project main contracts ot=r and third party contract
  sourcesDir = absolutePath.startsWith("contracts")
    ? sourcesDir.replace("/contracts", "")
    : sourcesDir.replace("/contracts", "/node_modules");
  // Extract the contract name from absolute path
  if (!fileExists(resolve(sourcesDir, absolutePath)) || !fileExists(astPath)) {
    throw new Error(`File does not exist :${resolve(sourcesDir, absolutePath)},
    ${absolutePath},
    ${astPath}`);
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
    if (err.code === "ENOENT") {
      return false;
    } else {
      throw err;
    }
  }
}

export const makeBuild = async (
  config: Config,
  contractList: string[] = []
) => {
  compileAst(config);
  const { sources: astSources, fullSources } = getAstsFromSources(
    config.astOutputDir!,
    config.root!,
    config.sourcesDir!
  )!;
  const solcOutput = createRawOutput(astSources);
  const sourcesList = Object.values(fullSources).map((source) => source.asts);

  const sortedSources = sortASTByDependency(sourcesList, solcOutput);
  updateDependices(fullSources, sortedSources, config);
  const ph = path.join(config.root!, "build/astBuild.json");
  fs.writeFileSync(ph, JSON.stringify(sortedSources, null, 2));
  solcOutput.sources = sortedSources;
  const solcInput = createInput(solcOutput, config.sourcesDir!);
  const build: Build = {
    input: solcInput,
    output: solcOutput,
  };
  return build;
};