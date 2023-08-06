import { SourceUnit } from "solidity-ast";
import { SolcOutput } from "solidity-ast/solc";
import { findAll, isNodeType } from "solidity-ast/utils";
import { Config } from "../config";
import {
  getDependenciesCount,
  getParentAstFromContractId,
  getParentAstFromName,
} from "./getters";
import { FullSources } from "./types";

export const resetIds = (ast: any, idCounter: number = 0): number => {
  // Recursively visit child nodes and update their ID's
  for (const key in ast) {
    if (typeof ast[key] === "object" && ast[key] !== null) {
      if (key === "body") {
        if (ast.hasOwnProperty("id") && ast.id === undefined) {
          idCounter = resetIds(ast[key], idCounter);
          ast.id = idCounter;
          idCounter++;
        } else {
          idCounter = resetIds(ast[key], idCounter);
        }
      } else {
        if (ast.hasOwnProperty("id") && ast.id === undefined) {
          idCounter = resetIds(ast[key], idCounter);
          ast.id = idCounter;
          idCounter++;
        } else {
          idCounter = resetIds(ast[key], idCounter);
        }
      }
    }
  }
  // Update references to new ID's
  for (const key in ast) {
    if (typeof ast[key] === "number" && key === "id") {
      if (ast[key] < idCounter) {
        ast[key] = idCounter;
        ++idCounter;
      }
    }
  }
  if (ast.hasOwnProperty("exportedSymbols")) {
    const name = Object.keys(ast.exportedSymbols)[0]!;
    ast.exportedSymbols[name] = [ast.id - 1];
  }
  return idCounter;
};

const assignIds = (node: any, id: number) => {
  node.id = id++;
  if (node.nodes) {
    for (const childNode of node.nodes) {
      assignIds(childNode, id);
    }
  }
};

export const replaceSrc = (obj: any, id: number) => {
  if (!obj || typeof obj !== "object") {
    return;
  }

  if (obj.hasOwnProperty("src")) {
    const splitedSrc = obj.src.split(":");
    obj.src = `${splitedSrc[0]}:${splitedSrc[1]}:${id}`;
  }

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      replaceSrc(obj[key], id);
    }
  }
};

export function updateDependices(
  origSources: FullSources,
  sources: SolcOutput["sources"],
  config: Config
) {
  for (const contract of Object.keys(sources)) {
    const ast = sources[contract]!.ast;
    const origSource = origSources[contract]!;
    updateImports(ast, sources, config.root!);
    updateReferences(ast, sources, origSource.asts);
    for (const contractDef of findAll("ContractDefinition", ast)) {
      const dependencies = contractDef.contractDependencies;
      ast.exportedSymbols[contractDef.name] = [contractDef.id];
      if (dependencies.length === 0) {
        contractDef.linearizedBaseContracts = [contractDef.id];
        continue;
      }

      const parentIds = updateFunctions(
        ast,
        sources,
        origSource.asts,
        dependencies
      );
      const uniqParentIds = [...new Set(parentIds)];
      contractDef.contractDependencies = uniqParentIds;
      contractDef.linearizedBaseContracts = [contractDef.id].concat(
        uniqParentIds
      );
    }
  }
}
const updateFunctions = (
  ast: SourceUnit,
  sources: SolcOutput["sources"],
  origAsts: SourceUnit[],
  dependencies: number[]
) => {
  let parentIds: number[] = [];

  for (const depId of dependencies) {
    const origParentAst = getParentAstFromContractId(origAsts, depId);

    if (origParentAst) {
      const parentAst = sources[origParentAst.absolutePath]!.ast;

      for (const func of findAll("FunctionDefinition", ast)) {
        if (func.baseFunctions) {
          const baseFuncId = func.baseFunctions[0]!;
          let funcSrc: string | undefined;
          let parentId: number | undefined;

          for (const node of origParentAst.nodes) {
            if (
              isNodeType("FunctionDefinition", node) &&
              node.id === baseFuncId
            ) {
              funcSrc = node.src;
              break;
            }
          }

          if (funcSrc) {
            for (const node of parentAst.nodes) {
              if (
                isNodeType("FunctionDefinition", node) &&
                node.src.slice(0, -1) == funcSrc!.slice(0, -1)
              ) {
                func.baseFunctions = [node.id];
                parentId = Object.values(parentAst.exportedSymbols).find(
                  (id) => id![0] === node.id
                )![0];
                break;
              }
            }
          }

          if (parentId) {
            parentIds.push(parentId);
          }
        }
      }
    }
  }

  return parentIds;
};

const updateImports = (
  ast: SourceUnit,
  sources: SolcOutput["sources"],
  rootPath: string
) => {
  for (const imp of findAll("ImportDirective", ast)) {
    let absolutePath = imp.absolutePath;
    if (imp.absolutePath.startsWith(rootPath)) {
      absolutePath = imp.absolutePath.slice(rootPath.length + 1);
    }

    if (absolutePath) {
      const source = sources[absolutePath]!;
      if (source) {
        imp.sourceUnit = source.ast.id;
      }
    }
  }
};

const updateReferences = (
  ast: SourceUnit,
  sources: SolcOutput["sources"],
  origAsts: SourceUnit[]
) => {
  for (const imp of findAll("InheritanceSpecifier", ast)) {
    if (!isNodeType("UserDefinedTypeName", imp.baseName)) {
      continue;
    }
    const baseName = imp.baseName.name!;
    const parentAst = getParentAstFromName(origAsts, baseName)!;

    const parentSource = sources[parentAst.absolutePath]!.ast;
    let realParentId = parentSource.exportedSymbols[baseName]![0]!;

    imp.baseName.referencedDeclaration = realParentId;
    const splitedtypeIdentifier =
      imp.baseName.typeDescriptions.typeIdentifier!.split("$");
    imp.baseName.typeDescriptions.typeIdentifier = `${splitedtypeIdentifier[0]}${splitedtypeIdentifier[1]}$${realParentId}`;
  }
};
export const renameAbsolutePaths = (root: string, asts: SourceUnit[]) => {
  const separateFullPath = (fullPath: string, rootPath: string) => {
    if (fullPath.startsWith(rootPath)) {
      return fullPath.slice(rootPath.length + 1);
    }
    return fullPath;
  };

  for (const ast of asts) {
    ast.absolutePath = separateFullPath(ast.absolutePath, root);
  }
  return asts;
};

export function sortASTByDependency(
  sources: SourceUnit[][],
  solcOutput: SolcOutput
) {
  // Count the number of times each contract is inherited
  const dependencyCount: Map<string, number> = getDependenciesCount(sources);

  const sortedDependencyCount = Array.from(dependencyCount).sort(
    (a, b) => b[1] - a[1]
  );
  const sortedSources: SolcOutput["sources"] = {};
  let id = 0;
  let lastAstId = 0;
  sortedDependencyCount.reverse().forEach(([path]) => {
    const ast = solcOutput.sources[path]!.ast;
    resetIds(ast, lastAstId);
    replaceSrc(ast, id);
    lastAstId = ast.id;

    sortedSources[path] = { ast: ast, id: id };
    id++;
  });
  return sortedSources;
}
