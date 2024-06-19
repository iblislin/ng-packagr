/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */
export type AssetPattern = {
    /**
     * The pattern to match.
     */
    glob: string;
    /**
     * The input directory path in which to apply 'glob'. Defaults to the project root.
     */
    input: string;
    /**
     * An array of globs to ignore.
     */
    ignore?: string[];
    /**
     * Absolute path within the output.
     */
    output: string;
    /**
     * Allow glob patterns to follow symlink directories. This allows subdirectories of the symlink to be searched.
     */
    followSymlinks?: boolean;
} | string;
/**
 * JSON Schema for `ng-package.json` description file
 */
export interface NgPackageConfig {
    $schema?: string;
    /**
     * Delete output path before build.
     */
    deleteDestPath?: boolean;
    /**
     * Destination folder where distributable binaries of the Angular library are written (default: `dist`).
     */
    dest?: string;
    /**
     * Enable this to keep the 'scripts' section in package.json. Read the NPM Blog on 'Package install scripts vulnerability' – http://blog.npmjs.org/post/141702881055/package-install-scripts-vulnerability
     */
    keepLifecycleScripts?: boolean;
    /**
     * A list of dependencies that are allowed in the 'dependencies' and 'devDependencies' section of package.json. Values in the list are regular expressions matched against npm package names.
     */
    allowedNonPeerDependencies?: string[];
    /**
     * A list of files which are simply copied into the package.
     */
    assets?: AssetPattern[];
    /**
     * The stylesheet language to use for the library's inline component styles.
     */
    inlineStyleLanguage?: "css" | "less" | "sass" | "scss";
    /**
     * Description of the library's entry point.
     */
    lib?: {
        /**
         * Entry file to the public API (default: `src/public_api.ts`).
         */
        entryFile?: string;
        /**
         * Filename of the auto-generated flat module file (if empty, defaults to the package name as given in `package.json`).
         */
        flatModuleFile?: string;
        /**
         * Embed assets in css file using data URIs - see https://css-tricks.com/data-uris
         */
        cssUrl?: "none" | "inline";
        /**
         * Any additional paths that should be used to resolve style imports
         */
        styleIncludePaths?: string[];
    };
}
