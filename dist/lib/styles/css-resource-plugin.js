"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCssResourcePlugin = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const stylesheet_processor_1 = require("./stylesheet-processor");
const CSS_RESOURCE_NAMESPACE = 'angular:css-resource';
/**
 * Symbol marker used to indicate CSS resource resolution is being attempted.
 * This is used to prevent an infinite loop within the plugin's resolve hook.
 */
const CSS_RESOURCE_RESOLUTION = Symbol('CSS_RESOURCE_RESOLUTION');
/**
 * Creates an esbuild {@link Plugin} that loads all CSS url token references using the
 * built-in esbuild `file` loader. A plugin is used to allow for all file extensions
 * and types to be supported without needing to manually specify all extensions
 * within the build configuration.
 *
 * @returns An esbuild {@link Plugin} instance.
 */
function createCssResourcePlugin(url) {
    return {
        name: 'angular-css-resource',
        setup(build) {
            build.onResolve({ filter: /.*/ }, async (args) => {
                var _a, _b;
                // Only attempt to resolve url tokens which only exist inside CSS.
                // Also, skip this plugin if already attempting to resolve the url-token.
                if (args.kind !== 'url-token' || ((_a = args.pluginData) === null || _a === void 0 ? void 0 : _a[CSS_RESOURCE_RESOLUTION])) {
                    return null;
                }
                // If root-relative, absolute or protocol relative url, mark as external to leave the
                // path/URL in place.
                if (url !== stylesheet_processor_1.CssUrl.inline || /^((?:\w+:)?\/\/|data:|chrome:|#|\/)/.test(args.path)) {
                    return {
                        path: args.path,
                        external: true,
                    };
                }
                const { importer, kind, resolveDir, namespace, pluginData = {} } = args;
                pluginData[CSS_RESOURCE_RESOLUTION] = true;
                const result = await build.resolve(args.path, {
                    importer,
                    kind,
                    namespace,
                    pluginData,
                    resolveDir,
                });
                if (result.errors.length) {
                    const error = result.errors[0];
                    if (args.path[0] === '~') {
                        error.notes = [
                            {
                                location: null,
                                text: 'You can remove the tilde and use a relative path to reference it, which should remove this error.',
                            },
                        ];
                    }
                    else if (args.path[0] === '^') {
                        error.notes = [
                            {
                                location: null,
                                text: 'You can remove the caret and add the path to the `externalDependencies` build option,' +
                                    ' which should remove this error.',
                            },
                        ];
                    }
                    const extension = importer && (0, node_path_1.extname)(importer);
                    if (extension !== '.css') {
                        error.notes.push({
                            location: null,
                            text: 'Preprocessor stylesheets may not show the exact file location of the error.',
                        });
                    }
                }
                // Return results that are not files since these are most likely specific to another plugin
                // and cannot be loaded by this plugin.
                if (result.namespace !== 'file') {
                    return result;
                }
                // All file results are considered CSS resources and will be loaded via the file loader
                return {
                    ...result,
                    // Use a relative path to prevent fully resolved paths in the metafile (JSON stats file).
                    // This is only necessary for custom namespaces. esbuild will handle the file namespace.
                    path: (0, node_path_1.relative)((_b = build.initialOptions.absWorkingDir) !== null && _b !== void 0 ? _b : '', result.path),
                    namespace: CSS_RESOURCE_NAMESPACE,
                };
            });
            build.onLoad({ filter: /./, namespace: CSS_RESOURCE_NAMESPACE }, async (args) => {
                var _a;
                const resourcePath = (0, node_path_1.join)((_a = build.initialOptions.absWorkingDir) !== null && _a !== void 0 ? _a : '', args.path);
                return {
                    contents: await (0, promises_1.readFile)(resourcePath),
                    loader: 'dataurl',
                    watchFiles: [resourcePath],
                };
            });
        },
    };
}
exports.createCssResourcePlugin = createCssResourcePlugin;
//# sourceMappingURL=css-resource-plugin.js.map