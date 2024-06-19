"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pugProcessor = void 0;
const pug = require('pug');
const pugProcessor = (filePath, content) => {
    // Render pug
    return pug.render(content, { doctype: 'html', filename: filePath });
};
exports.pugProcessor = pugProcessor;
//# sourceMappingURL=pug-processor.js.map