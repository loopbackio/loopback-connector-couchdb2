// Copyright IBM Corp. 2017,2019. All Rights Reserved.
// Node module: loopback-connector-couchdb2
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

'use strict';
var should = require('should');

if (!process.env.COUCHDB2_TEST_SKIP_INIT) {
  require('./init.js');
}

describe('connectivity', function() {
  var db;
  before(setUpDataSource);

  describe('ping()', function() {
    context('with a valid connection', function() {
      it('returns true', function(done) {
        db.ping(done);
      });
    });
    context('with an invalid connection', function() {
      it('returns error with fake url', function(done) {
        var fakeConfig = {
          url: 'http://fake:foo@localhost:4',
        };
        var fakeDB = global.getDataSource(fakeConfig);
        fakeDB.ping(function(err) {
          should.exist(err);
          err.message.should.equal('ping failed');
          done();
        });
      });
    });
  });

  function setUpDataSource() {
    db = global.getDataSource();
  }
});
