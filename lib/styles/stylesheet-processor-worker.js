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
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
const node_worker_threads_1 = require("node:worker_threads");
const postcss_1 = __importDefault(require("postcss"));
const esbuild_executor_1 = require("../esbuild/esbuild-executor");
const cache_1 = require("../utils/cache");
const log = __importStar(require("../utils/log"));
const css_resource_plugin_1 = require("./css-resource-plugin");
const { tailwindConfigPath, projectBasePath, browserslistData, targets, cssUrl, styleIncludePaths, postcssConfiguration, } = node_worker_threads_1.workerData;
let cacheDirectory = node_worker_threads_1.workerData.cacheDirectory;
let postCssProcessor;
let esbuild;
const CACHE_KEY_VALUES = [...browserslistData, ...styleIncludePaths, cssUrl].join(':');
/**
 * An array of keywords that indicate Tailwind CSS processing is required for a stylesheet.
 *
 * Based on https://tailwindcss.com/docs/functions-and-directives
 */
const TAILWIND_KEYWORDS = [
    '@tailwind',
    '@layer',
    '@apply',
    '@config',
    'theme(',
    'screen(',
    '@screen', // Undocumented in version 3, see: https://github.com/tailwindlabs/tailwindcss/discussions/7516.
];
async function render({ content, filePath }) {
    let key;
    if (cacheDirectory && !content.includes('@import') && !content.includes('@use')) {
        // No transitive deps, we can cache more aggressively.
        key = await (0, cache_1.generateKey)(content, CACHE_KEY_VALUES);
        const result = await (0, cache_1.readCacheEntry)(cacheDirectory, key);
        if (result) {
            result.warnings.forEach(msg => log.warn(msg));
            return result.css;
        }
    }
    // Render pre-processor language (sass, styl, less)
    let renderedCss = await renderCss(filePath, content);
    // We cannot cache CSS re-rendering phase, because a transitive dependency via (@import) can case different CSS output.
    // Example a change in a mixin or SCSS variable.
    if (!key) {
        key = await (0, cache_1.generateKey)(renderedCss, CACHE_KEY_VALUES);
    }
    if (cacheDirectory) {
        const cachedResult = await (0, cache_1.readCacheEntry)(cacheDirectory, key);
        if (cachedResult) {
            cachedResult.warnings.forEach(msg => log.warn(msg));
            return cachedResult.css;
        }
    }
    const warnings = [];
    if (postCssProcessor && (postcssConfiguration || (tailwindConfigPath && hasTailwindKeywords(renderedCss)))) {
        const result = await postCssProcessor.process(renderedCss, {
            from: filePath,
            to: filePath.replace((0, node_path_1.extname)(filePath), '.css'),
        });
        warnings.push(...result.warnings().map(w => w.toString()));
        renderedCss = result.css;
    }
    const { outputFiles, warnings: esBuildWarnings, errors: esbuildErrors, } = await esbuild.build({
        stdin: {
            contents: renderedCss,
            loader: 'css',
            resolveDir: (0, node_path_1.dirname)(filePath),
        },
        plugins: [(0, css_resource_plugin_1.createCssResourcePlugin)(cssUrl)],
        write: false,
        sourcemap: false,
        minify: true,
        bundle: true,
        absWorkingDir: projectBasePath,
        target: targets,
    });
    const code = outputFiles[0].text;
    if (esBuildWarnings.length > 0) {
        warnings.push(...(await esbuild.formatMessages(esBuildWarnings, { kind: 'warning' })));
        warnings.forEach(msg => log.warn(msg));
    }
    if (esbuildErrors.length > 0) {
        const errors = await esbuild.formatMessages(esBuildWarnings, { kind: 'error' });
        errors.forEach(msg => log.error(msg));
        throw new Error(`An error has occuried while processing ${filePath}.`);
    }
    if (cacheDirectory) {
        await (0, cache_1.saveCacheEntry)(cacheDirectory, key, JSON.stringify({
            css: code,
            warnings,
        }));
    }
    return code;
}
async function renderCss(filePath, css) {
    const ext = (0, node_path_1.extname)(filePath);
    switch (ext) {
        case '.sass':
        case '.scss': {
            return (await Promise.resolve().then(() => __importStar(require('sass')))).compileString(css, {
                url: (0, node_url_1.pathToFileURL)(filePath),
                syntax: '.sass' === ext ? 'indented' : 'scss',
                loadPaths: styleIncludePaths,
            }).css;
        }
        case '.less': {
            const { css: content } = await (await Promise.resolve().then(() => __importStar(require('less')))).default.render(css, {
                filename: filePath,
                math: 'always',
                javascriptEnabled: true,
                paths: styleIncludePaths,
            });
            return content;
        }
        case '.css':
        default:
            return css;
    }
}
function getTailwindPlugin() {
    // Attempt to setup Tailwind CSS
    // Only load Tailwind CSS plugin if configuration file was found.
    // This acts as a guard to ensure the project actually wants to use Tailwind CSS.
    // The package may be unknowningly present due to a third-party transitive package dependency.
    if (tailwindConfigPath) {
        let tailwindPackagePath;
        try {
            tailwindPackagePath = require.resolve('tailwindcss', { paths: [projectBasePath] });
        }
        catch {
            const relativeTailwindConfigPath = (0, node_path_1.relative)(projectBasePath, tailwindConfigPath);
            log.warn(`Tailwind CSS configuration file found (${relativeTailwindConfigPath})` +
                ` but the 'tailwindcss' package is not installed.` +
                ` To enable Tailwind CSS, please install the 'tailwindcss' package.`);
        }
        if (tailwindPackagePath) {
            return require(tailwindPackagePath)({ config: tailwindConfigPath });
        }
    }
}
async function initialize() {
    const postCssPlugins = [];
    if (postcssConfiguration) {
        for (const [pluginName, pluginOptions] of postcssConfiguration.plugins) {
            const { default: plugin } = await Promise.resolve(`${pluginName}`).then(s => __importStar(require(s)));
            if (typeof plugin !== 'function' || plugin.postcss !== true) {
                throw new Error(`Attempted to load invalid Postcss plugin: "${pluginName}"`);
            }
            postCssPlugins.push(plugin(pluginOptions));
        }
    }
    else {
        const tailwinds = getTailwindPlugin();
        if (tailwinds) {
            postCssPlugins.push(tailwinds);
            cacheDirectory = undefined;
        }
    }
    if (postCssPlugins.length) {
        postCssProcessor = (0, postcss_1.default)(postCssPlugins);
    }
    esbuild = new esbuild_executor_1.EsbuildExecutor();
    // Return the render function for use
    return render;
}
/**
 * Searches the provided contents for keywords that indicate Tailwind is used
 * within a stylesheet.
 */
function hasTailwindKeywords(contents) {
    // TODO: use better search algorithm for keywords
    return TAILWIND_KEYWORDS.some(keyword => contents.includes(keyword));
}
/**
 * The default export will be the promise returned by the initialize function.
 * This is awaited by piscina prior to using the Worker.
 */
exports.default = initialize();
//# sourceMappingURL=stylesheet-processor-worker.js.map