import { isMainContract } from "./builder";
import { SourceUnit } from "solidity-ast";
import { isNodeType } from "solidity-ast/utils";
import { FullSources, Sources } from "./types";
import fs from "fs";
import path from "path";
import { renameAbsolutePaths } from "./ast-updater";

/**
 * It takes a file path and returns the name of the contract
 * @param {string} filePath - The path to the contract file.
 * @returns The contract name
 */
export function getContractName(filePath: string): string {
  const pathArray = filePath.split("/");
  const contractName = pathArray[pathArray.length - 1]!.split(".")[0];
  if (!contractName) {
    throw new Error("Contract name not found");
  }
  return contractName;
}
/**
 * It takes in an array of ASTs, a contract name, and a full path to the AST, and returns the main
 * contract
 * @param {SourceUnit[]} asts - The list of all the ASTs in the project.
 * @param {string} contractName - The name of the contract you want to get the AST for.
 * @param {string} astFullPath - The path to the contract file that you want to analyze.
 * @returns The main contract
 */
export const getMainAst = (
  asts: SourceUnit[],
  contractName: string,
  astFullPath: string,
  sourcesDir: string
) => {
  let mainContract = null;
  for (const ast of asts) {
    if (
      ast.absolutePath.endsWith(`${contractName}.sol`) ||
      ast.absolutePath.endsWith(`${contractName}.tsol`)
    ) {
      if (isMainContract(ast.absolutePath, astFullPath, sourcesDir)) {
        mainContract = ast;
      }
    }
  }
  return mainContract;
};

/**
 * It takes an array of ASTs and a contract ID, and returns the AST that contains the SourceUnit node with
 * that ID
 * @param {SourceUnit[]} asts - SourceUnit[] - this is the array of ASTs that we get from the compiler.
 * @param {number} id - The id of the contract you want to get the parent AST for.
 * @returns The source unit that contains the contract with the given id.
 */
export const getParentAstFromContractId = (
  asts: SourceUnit[],
  id: number
): SourceUnit | undefined => {
  for (const ast of asts) {
    if (Object.values(ast.exportedSymbols).flat().includes(id)) {
      return ast;
    }
  }
};

/**
 * It takes a list of abstract syntax trees and a name, and returns the first abstract syntax tree that
 * exports a symbol with that name
 * @param {SourceUnit[]} asts - The list of all the ASTs in the project.
 * @param {string} name - The name of the contract you want to get the AST for.
 * @returns The AST of the parent contract of the given name.
 */
export const getParentAstFromName = (asts: SourceUnit[], name: string) => {
  for (const ast of asts) {
    if (ast.exportedSymbols[name]) {
      return ast;
    }
  }
};

/**
 * It takes a list of sources ast, and returns a map from absolute path to the number of dependencies that
 * source has
 * @param {SourceUnit[][]} sources - SourceUnit[][]
 * @returns A map of the absolute path of the source file to the number of dependencies it has.
 */
export const getDependenciesCount = (sources: SourceUnit[][]) => {
  const dependencyCount = new Map<string, number>();
  sources.forEach((source) => {
    for (const ast of source) {
      const contractDef = ast.nodes.find(isNodeType("ContractDefinition"))!;

      const absolutePath = ast.absolutePath;
      if (!dependencyCount.has(absolutePath)) {
        dependencyCount.set(
          absolutePath,
          contractDef.contractDependencies
            ? contractDef.contractDependencies.length
            : 0
        );
      }
    }
  });
  return dependencyCount;
};

/**
 * It takes a directory of AST files, and returns a map of absolute paths to ASTs
 * @param {string} astDir - the directory where the ASTs are stored
 * @param {string} root - The root directory of the project.
 * @returns An object with the absolute path of the contract as the key and the contract's AST as the
 * value.
 */
export const getAstsFromSources = (
  astDir: string,
  root: string,
  sourcesDir: string
) => {
  const astSources = fs
    .readdirSync(path.resolve(root, astDir))
    .filter((file) => file.endsWith(".ast.json"))
    .map((file) => path.join(root, astDir, file));

  const sources: Sources = {};
  const fullSources: FullSources = {};
  astSources.forEach((astSourceFullPath) => {
    const astContent: SourceUnit[] = require(astSourceFullPath) as SourceUnit[];
    const withNormalPathAsts = renameAbsolutePaths(root, astContent);
    const astContractName = getContractName(astSourceFullPath)!;
    const mainAst = getMainAst(
      withNormalPathAsts,
      astContractName,
      astSourceFullPath,
      sourcesDir
    );
    if (mainAst) {
      sources[mainAst.absolutePath] = mainAst;
      fullSources[mainAst.absolutePath] = {
        asts: withNormalPathAsts,
        astPath: astSourceFullPath,
      };
    }
  });
  return { sources, fullSources };
};

/**
 * It takes a directory as an argument and returns an array of all the contract files in that directory
 * and its subdirectories
 * @param {string} contractsDir - The directory where your contracts are located.
 * @returns An array of strings.
 */
export const getContractsList = (
  contractsDir: string,
  exclude: string[] = []
) => {
  let contracts: string[] = [];

  const searchForContracts = (dir: string) => {
    fs.readdirSync(dir).forEach((file) => {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory() && !exclude.includes(file)) {
        searchForContracts(filePath);
      } else if (file.endsWith("sol")) {
        contracts.push(`${dir.slice(contractsDir.length) + "/"}${file}`);
      }
    });
  };

  searchForContracts(contractsDir);
  return contracts.map((file) => file.slice(0, file.length));
};
