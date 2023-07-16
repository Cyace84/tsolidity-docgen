import { RenderedPage } from '../render';

export function replaceAdocReferences(
  renderedPages: RenderedPage[],
  dirName: string,
) {
  renderedPages.forEach(function (item) {
    const prevId = item.id;
    if (item.id === '.adoc') {
      item.id = `${dirName}.adoc`;
    }

    if (typeof item.contents === 'string') {
      item.contents = item.contents.replace(
        /xref:\.adoc/g,
        `xref:${dirName}.adoc`,
      );
    }

    if (prevId !== item.id) {
      replaceAdocReferences(renderedPages, dirName);
    }
  });
}
