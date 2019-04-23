// Copyright IBM Corp. 2017,2019. All Rights Reserved.
// Node module: loopback-connector-couchdb2
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

// Comment test cases to get CI pass,
// will recover them when CI config done

'use strict';

describe('CouchDB2 imported features', function() {
  before(function() {
    global.IMPORTED_TEST = true;
  });
  after(function() {
    global.IMPORTED_TEST = false;
  });

  require('loopback-datasource-juggler/test/include.test.js');
  require('loopback-datasource-juggler/test/common.batch.js');
});
