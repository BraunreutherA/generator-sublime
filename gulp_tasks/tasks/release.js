'use strict';

var _ = require('lodash');
var path = require('path');
var gulp = require('gulp');
var args = require('yargs').argv;
var $ = require('gulp-load-plugins')();
var exec = require('child_process').exec;
var fs = require('fs');
var stripJsonComments = require('strip-json-comments');
var bump = $.bump;
var tap = $.tap;
var XML = require('node-jsxml').XML;
var git = $.git;
var gulpif = $.if;
var gutil = require('gulp-util');
var GitHubApi = require('github');
var runSequence = require('run-sequence').use(gulp);
var del = require('del');
var inquirer = require('inquirer');
var helper = require('../common/helper');
var constants = require('../common/constants')();

var github = {};

/**
 * Bumps any version in the constants.versionFiles
 *
 * USAGE:
 * gulp bump --minor (or --major or --prerelease or --patch which is the default)
 * - or -
 * gulp bump --ver=1.2.3
 * @param {function} cb - The gulp callback
 * @returns {void}
 */
gulp.task('bump', false, function(cb) {
    var bumpType = 'patch';
    // major.minor.patch
    if(args.patch) {
        bumpType = 'patch';
    }
    if(args.minor) {
        bumpType = 'minor';
    }
    if(args.major) {
        bumpType = 'major';
    }
    if(args.prerelease) {
        bumpType = 'prerelease';
    }
    bumpType = process.env.BUMP || bumpType;

    var version;
    var srcjson = helper.filterFiles(constants.versionFiles, '.json');
    var srcxml = helper.filterFiles(constants.versionFiles, '.xml');

    // first we bump the json files
    gulp.src(srcjson)
        .pipe(gulpif(args.ver !== undefined, bump({
            version: args.ver
        }), bump({
            type: bumpType
        })))
        .pipe(tap(function(file) {
            if(!version) {
                var json = JSON.parse(String(file.contents));
                version = json.version;
            }
        }))
        .pipe(gulp.dest('./'))
        .on('end', function() {
            // then after we have the correct value for version, we take care of the xml files
            if(srcxml.length > 0) {
                gulp.src(srcxml)
                    .pipe(tap(function(file) {
                        var xml = new XML(String(file.contents));
                        xml.attribute('version').setValue(version);
                        file.contents = Buffer.concat([new Buffer(xml.toXMLString())]);
                    }))
                    .pipe(gulp.dest('./' + constants.clientFolder))
                    .on('end', function() {
                        cb();
                    });
            } else {
                cb();
            }

        });

});

gulp.task('commit', false, ['bump'], function() {
    var pkg = helper.readJsonFile('./package.json');
    var message = 'docs(changelog): version ' + pkg.version;
    return gulp.src(constants.versionFiles)
        .pipe(git.add({
            args: '.'
        }))
        .pipe(git.commit(message));
});

gulp.task('tag', false, ['commit'], function(cb) {
    var pkg = helper.readJsonFile('./package.json');
    var v = 'v' + pkg.version;
    var message = pkg.version;
    git.tag(v, message, function(err) {
        if(err) {
            throw new Error(err);
        }
        cb();
    });
});

gulp.task('push', false, ['tag'], function(cb) {
    exec('git push origin master  && git push origin master --tags', function(err) {
        if(err) {
            throw new Error(err);
        }
        cb();
    });
});

// gulp.task('npm', ['push'], function(done) {
//     spawm('npm', ['publish'], {
//         stdio: 'inherit'
//     }).on('close', done);
// });

gulp.task('release', 'Publish a new release version.', ['push']);

gulp.task('githubAuth', false, function(cb) {
    github = new GitHubApi({
        version: '3.0.0',
        // use `--ghDebug` command line flag to display github api debug messages.
        debug: args.ghDebug,
        protocol: 'https',
        timeout: 5000
    });

    // var username;

    var questions = {
        username: function(def, message, when) {
            message = message ? message + ' ' : '';
            return {
                type: 'input',
                message: message + gutil.colors.bgCyan('GitHub username'),
                name: 'username',
                default: def,
                validate: function(input) {
                    return input !== '';
                }
            };
        },
        password: function(message, when) {
            message = message ? message + ' ' : '';
            return {
                type: 'password',
                message: message + gutil.colors.bgCyan('GitHub password'),
                name: 'password',
                validate: function(input) {
                    return input !== '';
                }
            };
        }
    };

    var inquire = function(username, badAuth, answers, cb) {
        var askPrefix;
        var output = [];
        if(badAuth) {
            gutil.log(gutil.colors.red('BAD AUTHORIZATION REQUEST!\n'));
            askPrefix = gutil.colors.cyan('Please re-enter your');
            output = output.concat([{
                    type: 'confirm',
                    message: 'Do you want to try again?',
                    name: 'retry'
                },
                questions.username(false, askPrefix),
                questions.password(askPrefix)
            ]);
        } else {
            askPrefix = gutil.colors.cyan('Please enter your');
            if(!username) {
                output.push(questions.username(false, askPrefix));
            }
            output.push(questions.password(askPrefix));
        }

        inquirer.prompt(output,
            function(answers) {
                if(!answers.password) {
                    gutil.log(gutil.colors.red('Unable to authenticate. Exiting.'));
                    throw new Error('User aborted GitHub authentication.');
                }
                github.authenticate({
                    type: 'basic',
                    username: answers.username || username,
                    password: answers.password
                });
                github.misc.rateLimit({}, function(err, res) {
                    if(err) {
                        inquire(false, true, answers, cb);
                    } else {
                        cb();
                    }
                });
            });
    };

    git.exec({
        args: 'config --get user.email'
    }, function(err, email) {
        if(err) {
            throw new Error(err);
        }
        github.search.users({
            q: email + 'in:email'
        }, function(err, res) {
            if(err) {
                throw new Error(err);
            } else if(res.items.length === 0) {
                inquire(false, false, {}, cb);
            } else {
                inquire(res.items[0].login, false, {}, cb);
            }
        });
    });
});
gulp.task('release:createRelease', false, function(cb) {

    var pkg = helper.readJsonFile('./package.json');
    var v = 'v' + pkg.version;
    var message = pkg.version;
    var ownerRepo = constants.repository.split('/').slice(-2);

    return gulp.src('CHANGELOG.md')
        .pipe(tap(function(file) {
            var body = file.contents.toString();
            body = body.slice(body.indexOf('###'));
            var msg = {
                owner: ownerRepo[0],
                repo: ownerRepo[1],
                tag_name: v,
                name: v + ': version ' + message,
                body: body
            };
            github.releases.createRelease(msg, function(err, res) {
                if(err) {
                    gutil.log(gutil.colors.red('Error: ' + err));
                } else {
                    del('CHANGELOG.md');
                }
            });
        }));
});

gulp.task('release:full', 'Publish a new release version.', function() {
    return runSequence('changelog', 'push', 'githubAuth', 'release:createRelease');
});