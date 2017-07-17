// Copyright IBM Corp. 2017. All Rights Reserved.
// Node module: loopback-connector-couchdb2
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

'use strict';

module.exports = require('should');

var DataSource = require('loopback-datasource-juggler').DataSource;

var config = {
  url: process.env.COUCHDB_URL,
  username: process.env.COUCHDB_USERNAME,
  password: process.env.COUCHDB_PASSWORD,
  database: process.env.COUCHDB_DATABASE,
  plugin: 'retry',
  retryAttempts: 10,
  retryTimeout: 50,
};

console.log('env config ', config);

global.config = config;

global.getDataSource = global.getSchema = function(customConfig) {
  var db = new DataSource(require('../'), customConfig || config);
  db.log = function(a) {
    console.log(a);
  };
  return db;
};

global.connectorCapabilities = {
  ilike: false,
  nilike: false,
  nestedProperty: true,
  supportPagination: false,
  ignoreUndefinedConditionValue: false,
  deleteWithOtherThanId: false,
  adhocSort: false,
  cloudantCompatible: false,
};

global.sinon = require('sinon');
