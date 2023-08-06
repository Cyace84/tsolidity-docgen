import Processor from "asciidoctor";
import fs from "fs";
import path from "path";
import { Config } from "../config";
const processor = Processor();

export async function generateHTMLFiles(config: Config): Promise<void> {
  try {
    const distFolderPath = path.join(config.outputDir!, "dist");
    if (!fs.existsSync(config.outputDir!)) {
      throw new Error("No adoc files found!!");
    }
    if (!fs.existsSync(distFolderPath)) {
      fs.mkdirSync(distFolderPath);
    } else {
      const files = fs.readdirSync(distFolderPath);
      for (const file of files) {
        await fs.promises.unlink(path.join(distFolderPath, file));
      }
    }
    const filesInPath = await fs.promises.readdir(config.outputDir!);
    if (filesInPath.length === 0) {
      throw new Error("No adoc files found!!");
    }
    for (const file of filesInPath) {
      if (path.extname(file) === ".adoc") {
        await processor.convertFile(path.join(config.outputDir!, file), {
          to_dir: distFolderPath,
        });
      }
    }
  } catch (err: any) {
    throw new Error(err.message);
  }
}
