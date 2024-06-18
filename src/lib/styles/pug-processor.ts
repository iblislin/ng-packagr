const pug = require('pug');

export const pugProcessor = (filePath: string, content: string): string => {
  // Render pug
  return pug.render(content, { doctype: 'html', filename: filePath });
};
