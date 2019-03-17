#!/usr/bin/env node
"use strict";

var _typedCssModules = _interopRequireDefault(require("typed-css-modules"));

var _chalk = _interopRequireDefault(require("chalk"));

var _chokidar = _interopRequireDefault(require("chokidar"));

var _cosmiconfig = _interopRequireDefault(require("cosmiconfig"));

var _fs = _interopRequireDefault(require("fs"));

var _glob = _interopRequireDefault(require("glob"));

var _path = _interopRequireDefault(require("path"));

var _nodeSass = _interopRequireDefault(require("node-sass"));

var _yargs = _interopRequireDefault(require("yargs"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var pkg = require('../package.json');

var sassConfig = function () {
  var rc = (0, _cosmiconfig.default)('sass').searchSync();
  return rc === null ? {} : rc.config;
}();

var readSass = function readSass(pathName, relativeTo) {
  return new Promise(function (resolve, reject) {
    _nodeSass.default.render(Object.assign({}, sassConfig, {
      file: pathName
    }), function (err, result) {
      if (err && relativeTo && relativeTo !== '/') {
        return resolve([]);
      } else if (err && (!relativeTo || relativeTo === '/')) {
        return reject(err);
      }

      return resolve(result.css.toString());
    });
  });
};

var createTypings = function createTypings(pathName, creator, cache, handleError, handleWarning, verbose) {
  return readSass(pathName).then(function (content) {
    return creator.create(pathName, content, cache);
  }).then(function (c) {
    return c.writeFile();
  }).then(function (c) {
    if (verbose) {
      console.info("Created ".concat(_chalk.default.green(c.outputFilePath)));
    }

    c.messageList.forEach(function (message) {
      var warningTitle = _chalk.default.yellow("WARNING: ".concat(pathName));

      var warningInfo = message;
      handleWarning("".concat(warningTitle, "\n").concat(warningInfo));
    });
    return c;
  }).catch(function (reason) {
    var errorTitle = _chalk.default.red("ERROR: ".concat(pathName));

    var errorInfo = reason;
    handleError("".concat(errorTitle, "\n").concat(errorInfo));
  });
};

var createTypingsForFileOnWatch = function createTypingsForFileOnWatch(creator, cache, verbose) {
  return function (pathName) {
    var warnings = 0;
    var errors = 0;

    var handleError = function handleError(error) {
      console.error(error);
      errors += 1;
    };

    var handleWarning = function handleWarning(warning) {
      console.warn(warning);
      warnings += 1;
    };

    var onComplete = function onComplete() {
      if (warnings + errors > 0) {
        console.info("".concat(pathName, ": ").concat(warnings, " warnings, ").concat(errors, " errors"));
      }

      warnings = 0;
      errors = 0;
    };

    return createTypings(pathName, creator, cache, handleError, handleWarning, verbose).then(onComplete);
  };
};

var createTypingsForFiles = function createTypingsForFiles(creator, cache, verbose) {
  return function (pathNames) {
    var warnings = 0;
    var errors = 0;

    var handleError = function handleError(error) {
      console.error(error);
      errors += 1;
    };

    var handleWarning = function handleWarning(warning) {
      console.warn(warning);
      warnings += 1;
    };

    var onComplete = function onComplete() {
      if (warnings + errors > 0) {
        console.info("Completed with ".concat(warnings, " warnings and ").concat(errors, " errors."));
      }

      errors = 0;
      warnings = 0;
    };

    return Promise.all(pathNames.map(function (pathName) {
      return createTypings(pathName, creator, cache, handleError, handleWarning, verbose);
    })).then(onComplete);
  };
};

var main = function main() {
  var yarg = _yargs.default.usage('$0 [inputDir] [options]', 'Create .scss.d.ts from CSS modules *.scss files.', function (commandYargs) {
    commandYargs.positional('inputDir', {
      describe: 'Directory to search for scss files.',
      type: 'string',
      default: '.'
    }).example('$0 src/styles').example('$0 src -o dist').example('$0 -p styles/**/*.scss -w');
  }).detectLocale(false).version(pkg.version).option('c', {
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
  }).option('i', {
    alias: 'ignore',
    describe: 'Glob pattern for files that should be ignored'
  }).alias('h', 'help').help('h');

  var argv = yarg.argv; // Show help

  if (argv.h) {
    yarg.showHelp();
    return;
  }

  var searchDir = argv.inputDir; // Show help if no search diretory present

  if (searchDir === undefined) {
    yarg.showHelp();
    return;
  } // If search directory doesn't exits, exit


  if (!_fs.default.existsSync(searchDir)) {
    console.error(_chalk.default.red("Error: Input directory ".concat(searchDir, " doesn't exist.")));
    return;
  }

  var filesPattern = _path.default.join(searchDir, argv.p);

  var rootDir = process.cwd();
  var creator = new _typedCssModules.default({
    rootDir: rootDir,
    searchDir: searchDir,
    outDir: argv.o,
    camelCase: argv.c,
    dropExtension: argv.d
  });
  var cache = !!argv.w;

  if (!argv.w) {
    var globOptions = argv.i ? {
      ignore: argv.i
    } : null;
    (0, _glob.default)(filesPattern, globOptions, function (err, pathNames) {
      if (err) {
        console.error(err);
        return;
      } else if (!pathNames || !pathNames.length) {
        console.info('Creating typings for 0 files');
        return;
      }

      console.info("Creating typings for ".concat(pathNames.length, " files\n"));
      createTypingsForFiles(creator, cache, argv.v)(pathNames);
    });
  } else {
    console.info("Watching ".concat(filesPattern, " ...\n"));
    var chokidarOptions = argv.i ? {
      ignored: argv.i
    } : null;

    var watcher = _chokidar.default.watch(filesPattern, chokidarOptions);

    watcher.on('add', createTypingsForFileOnWatch(creator, cache, argv.v));
    watcher.on('change', createTypingsForFileOnWatch(creator, cache, argv.v));
  }
};

main();