'use strict';
var fs = require('fs');
var stripJsonComments = require('strip-json-comments');

module.exports = function() {
    var readTextFile = function(filename) {
        var body = fs.readFileSync(filename, 'utf8');
        return body;
    };

    var readJsonFile = function(filename) {
        var body = readTextFile(filename);
        return JSON.parse(stripJsonComments(body));
    };

    var githubUserMock = {
        user: 'thaiat',
        name: 'Avi Haiat',
        email: 'imp@yoobic.com',
        html_url: 'https://github.com/imp'
    };

    var githubMock = function() {
        return {
            user: {
                getFrom: function(data, cb) {
                    var err = null;
                    var res = githubUserMock;
                    cb(err, res);
                }
            }
        };
    };

    var childProcessMock = {

        exec: function(cmd, cb) {
            console.log('exec : ' + cmd);
            if(cmd == 'cat ~/.npmrc | grep \'email\'') {
                cb(null, 'email=' + githubUserMock.email);
            } else if(cmd == 'cat ~/.npmrc | grep \'_auth\'') {
                cb(null, '_auth=dxxsdsdfsd');
            } else {
                cb(null, '');
            }
        },
        spawn: function(cmd) {
            console.log('exec : ' + cmd);
            return {
                on: function(name, cb) {
                    cb();
                }
            };
        }

    };

    var npmMock = {
        load: function(cb) {
            cb(null, this);
        },
        login: function(cb) {
            cb();
        }
    };

    var startMock = function(mockery) {
        mockery.enable({
            warnOnUnregistered: false,
            useCleanCache: true
        });
    };

    var endMock = function(mockery) {
        mockery.disable();
    };

    return {
        readTextFile: readTextFile,
        readJsonFile: readJsonFile,
        githubUserMock: githubUserMock,
        githubMock: githubMock,
        childProcessMock: childProcessMock,
        npmMock: npmMock,
        startMock: startMock,
        endMock: endMock
    };

};