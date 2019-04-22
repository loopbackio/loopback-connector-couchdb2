// Copyright IBM Corp. 2017,2019. All Rights Reserved.
// Node module: loopback-connector-couchdb2
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

'use strict';

var db, AutoupdateTestFoo, connector;
var async = require('async');
var _ = require('lodash');
var util = require('util');
var EXPECTED_INDEXES = {};

describe('CouchDB autoupdate', function() {
  before(function(done) {
    db = global.getDataSource();
    var testModelDef = getTestModelDef();
    AutoupdateTestFoo = db.define('AutoupdateTestFoo', testModelDef.properties,
      testModelDef.config);
    connector = db.connector;
    db.autoupdate(done);
  });

  it('autoupdate creates indexes when model first created', function(done) {
    connector.getModelIndexes('AutoupdateTestFoo', function(err, result) {
      if (err) return done(err);
      Object.keys(result).length.should.equal(4);

      // result should contain 'name' 'age' 'email' 'loopback__model__name' index
      EXPECTED_INDEXES = getExpectedIndexesForFirstCreatedModel();
      async.eachOf(result, assertIndex, done);
    });
  });

  it('autoupdate drops and adds indexes', function(done) {
    // Drop age, name indexes.
    // Add postcode, fullName indexes.
    // Keep email
    var newTestModelDef = getNewTestModelDef();

    AutoupdateTestFoo = db.define('AutoupdateTestFoo', newTestModelDef.properties,
      newTestModelDef.config);
    connector = db.connector;

    db.autoupdate(function(err) {
      if (err) return done(err);
      connector.getModelIndexes('AutoupdateTestFoo', function(err, result) {
        if (err) return done(err);
        // result should contain 'email', 'fullName_index', 'postcode', 'loopback__model__name'
        // should not contain 'age', 'name_index'
        Object.keys(result).length.should.equal(4);
        EXPECTED_INDEXES = getExpectedIndexesForUpdatedModel();
        async.eachOf(result, assertIndex, done);
      });
    });
  });
});

function getTestModelDef() {
  return {
    properties: {
      email: {type: 'string', index: true},
      age: {type: 'number', index: true},
      firstName: {type: 'string'},
      lastName: {type: 'string'},
    },
    config: {
      indexes: {
        'name_index': {
          keys: {
            firstName: 1,
            lastName: 1,
          },
        },
      },
    },
  };
}

function getNewTestModelDef() {
  return {
    properties: {
      email: {type: 'string', index: true},
      age: {type: 'number'},
      postcode: {type: 'string', index: true},
      firstName: {type: 'string'},
      middleName: {type: 'string'},
      lastName: {type: 'string'},
    },
    config: {
      indexes: {
        'fullName_index': {
          keys: {
            firstName: 1,
            middleName: 1,
            lastName: 1,
          },
        },
      },
    },
  };
}

function getExpectedIndexesForFirstCreatedModel() {
  /* eslint camelcase: ["error", {properties: "never"}] */
  var result = {
    age_index: {
      ddoc: '_design/LBModel__AutoupdateTestFoo__LBIndex__age_index',
      fields: [{age: 'asc'}],
    },
    email_index: {
      ddoc: '_design/LBModel__AutoupdateTestFoo__LBIndex__email_index',
      fields: [{email: 'asc'}],
    },
    name_index: {
      ddoc: '_design/LBModel__AutoupdateTestFoo__LBIndex__name_index',
      fields: [{firstName: 'asc'}, {lastName: 'asc'}],
    },
    loopback__model__name_index: {
      ddoc: '_design/LBModel__AutoupdateTestFoo__LBIndex__loopback__model__name_index',
      fields: [{loopback__model__name: 'asc'}],
    },
  };
  return result;
}

function getExpectedIndexesForUpdatedModel() {
  var result = {
    postcode_index: {
      ddoc: '_design/LBModel__AutoupdateTestFoo__LBIndex__postcode_index',
      fields: [{postcode: 'asc'}],
    },
    email_index: {
      ddoc: '_design/LBModel__AutoupdateTestFoo__LBIndex__email_index',
      fields: [{email: 'asc'}],
    },
    fullName_index: {
      ddoc: '_design/LBModel__AutoupdateTestFoo__LBIndex__fullName_index',
      fields: [{firstName: 'asc'}, {lastName: 'asc'}, {middleName: 'asc'}],
    },
    loopback__model__name_index: {
      ddoc: '_design/LBModel__AutoupdateTestFoo__LBIndex__loopback__model__name_index',
      fields: [{loopback__model__name: 'asc'}],
    },
  };
  return result;
}

function assertIndex(value, key, cb) {
  EXPECTED_INDEXES[key].should.exist;
  checkDdocname(key, value.ddoc);
  checkFields(key, value.fields);
  cb();
}

function checkDdocname(key, ddocName) {
  EXPECTED_INDEXES[key].ddoc.should.equal(ddocName);
}

function checkFields(key, fields) {
  arrayEqual(EXPECTED_INDEXES[key].fields, fields);
};

function arrayEqual(expect, actual) {
  var notEqualMsg = util.inspect(expect, 4) + ' is not equal to ' +
    util.inspect(actual, 4);
  for (var item in expect) {
    var cond = expect[item];
    var i = _.findIndex(actual, cond);
    i.should.above(-1, notEqualMsg);
  }
}
