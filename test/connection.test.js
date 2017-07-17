// Copyright IBM Corp. 2017. All Rights Reserved.
// Node module: loopback-connector-couchdb2
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

'use strict';
var describe = require('./describe.js');

describe('connectivity', function() {
  var db;
  before(setUpDataSource);

  describe('ping()', function() {
    context('with a valid connection', function() {
      it('returns true', function(done) {
        db.ping(done);
      });
    });
  });

  function setUpDataSource() {
    db = getDataSource();
  }
});
