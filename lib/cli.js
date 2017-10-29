#!/usr/bin/env node


'use strict';

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _chokidar = require('chokidar');

var _chokidar2 = _interopRequireDefault(_chokidar);

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

var yarg = _yargs2.default.usage('Create .css.d.ts from CSS modules *.css files.\nUsage: $0 [options] <input directory>').example('$0 src/styles').example('$0 src -o dist').example('$0 -p styles/**/*.icss -w').detectLocale(false).demand(['_']).alias('c', 'camelCase').describe('c', 'Convert CSS class tokens to camelcase').alias('o', 'outDir').describe('o', 'Output directory').alias('p', 'pattern').describe('p', 'Glob pattern with css files').alias('w', 'watch').describe('w', 'Watch input directory\'s css files or pattern').boolean('w').alias('d', 'dropExtension').describe('d', 'Drop the input files extension').boolean('d').alias('h', 'help').help('h').version(function () {
    return require('../package.json').version;
});
var argv = yarg.argv;
var creator = void 0;

function writeFile(f) {
    getSource(f).then(function (content) {
        creator.create(f, content, !!argv.w).then(function (content) {
            return content.writeFile();
        }).then(function (content) {
            console.log('Wrote ' + _chalk2.default.green(content.outputFilePath));
            content.messageList.forEach(function (message) {
                console.warn(_chalk2.default.yellow('[Warn] ' + message));
            });
        }).catch(function (reason) {
            return console.error(_chalk2.default.red('[Error] ' + reason));
        });
    });
};

function getSource(file, relativeTo) {
    return new Promise(function (resolve, reject) {
        _nodeSass2.default.render({ file: file }, function (err, result) {
            if (err && relativeTo && relativeTo !== '/') {
                return resolve([]);
            }

            if (err && (!relativeTo || relativeTo === '/')) {
                return reject(err);
            }

            resolve(result.css.toString());
        });
    });
}

var main = function main() {
    var rootDir = void 0,
        searchDir = void 0;
    if (argv.h) {
        yarg.showHelp();
        return;
    }

    if (argv._ && argv._[0]) {
        searchDir = argv._[0];
    } else if (argv.p) {
        searchDir = './';
    } else {
        yarg.showHelp();
        return;
    }
    var filesPattern = _path2.default.join(searchDir, argv.p || '**/*.css');
    rootDir = process.cwd();
    creator = new _typedCssModules2.default({
        rootDir: rootDir,
        searchDir: searchDir,
        outDir: argv.o,
        camelCase: argv.c,
        dropExtension: argv.d
    });

    if (!argv.w) {
        (0, _glob2.default)(filesPattern, null, function (err, files) {
            if (err) {
                console.error(err);
                return;
            }
            if (!files || !files.length) return;
            files.forEach(writeFile);
        });
    } else {
        console.log('Watch ' + filesPattern + '...');

        var watcher = _chokidar2.default.watch(filesPattern);
        watcher.on('add', writeFile);
        watcher.on('change', writeFile);
    }
};

main();