#!/usr/bin/env node

import DtsCreator from 'typed-css-modules';
import chalk from 'chalk';
import chokidar from 'chokidar';
import fs from 'fs';
import glob from 'glob';
import path from 'path';
import sass from 'node-sass';
import yargs from 'yargs';

const pkg = require('../package.json');

const readSass = (pathName, relativeTo) => (
    new Promise((resolve, reject) => {
        sass.render(
            { file: pathName },
            (err, result) => {
                if (err && (relativeTo && relativeTo !== '/')) {
                    return resolve([]);
                } else if (err && (!relativeTo || relativeTo === '/')) {
                    return reject(err);
                }
                return resolve(result.css.toString());
            },
        );
    })
);

const createTypings = (pathName, creator, cache, handleError, handleWarning, verbose) => (
    readSass(pathName)
        .then(content => creator.create(pathName, content, cache))
        .then(c => c.writeFile())
        .then((c) => {
            if (verbose) {
                console.info(`Created ${chalk.green(c.outputFilePath)}`);
            }
            c.messageList.forEach((message) => {
                const warningTitle = chalk.yellow(`WARNING: ${pathName}`);
                const warningInfo = message;
                handleWarning(`${warningTitle}\n${warningInfo}`);
            });
            return c;
        })
        .catch((reason) => {
            const errorTitle = chalk.red(`ERROR: ${pathName}`);
            const errorInfo = reason;
            handleError(`${errorTitle}\n${errorInfo}`);
        })
);

const createTypingsForFileOnWatch = (creator, cache, verbose) => (pathName) => {
    let warnings = 0;
    let errors = 0;

    const handleError = (error) => {
        console.error(error);
        errors += 1;
    };
    const handleWarning = (warning) => {
        console.warn(warning);
        warnings += 1;
    };
    const onComplete = () => {
        if (warnings + errors > 0) {
            console.info(`${pathName}: ${warnings} warnings, ${errors} errors`);
        }
        warnings = 0;
        errors = 0;
    };

    return createTypings(pathName, creator, cache, handleError, handleWarning, verbose)
        .then(onComplete);
};

const createTypingsForFiles = (creator, cache, verbose) => (pathNames) => {
    let warnings = 0;
    let errors = 0;

    const handleError = (error) => {
        console.error(error);
        errors += 1;
    };
    const handleWarning = (warning) => {
        console.warn(warning);
        warnings += 1;
    };
    const onComplete = () => {
        if (warnings + errors > 0) {
            console.info(`Completed with ${warnings} warnings and ${errors} errors.`);
        }
        errors = 0;
        warnings = 0;
    };

    return Promise.all(pathNames.map(
        pathName => createTypings(pathName, creator, cache, handleError, handleWarning, verbose),
    )).then(onComplete);
};


const main = () => {
    const yarg = yargs.usage('Create .scss.d.ts from CSS modules *.scss files.\nUsage: $0 [options] <input directory>')
        .example('$0 src/styles')
        .example('$0 src -o dist')
        .example('$0 -p styles/**/*.scss -w')

        .detectLocale(false)
        .version(pkg.version)

        .demandCommand(1, 1, 'Input directory must be specified', 'Only one input directory must be specified')
        .option('c', {
            alias: 'camelCase',
            default: false,
            type: 'boolean',
            describe: 'Convert CSS class tokens to camelCase',
        })
        .option('o', {
            alias: 'outDir',
            describe: 'Output directory',
        })
        .option('p', {
            alias: 'pattern',
            default: '**/[^_]*.scss',
            describe: 'Glob pattern with scss files',
        })
        .option('w', {
            alias: 'watch',
            default: false,
            type: 'boolean',
            describe: 'Watch input directory\'s scss files or pattern',
        })
        .option('d', {
            alias: 'dropExtension',
            default: false,
            type: 'boolean',
            describe: 'Drop the input files extension',
        })
        .option('v', {
            alias: 'verbose',
            default: false,
            type: 'boolean',
            describe: 'Show verbose message',
        })

        .alias('h', 'help')
        .help('h');

    const { argv } = yarg;

    // Show help
    if (argv.h) {
        yarg.showHelp();
        return;
    }

    const searchDir = String(argv._[0]) || './';
    // Show help if no search diretory present
    if (searchDir === undefined) {
        yarg.showHelp();
        return;
    }

    // If search directory doesn't exits, exit
    if (!fs.existsSync(searchDir)) {
        console.error(chalk.red(`Error: Input directory ${searchDir} doesn't exist.`));
        return;
    }

    const filesPattern = path.join(searchDir, argv.p);

    const rootDir = process.cwd();

    const creator = new DtsCreator({
        rootDir,
        searchDir,
        outDir: argv.o,
        camelCase: argv.c,
        dropExtension: argv.d,
    });

    const cache = !!argv.w;

    if (!argv.w) {
        glob(filesPattern, null, (err, pathNames) => {
            if (err) {
                console.error(err);
                return;
            } else if (!pathNames || !pathNames.length) {
                console.info('Creating typings for 0 files');
                return;
            }
            console.info(`Creating typings for ${pathNames.length} files\n`);
            createTypingsForFiles(creator, cache, argv.v)(pathNames);
        });
    } else {
        console.info(`Watching ${filesPattern} ...\n`);

        const watcher = chokidar.watch(filesPattern);
        watcher.on('add', createTypingsForFileOnWatch(creator, cache, argv.v));
        watcher.on('change', createTypingsForFileOnWatch(creator, cache, argv.v));
    }
};

main();
