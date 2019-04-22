// Copyright IBM Corp. 2017,2019. All Rights Reserved.
// Node module: loopback-connector-couchdb2
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

'use strict';

module.exports = mixinDiscovery;

function mixinDiscovery(CouchDB2) {
  var debug = require('debug')('loopback:connector:couchdb2:discovery');

  /**
   * Discover model definitions
   *
   * @param {Object} options Options for discovery
   * @param {Function} [cb] The callback function
   */
  CouchDB2.prototype.discoverModelDefinitions = function(options, cb) {
    debug('CouchDB2.prototype.discoverModelDefinitions %j', options);

    if (!cb && typeof options === 'function') {
      cb = options;
    }

    this.db.list(function(err, dbs) {
      debug('CouchDB2.prototype.discoverModelDefinitions %j %j', err, dbs);
      if (err) cb(err);
      cb(null, dbs);
    });
  };

  /**
   * @param {string} dbname The database name
   * @param {Object} options The options for discovery
   * @param {Function} [cb] The callback function
   */
  CouchDB2.prototype.discoverSchemas = function(dbname, options, cb) {
    debug('CouchDB2.prototype.discoverSchemas %j %j', dbname, options);
    var schema = {
      name: dbname,
      options: {
        idInjection: true,
        dbName: dbname,
      },
      properties: {},
    };
    options.visited = options.visited || {};
    if (!options.visited.hasOwnProperty(dbname)) {
      options.visited[dbname] = schema;
    }
    if (cb) cb(null, options.visited);
  };
};
