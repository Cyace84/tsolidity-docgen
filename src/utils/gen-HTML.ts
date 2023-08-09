import Processor from "asciidoctor";
import fs from "fs";
import { extname, resolve } from "path";
import { Config } from "../config";
const processor = Processor();

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
    const filesInPath = await fs.promises.readdir(outputDirPath);
    const adocFiles = filesInPath.filter((file) => file.endsWith(".adoc"));
    if (adocFiles.length === 0) {
      throw new Error("No adoc files found!!");
    }
    for (const file of filesInPath) {
      if (extname(file) === ".adoc") {
        await processor.convertFile(resolve(outputDirPath, file), {
          to_dir: distDirPath,
        });
      }
    }
  } catch (err: any) {
    throw new Error(err.message);
  }
}
