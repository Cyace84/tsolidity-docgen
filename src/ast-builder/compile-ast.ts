import fs from "fs";
import { execSync } from "child_process";
import { Config } from "../config";
import { getAstsFromSources, getContractsList } from "./getters";
import { basename, join, resolve } from "path";

const createDirectoryIfNotExists = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
};

const moveFiles = (sourceDir: string, destinationDir: string) => {
  let files = fs.readdirSync(sourceDir);
  files.forEach((file) => {
    let oldPath = join(sourceDir, file);
    let newPath = join(destinationDir, file);
    fs.renameSync(oldPath, newPath);
  });
};

const deleteDirectoryIfExists = (dir: string) => {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
};

/**
 * It takes the config object, gets a list of contracts, and then compiles the AST for each contract
 * @param {Config} config - The configuration object that we created earlier.
 */
export const compileAst = (config: Config) => {
  const contracts = getContractsList(config.sourcesDir!, config.exclude!);

  let astOutputPath = resolve(config.root!, config.astOutputDir!);
  deleteDirectoryIfExists(astOutputPath);

  let ast_cache_path = `ast-cache`;
  let ast_path = resolve(process.cwd(), "ast");

  createDirectoryIfNotExists(ast_cache_path);
  createDirectoryIfNotExists(ast_path);

  contracts.forEach((contract) => {
    execSync(
      `${config.compilerPath} --ast-compact-json ${config.sourcesDir}/${contract} --output-dir=${ast_cache_path}`
    );
    moveFiles(ast_cache_path, astOutputPath);
  });

  deleteDirectoryIfExists(ast_cache_path);
  compileExternalAst(config);
  renameAstFiles(astOutputPath);
};

/**
 * It compiles all the external sources in the project, and saves the ASTs in the `astOutputDir`
 * directory
 * @param {Config} config - Config
 */
export const compileExternalAst = async (config: Config) => {
  const { fullSources } = getAstsFromSources(
    config.astOutputDir!,
    config.root!
  );

  Object.values(fullSources).forEach((source) => {
    for (const ast of source.asts) {
      const absolutePath = ast.absolutePath;
      if (!absolutePath.startsWith(config.sourcesDir!)) {
        execSync(
          `${config.compilerPath} --ast-compact-json $PWD/${absolutePath} --output-dir=$PWD/${config.astOutputDir}`
        );
      }
    }
  });
};

const renameAstFiles = (dir: string) => {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    if (file.endsWith(".sol_json.ast")) {
      const oldPath = join(dir, file);
      const newFileName = basename(file, ".sol_json.ast") + ".ast.json";
      const newPath = join(dir, newFileName);
      fs.renameSync(oldPath, newPath);
    } else if (file.endsWith(".tsol_json.ast")) {
      const oldPath = join(dir, file);
      const newFileName = basename(file, ".tsol_json.ast") + ".ast.json";
      const newPath = join(dir, newFileName);
      fs.renameSync(oldPath, newPath);
    }
  });
};
