#!/usr/bin/env node

import path from 'path';
import chokidar from 'chokidar';
import fs from 'fs';
import glob from 'glob';
import yargs from 'yargs';
import chalk from 'chalk';
import DtsCreator from 'typed-css-modules';
import sass from 'node-sass';

const pkg = require('../package.json');

const readSass = (file, relativeTo) => (
  new Promise((resolve, reject) => {
    sass.render(
      { file },
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

const createTypings = (f, creator, cache, handleError, handleWarning, verbose) => (
  readSass(f)
    .catch((reason) => {
      handleError(`${chalk.red(f)}\n${reason}\n`);
    })
    .then(content => creator.create(f, content, cache))
    .then(c => c.writeFile())
    .then((c) => {
      if (verbose) {
        console.info(`Created ${chalk.green(c.outputFilePath)}`);
      }
      c.messageList.forEach((message) => {
        handleWarning(`${chalk.yellow(f)}\nWarning: ${message}\n`);
      });
      return c;
    })
    .catch((reason) => {
      handleError(`${chalk.red(f)}\nError: ${reason}\n`);
    })
);


const createTypingsForFileOnWatch = (creator, cache, verbose) => (f) => {
  let warnings = [];
  let errors = [];

  const cleanUp = () => {
    warnings.forEach(m => console.warn(m));
    errors.forEach(e => console.error(e));
    errors = [];
    warnings = [];
  };

  const handleError = (e) => { errors.push(e); };
  const handleWarning = (w) => { warnings.push(w); };
  return createTypings(f, creator, cache, handleError, handleWarning, verbose)
    .then(cleanUp);
};

const createTypingsForFiles = (creator, cache, verbose) => (files) => {
  let errors = [];
  let warnings = [];

  const cleanUp = () => {
    warnings.forEach(m => console.warn(m));
    errors.forEach(e => console.error(e));
    if (warnings.length + errors.length > 0) {
      console.info(`Completed with ${warnings.length} warnings and ${errors.length} errors.`);
    }
    errors = [];
    warnings = [];
  };

  const handleError = (e) => { errors.push(e); };
  const handleWarning = (w) => { warnings.push(w); };

  const mapper = f => createTypings(f, creator, cache, handleError, handleWarning, verbose);

  return Promise.all(files.map(mapper))
    .then(cleanUp);
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
    glob(filesPattern, null, (err, files) => {
      if (err) {
        console.error(err);
        return;
      } else if (!files || !files.length) {
        console.info('Creating typings for 0 files');
        return;
      }
      console.info(`Creating typings for ${files.length} files\n`);
      createTypingsForFiles(creator, cache, argv.v)(files);
    });
  } else {
    console.info(`Watching ${filesPattern} ...\n`);

    const watcher = chokidar.watch(filesPattern);
    watcher.on('add', createTypingsForFileOnWatch(creator, cache, argv.v));
    watcher.on('change', createTypingsForFileOnWatch(creator, cache, argv.v));
  }
};

main();
