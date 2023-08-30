import Processor from "asciidoctor";
import fs from "fs";
import { extname, join, resolve } from "path";
import { Config } from "../config";
const processor = Processor();

function searchFilesWithExtension(folderPath: string): string[] {
  let results: string[] = [];

  function searchRecursively(currentPath: string) {
    const files = fs.readdirSync(currentPath);

    files.forEach((file) => {
      const filePath = resolve(currentPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        searchRecursively(filePath);
      } else if (extname(filePath) === ".adoc") {
        results.push(filePath);
      }
    });
  }

  searchRecursively(folderPath);

  return results;
}
export async function generateHTMLFiles(config: Config): Promise<void> {
  try {
    const distDirPath = resolve(config.root!, config.outputDir!, "dist");
    const outputDirPath = resolve(config.root!, config.outputDir!);

    if (!fs.existsSync(outputDirPath)) {
      throw new Error("No adoc files generated!!");
    }
    if (!fs.existsSync(distDirPath)) {
      fs.mkdirSync(distDirPath);
    } else {
      const files = fs.readdirSync(distDirPath);
      for (const file of files) {
        await fs.promises.unlink(resolve(distDirPath, file));
      }
    }
    const filesInPath = searchFilesWithExtension(outputDirPath);

    if (filesInPath.length === 0) {
      throw new Error("No adoc files found!!");
    }
    filesInPath.forEach(async (file) => {
      processor.convertFile(file, {
        to_dir: distDirPath,
      });
    });
  } catch (err: any) {
    throw new Error(err.message);
  }
}
