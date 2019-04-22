// Copyright IBM Corp. 2018,2019. All Rights Reserved.
// Node module: loopback-connector-couchdb2
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

// Comment test cases to get CI pass,
// will recover them when CI config done

'use strict';

var should = require('should');
var db;

if (!process.env.COUCHDB2_TEST_SKIP_INIT) {
  require('./init.js');
}

describe('CouchDB2 regexToPCRE', function() {
  before(function() {
    db = global.getSchema();
  });

  it('return regular expression string', function() {
    db.connector._regexToPCRE('b', false).should.equal('b');
  });

  it('return regular expression string as a negitive lookahead', function() {
    db.connector._regexToPCRE('b', true).should.equal('[^b]');
  });

  it('return a pcre compliant regular expression', function() {
    db.connector._regexToPCRE(/b/, false).should.equal('b');
  });

  it('return flags mapped to pcre syntax', function() {
    db.connector._regexToPCRE(/b/im, false).should.equal('(?im)b');
  });

  it('return flags mapped to pcre syntax - negative as false', function() {
    db.connector._regexToPCRE(/b/i, false).should.equal('(?i)b');
  });

  it('return flags mapped to pcre syntax - negative as true', function() {
    db.connector._regexToPCRE(/b/i, true).should.equal('(?i)[^b]');
  });
});
