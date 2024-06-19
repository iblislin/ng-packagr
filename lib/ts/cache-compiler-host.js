"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.augmentProgramWithVersioning = exports.cacheCompilerHost = void 0;
const convert_source_map_1 = __importDefault(require("convert-source-map"));
const crypto_1 = require("crypto");
const node_assert_1 = __importDefault(require("node:assert"));
const path = __importStar(require("path"));
const typescript_1 = __importDefault(require("typescript"));
const node_1 = require("../graph/node");
const nodes_1 = require("../ng-package/nodes");
const path_1 = require("../utils/path");
const pug_processor_1 = require("../styles/pug-processor");
function cacheCompilerHost(graph, entryPoint, compilerOptions, moduleResolutionCache, stylesheetProcessor, inlineStyleLanguage, sourcesFileCache = entryPoint.cache.sourcesFileCache) {
    const compilerHost = typescript_1.default.createIncrementalCompilerHost(compilerOptions);
    // Set the parsing mode to the same as TS 5.3 default for tsc. This provides a parse
    // performance improvement by skipping non-type related JSDoc parsing.
    // NOTE: The check for this enum can be removed when TS 5.3 support is the minimum.
    if (typescript_1.default.JSDocParsingMode) {
        compilerHost.jsDocParsingMode = typescript_1.default.JSDocParsingMode.ParseForTypeErrors;
    }
    const getNode = (fileName) => {
        const nodeUri = (0, nodes_1.fileUrl)((0, path_1.ensureUnixPath)(fileName));
        let node = graph.get(nodeUri);
        if (!node) {
            node = new node_1.Node(nodeUri);
            graph.put(node);
        }
        return node;
    };
    const addDependee = (fileName) => {
        const node = getNode(fileName);
        entryPoint.dependsOn(node);
    };
    const { flatModuleFile, destinationPath, entryFile } = entryPoint.data.entryPoint;
    const flatModuleFileDtsFilename = `${flatModuleFile}.d.ts`;
    const flatModuleFileDtsPath = (0, path_1.ensureUnixPath)(path.join(destinationPath, flatModuleFileDtsFilename));
    const hasIndexEntryFile = path.basename(entryFile.toLowerCase()) === 'index.ts';
    return {
        ...compilerHost,
        // ts specific
        fileExists: (fileName) => {
            const cache = sourcesFileCache.getOrCreate(fileName);
            if (cache.exists === undefined) {
                cache.exists = compilerHost.fileExists.call(this, fileName);
            }
            return cache.exists;
        },
        getSourceFile: (fileName, languageVersion) => {
            addDependee(fileName);
            const cache = sourcesFileCache.getOrCreate(fileName);
            if (!cache.sourceFile) {
                cache.sourceFile = compilerHost.getSourceFile.call(this, fileName, languageVersion);
            }
            return cache.sourceFile;
        },
        writeFile: (fileName, data, writeByteOrderMark, onError, sourceFiles) => {
            var _a, _b, _c;
            if (fileName.includes('.ngtypecheck.')) {
                return;
            }
            if (!(sourceFiles === null || sourceFiles === void 0 ? void 0 : sourceFiles.length) && fileName.endsWith('.tsbuildinfo')) {
                // Save builder info contents to specified location
                compilerHost.writeFile.call(this, fileName, data, writeByteOrderMark, onError, sourceFiles);
                return;
            }
            (0, node_assert_1.default)((sourceFiles === null || sourceFiles === void 0 ? void 0 : sourceFiles.length) === 1, 'Invalid TypeScript program emit for ' + fileName);
            const outputCache = entryPoint.cache.outputCache;
            if (fileName.endsWith('.d.ts')) {
                if (fileName === flatModuleFileDtsPath) {
                    if (hasIndexEntryFile) {
                        // In case the entry file is index.ts, we should not emit the `d.ts` which are a re-export of the `index.ts`.
                        // Because it will cause a conflict.
                        return;
                    }
                    else {
                        // Rename file to index.d.ts so that TypeScript can resolve types without
                        // them needing to be referenced in the package.json manifest.
                        fileName = fileName.replace(flatModuleFileDtsFilename, 'index.d.ts');
                    }
                }
                sourceFiles.forEach(source => {
                    const cache = sourcesFileCache.getOrCreate(source.fileName);
                    if (!cache.declarationFileName) {
                        cache.declarationFileName = (0, path_1.ensureUnixPath)(fileName);
                    }
                });
                if (((_a = outputCache.get(fileName)) === null || _a === void 0 ? void 0 : _a.content) === data) {
                    // Only emit files that changed content.
                    return;
                }
                outputCache.set(fileName, {
                    content: data,
                });
            }
            else {
                fileName = fileName.replace(/\.js(\.map)?$/, '.mjs$1');
                if (((_b = outputCache.get(fileName)) === null || _b === void 0 ? void 0 : _b.content) === data) {
                    return;
                }
                // Extract inline sourcemap which will later be used by rollup.
                let map = undefined;
                const version = (0, crypto_1.createHash)('sha256').update(data).digest('hex');
                if (fileName.endsWith('.mjs')) {
                    if (((_c = outputCache.get(fileName)) === null || _c === void 0 ? void 0 : _c.version) === version) {
                        // Only emit changed files
                        return;
                    }
                    map = convert_source_map_1.default.fromComment(data).toJSON();
                }
                outputCache.set(fileName, {
                    content: data,
                    version,
                    map,
                });
            }
            compilerHost.writeFile.call(this, fileName, data, writeByteOrderMark, onError, sourceFiles);
        },
        readFile: (fileName) => {
            addDependee(fileName);
            const cache = sourcesFileCache.getOrCreate(fileName);
            if (cache.content === undefined) {
                cache.content = compilerHost.readFile.call(this, fileName);
            }
            return cache.content;
        },
        resolveModuleNames: (moduleNames, containingFile) => {
            return moduleNames.map(moduleName => {
                const { resolvedModule } = typescript_1.default.resolveModuleName(moduleName, (0, path_1.ensureUnixPath)(containingFile), compilerOptions, compilerHost, moduleResolutionCache);
                return resolvedModule;
            });
        },
        resourceNameToFileName: (resourceName, containingFilePath) => {
            const resourcePath = path.resolve(path.dirname(containingFilePath), resourceName);
            const containingNode = getNode(containingFilePath);
            const resourceNode = getNode(resourcePath);
            containingNode.dependsOn(resourceNode);
            return resourcePath;
        },
        readResource: async (fileName) => {
            addDependee(fileName);
            const cache = sourcesFileCache.getOrCreate(fileName);
            if (cache.content === undefined) {
                if (!compilerHost.fileExists(fileName)) {
                    throw new Error(`Cannot read file ${fileName}.`);
                }
                if (/(?:html?|svg)$/.test(path.extname(fileName))) {
                    // template
                    cache.content = compilerHost.readFile.call(this, fileName);
                }
                else if (/(pug|jade)$/.test(path.extname(fileName))) {
                    cache.content = (0, pug_processor_1.pugProcessor)(fileName, cache.content);
                }
                else {
                    // stylesheet
                    cache.content = await stylesheetProcessor.process({
                        filePath: fileName,
                        content: compilerHost.readFile.call(this, fileName),
                    });
                }
                cache.exists = true;
            }
            return cache.content;
        },
        transformResource: async (data, context) => {
            if (context.resourceFile || context.type !== 'style') {
                return null;
            }
            if (inlineStyleLanguage) {
                const key = (0, crypto_1.createHash)('sha1').update(data).digest('hex');
                const fileName = `${context.containingFile}-${key}.${inlineStyleLanguage}`;
                const cache = sourcesFileCache.getOrCreate(fileName);
                if (cache.content === undefined) {
                    cache.content = await stylesheetProcessor.process({
                        filePath: fileName,
                        content: data,
                    });
                    const virtualFileNode = getNode(fileName);
                    const containingFileNode = getNode(context.containingFile);
                    virtualFileNode.dependsOn(containingFileNode);
                }
                cache.exists = true;
                return { content: cache.content };
            }
            return null;
        },
    };
}
exports.cacheCompilerHost = cacheCompilerHost;
function augmentProgramWithVersioning(program) {
    const baseGetSourceFiles = program.getSourceFiles;
    program.getSourceFiles = function (...parameters) {
        const files = baseGetSourceFiles(...parameters);
        for (const file of files) {
            if (file.version === undefined) {
                file.version = (0, crypto_1.createHash)('sha256').update(file.text).digest('hex');
            }
        }
        return files;
    };
}
exports.augmentProgramWithVersioning = augmentProgramWithVersioning;
//# sourceMappingURL=cache-compiler-host.js.map