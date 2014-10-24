'use strict';
var path = require('path');
var yeoman = require('yeoman-generator');
var _ = require('lodash');
var chalk = require('chalk');

var GulpsGenerator = yeoman.generators.Base.extend({

    constructor: function() {

        yeoman.generators.Base.apply(this, arguments);
        this.allTasks = [
            'lint',
            'serve',
            'browserify',
            'release',
            'changelog',
            'test',
            'style'
        ];

        this.option('ionic', {
            desc: 'ionic',
            type: 'Boolean',
            defaults: false
        });
        this.option('famous', {
            desc: 'famo.us',
            type: 'Boolean',
            defaults: false
        });
        this.option('fontawesome', {
            desc: 'font-awseome',
            type: 'Boolean',
            defaults: false
        });
        this.option('boostrap', {
            desc: 'bootstrap',
            type: 'Boolean',
            defaults: false
        });

        _.forEach(this.allTasks, function(task) {
            this.option(task, {
                desc: task,
                type: 'Boolean'
            });
        }.bind(this));

        this.appname = this.appname || path.basename(process.cwd());
        this.appname = this._.slugify(this._.humanize(this.appname));
    },

    initializing: function() {

        this.pkg = require('../package.json');

        var pkgDest = {};
        try {
            pkgDest = this.dest.readJSON('package.json');
        } catch(e) {}

        this.pkgDest = pkgDest;

        this.ionic = this.options.ionic;
        this.famous = this.options.famous;
        this.fontawesome = this.options.fontawesome;
        this.bootstrap = this.options.bootstrap;

        _.forEach(this.allTasks, function(task) {
            this[task] = this.options[task];
        }.bind(this));

        this._buildCssList();
        this._buildFontsList();
    },

    _buildCssList: function() {
        var css = [];
        if(this.famous) {
            //css.push('\'./bower_components/famous/famous.css\'');
            css.push('\'./bower_components/famous-angular/dist/famous-angular.css\'');
        }
        if(this.bootstrap) {
            css.push('\'./bower_components/bootstrap/dist/bootstrap.css\'');
            css.push('\'./bower_components/bootstrap/dist/bootstrap-theme.css\'');
        }
        css = css.length > 0 ? css : ['\'\''];
        this.css = '[' + css.join(', ') + ']';

    },

    _buildFontsList: function() {
        var fonts = [];
        if(this.ionic) {
            fonts.push('\'./bower_components/ionic/release/fonts/*.*\'');
        }
        if(this.fontawesome) {
            fonts.push('\'./bower_components/font-awesome/fonts/*.*\'');
        }
        if(this.bootstrap) {
            fonts.push('\'./bower_components/bootstrap/dist/fonts/*.*\'');
        }
        fonts = fonts.length > 0 ? fonts : [];
        this.fonts = '[' + fonts.join(', ') + ']';
    },

    prompting: {

        askFor: function() {

            var done = this.async();
            var that = this;
            var choices = this.allTasks.map(function(task) {
                return {
                    name: task,
                    value: task,
                    checked: false
                };
            });
            var hasTaskOption = false;
            _.forEach(that.allTasks, function(task) {
                if(that.options[task] === true) {
                    hasTaskOption = true;
                }
            });

            var prompts = [{
                type: 'checkbox',
                name: 'Tasks',
                message: 'What gulp tasks do you need ?',
                when: function() {
                    return !hasTaskOption;
                },
                choices: choices
            }, {
                name: 'Repository',
                message: 'What is the url of your repository ?',
                default: 'https://github.com/user/repo',
                when: function(answers) {
                    var values = answers.Tasks;
                    return _.contains(values, 'changelog') || that.options.changelog === true;
                }
            }];

            this.prompt(prompts, function(answers) {
                this.Tasks = answers.Tasks = [].concat(answers.Tasks);
                this.Repository = answers.Repository;

                var hasListOption = function(list, option) {
                    return answers[list].indexOf(option) !== -1;
                };

                choices.forEach(function(choice) {
                    if(this[choice.value] === undefined) {
                        this[choice.value] = hasListOption('Tasks', choice.value);
                    }
                }.bind(this));

                done();
            }.bind(this));
        }
    },

    writing: {
        projectFiles: function() {
            this.npmPackages = null;
            var done = this.async();
            if(this.Tasks.length <= 0) {
                this.log(chalk.bold.yellow('You didn\'t select any gulp task'));
                done();
                return;
            }

            var npmPackages = [
                'gulp',
                'gulp-help',
                'gulp-util',
                'gulp-load-plugins',
                'require-dir',
                'run-sequence'
            ];

            this.sourceRoot(path.join(__dirname, '../templates/gulps'));

            this.template('gulpfile.js', 'gulpfile.js');
            this.template('common/constants.js', 'gulp/common/constants.js');

            if(this.lint || this.test) {
                this.template('tasks/lint.js', 'gulp/tasks/lint.js');
                npmPackages = npmPackages.concat([
                    'map-stream',
                    'stream-combiner',
                    'chalk',
                    'growly',
                    'lodash',
                    'gulp-jshint',
                    'gulp-jscs',
                    'gulp-eslint',
                    'gulp-plumber'
                ]);
            }
            if(this.serve) {
                this.template('tasks/serve.js', 'gulp/tasks/serve.js');
                npmPackages = npmPackages.concat([
                    'gulp-webserver',
                    'browser-sync',
                    'open',
                    'chalk'
                ]);
            }
            if(this.browserify) {
                this.template('tasks/browserify.js', 'gulp/tasks/browserify.js');
                npmPackages = npmPackages.concat([
                    'vinyl-source-stream',
                    'browserify',
                    'watchify',
                    'chalk'
                ]);
            }

            if(this.release) {
                this.template('tasks/release.js', 'gulp/tasks/release.js');
                npmPackages = npmPackages.concat([
                    'yargs',
                    'strip-json-comments',
                    'gulp-bump',
                    'gulp-git',
                    'gulp-if'
                ]);
            }

            if(this.changelog) {
                this.template('tasks/changelog.js', 'gulp/tasks/changelog.js');
                npmPackages = npmPackages.concat([
                    'conventional-changelog',
                    'yargs',
                    'marked',
                    'q',
                    'gulp-exec',
                    'gulp-concat',
                    'streamqueue'
                ]);
            }
            if(this.test) {
                this.template('tasks/test.js', 'gulp/tasks/test.js');
                npmPackages = npmPackages.concat([
                    'lodash',
                    'gulp-mocha',
                    'gulp-istanbul',
                    'gulp-plumber',
                    'chalk',
                    'gulp-karma',
                    'mocha',
                    'mocha-lcov-reporter',
                    'sinon',
                    'chai',
                    'gulp-protractor'
                ]);
            }

            if(this.style) {
                this.template('tasks/style.js', 'gulp/tasks/style.js');
                npmPackages = npmPackages.concat([
                    'event-stream',
                    'gulp-sass',
                    'gulp-sourcemaps',
                    'gulp-autoprefixer',
                    'gulp-minify-css',
                    'gulp-rename',
                    'gulp-concat',
                    'gulp-size'
                ]);
            }

            this.npmPackages = _.uniq(npmPackages);
            done();
        }

    },

    install: function() {

        if(!this.npmPackages) {
            return;
        }
        var done = this.async();
        this.npmInstall(this.npmPackages, {
            'saveDev': true
        }, done);
    },

    end: function() {
        this.log('');
        this.log(chalk.green('Woot!') + ' It appears that everything installed correctly.');
        if(this.lint) {
            this.log('Run the command ' + chalk.yellow('gulp lint') + ' to lint your files.');

        }
        if(this.serve) {
            this.log('Run the command ' + chalk.yellow('gulp serve') + ' to launch a live reload server.');
            this.log('Run the command ' + chalk.yellow('gulp browsersync') + ' to launch a browsersync server.');

        }
        if(this.browserify) {
            this.log('Run the command ' + chalk.yellow('gulp browserify') + ' to create a browserify bundle.');

        }
        if(this.release) {
            this.log('Run the command ' + chalk.yellow('gulp release') + ' to increment version and publish to npm.');

        }
        if(this.changelog) {
            this.log('Run the command ' + chalk.yellow('gulp changelog') + ' to create a CHANGELOG.md file.');
        }
        if(this.test) {
            this.log('Run the command ' + chalk.yellow('gulp test') + ' to run the tests.');
        }
        if(this.style) {
            this.log('Run the command ' + chalk.yellow('gulp sass') + ' to compile sass file.');
        }
    }

});

module.exports = GulpsGenerator;