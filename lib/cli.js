#!/usr/bin/env node
'use strict';

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _chokidar = require('chokidar');

var _chokidar2 = _interopRequireDefault(_chokidar);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _glob = require('glob');

var _glob2 = _interopRequireDefault(_glob);

var _yargs = require('yargs');

var _yargs2 = _interopRequireDefault(_yargs);

var _chalk = require('chalk');

var _chalk2 = _interopRequireDefault(_chalk);

var _typedCssModules = require('typed-css-modules');

var _typedCssModules2 = _interopRequireDefault(_typedCssModules);

var _nodeSass = require('node-sass');

var _nodeSass2 = _interopRequireDefault(_nodeSass);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var pkg = require('../package.json');

var readSass = function readSass(file, relativeTo) {
  return new Promise(function (resolve, reject) {
    _nodeSass2.default.render({ file: file }, function (err, result) {
      if (err && relativeTo && relativeTo !== '/') {
        return resolve([]);
      } else if (err && (!relativeTo || relativeTo === '/')) {
        return reject(err);
      }
      return resolve(result.css.toString());
    });
  });
};

var createTypings = function createTypings(f, creator, cache, handleError, handleWarning, verbose) {
  return readSass(f).catch(function (reason) {
    handleError(_chalk2.default.red(f) + '\n' + reason + '\n');
  }).then(function (content) {
    return creator.create(f, content, cache);
  }).then(function (c) {
    return c.writeFile();
  }).then(function (c) {
    if (verbose) {
      console.info('Created ' + _chalk2.default.green(c.outputFilePath));
    }
    c.messageList.forEach(function (message) {
      handleWarning(_chalk2.default.yellow(f) + '\nWarning: ' + message + '\n');
    });
    return c;
  }).catch(function (reason) {
    handleError(_chalk2.default.red(f) + '\nError: ' + reason + '\n');
  });
};

var createTypingsForFileOnWatch = function createTypingsForFileOnWatch(creator, cache, verbose) {
  return function (f) {
    var warnings = [];
    var errors = [];

    var cleanUp = function cleanUp() {
      warnings.forEach(function (m) {
        return console.warn(m);
      });
      errors.forEach(function (e) {
        return console.error(e);
      });
      errors = [];
      warnings = [];
    };

    var handleError = function handleError(e) {
      errors.push(e);
    };
    var handleWarning = function handleWarning(w) {
      warnings.push(w);
    };
    return createTypings(f, creator, cache, handleError, handleWarning, verbose).then(cleanUp);
  };
};

var createTypingsForFiles = function createTypingsForFiles(creator, cache, verbose) {
  return function (files) {
    var errors = [];
    var warnings = [];

    var cleanUp = function cleanUp() {
      warnings.forEach(function (m) {
        return console.warn(m);
      });
      errors.forEach(function (e) {
        return console.error(e);
      });
      if (warnings.length + errors.length > 0) {
        console.info('Completed with ' + warnings.length + ' warnings and ' + errors.length + ' errors.');
      }
      errors = [];
      warnings = [];
    };

    var handleError = function handleError(e) {
      errors.push(e);
    };
    var handleWarning = function handleWarning(w) {
      warnings.push(w);
    };

    var mapper = function mapper(f) {
      return createTypings(f, creator, cache, handleError, handleWarning, verbose);
    };

    return Promise.all(files.map(mapper)).then(cleanUp);
  };
};

var main = function main() {
  var yarg = _yargs2.default.usage('Create .scss.d.ts from CSS modules *.scss files.\nUsage: $0 [options] <input directory>').example('$0 src/styles').example('$0 src -o dist').example('$0 -p styles/**/*.scss -w').detectLocale(false).version(pkg.version).demandCommand(1, 1, 'Input directory must be specified', 'Only one input directory must be specified').option('c', {
    alias: 'camelCase',
    default: false,
    type: 'boolean',
    describe: 'Convert CSS class tokens to camelCase'
  }).option('o', {
    alias: 'outDir',
    describe: 'Output directory'
  }).option('p', {
    alias: 'pattern',
    default: '**/[^_]*.scss',
    describe: 'Glob pattern with scss files'
  }).option('w', {
    alias: 'watch',
    default: false,
    type: 'boolean',
    describe: 'Watch input directory\'s scss files or pattern'
  }).option('d', {
    alias: 'dropExtension',
    default: false,
    type: 'boolean',
    describe: 'Drop the input files extension'
  }).option('v', {
    alias: 'verbose',
    default: false,
    type: 'boolean',
    describe: 'Show verbose message'
  }).alias('h', 'help').help('h');

  var argv = yarg.argv;

  // Show help

  if (argv.h) {
    yarg.showHelp();
    return;
  }

  var searchDir = String(argv._[0]) || './';
  // Show help if no search diretory present
  if (searchDir === undefined) {
    yarg.showHelp();
    return;
  }

  // If search directory doesn't exits, exit
  if (!_fs2.default.existsSync(searchDir)) {
    console.error(_chalk2.default.red('Error: Input directory ' + searchDir + ' doesn\'t exist.'));
    return;
  }

  var filesPattern = _path2.default.join(searchDir, argv.p);

  var rootDir = process.cwd();

  var creator = new _typedCssModules2.default({
    rootDir: rootDir,
    searchDir: searchDir,
    outDir: argv.o,
    camelCase: argv.c,
    dropExtension: argv.d
  });

  var cache = !!argv.w;

  if (!argv.w) {
    (0, _glob2.default)(filesPattern, null, function (err, files) {
      if (err) {
        console.error(err);
        return;
      } else if (!files || !files.length) {
        console.info('Creating typings for 0 files');
        return;
      }
      console.info('Creating typings for ' + files.length + ' files\n');
      createTypingsForFiles(creator, cache, argv.v)(files);
    });
  } else {
    console.info('Watching ' + filesPattern + ' ...\n');

    var watcher = _chokidar2.default.watch(filesPattern);
    watcher.on('add', createTypingsForFileOnWatch(creator, cache, argv.v));
    watcher.on('change', createTypingsForFileOnWatch(creator, cache, argv.v));
  }
};

main();