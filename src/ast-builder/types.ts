import { SourceUnit } from 'solidity-ast';

export interface Sources {
  [file: string]: SourceUnit;
}
export interface FullSources {
  [file: string]: {
    asts: SourceUnit[];
    astPath: string;
  };
}
