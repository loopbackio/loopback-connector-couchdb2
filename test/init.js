// Copyright IBM Corp. 2017,2019. All Rights Reserved.
// Node module: loopback-connector-couchdb2
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

'use strict';

module.exports = require('should');

var DataSource = require('loopback-datasource-juggler').DataSource;
var _ = require('lodash');

var config = {
  url: process.env.COUCHDB_URL,
  username: process.env.COUCHDB_USERNAME,
  password: process.env.COUCHDB_PASSWORD,
  database: process.env.COUCHDB_DATABASE,
  port: process.env.COUCHDB_PORT,
  plugin: 'retry',
  retryAttempts: 10,
  retryTimeout: 50,
};

console.log('env config ', config);

global.config = config;
global.IMPORTED_TEST = false;

var skips = [
  'find all limt ten',
  'find all skip ten limit ten',
  'find all skip two hundred',
  'isActual',
];

if (process.env.LOOPBACK_MOCHA_SKIPS) {
  process.env.LOOPBACK_MOCHA_SKIPS =
    JSON.stringify(JSON.parse(process.env.LOOPBACK_MOCHA_SKIPS).concat(skips));
} else {
  process.env.LOOPBACK_MOCHA_SKIPS = JSON.stringify(skips);
}

global.getDataSource = global.getSchema = function(customConfig) {
  var db = new DataSource(require('../'), customConfig || config);
  db.log = function(a) {
    console.log(a);
  };

  var originalConnector = _.clone(db.connector);
  var overrideConnector = {};

  overrideConnector.save = function(model, data, options, cb) {
    if (!global.IMPORTED_TEST) {
      return originalConnector.save(model, data, options, cb);
    } else {
      var self = this;
      var idName = self.idName(model);
      var id = data[idName];
      var mo = self.selectModel(model);
      data[idName] = id.toString();

      mo.db.get(id, function(err, doc) {
        if (err) return cb(err);
        data._rev = doc._rev;
        var saveHandler = function(err, id) {
          if (err) return cb(err);
          mo.db.get(id, function(err, doc) {
            if (err) return cb(err);
            cb(null, self.fromDB(model, mo, doc));
          });
        };
        self._insert(model, data, saveHandler);
      });
    }
  };

  overrideConnector._insert = function(model, data, cb) {
    if (!global.IMPORTED_TEST) {
      return originalConnector._insert(model, data, cb);
    } else {
      originalConnector._insert(model, data, function(err, rid, rrev) {
        if (err) return cb(err);
        cb(null, rid);
      });
    }
  };

  db.connector.save = overrideConnector.save;
  db.connector._insert = overrideConnector._insert;

  return db;
};

global.connectorCapabilities = {
  ilike: false,
  nilike: false,
  nestedProperty: true,
  supportPagination: false,
  ignoreUndefinedConditionValue: false,
  adhocSort: false,
  cloudantCompatible: false,
};

global.sinon = require('sinon');
