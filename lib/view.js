// Copyright IBM Corp. 2017,2019. All Rights Reserved.
// Node module: loopback-connector-couchdb2
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

'use strict';

const URL = require('url');
const assert = require('assert');
const util = require('util');
const _ = require('lodash');

module.exports = mixinView;

function mixinView(CouchDB) {
  const debug = require('debug')('loopback:connector:couchdb2:view');

  /**
   * Gets data at `/{db}/_design/{ddocName}/views/{viewName}`
   *
   * Example:
   * User has a view called `getModel` in design document /{db}/_design/model,
   * to query the view, user can call function:
   * ```
   * ds.viewDocs(model, getModel, {key: 'purchase'}, cb);
   * ```
   *
   * @param {String} ddocName The design doc name without {db}/_design/ prefix
   * @param {String} viewName The view name
   * @param {Object} options The CouchDB view filter
   * @callback
   * @param {Function} cb
   */
  CouchDB.prototype.viewDocs = function(ddocName, viewName, options, cb) {
    // omit options, e.g. ds.viewDocs(ddocName, viewName, cb);
    if (typeof options === 'function' && !cb) {
      cb = options;
      options = {};
    }
    debug('CouchDB2.prototype.view ddocName %s viewName %s options %s',
      ddocName, viewName, options);

    const self = this;
    const db = this.couchdb.use(self.getDbName(self));

    db.view(ddocName, viewName, options, cb);
  };

  /**
   * Return CouchDB database name
   * @param {Object} connector The CouchDB connector instance
   * @return {String} The database name
   */
  CouchDB.prototype.getDbName = function(connector) {
    const dbName = connector.settings.database || connector.settings.db ||
    getDbFromUrl(connector.settings.url);
    return dbName;
  };
}

/**
 * Parse url and return the database name if provided
 * @param {String} url The CouchDB connection url
 * @return {String} The database name parsed from url
 */
function getDbFromUrl(url) {
  const parsedUrl = URL.parse(url);
  if (parsedUrl.path && parsedUrl.path !== '/')
    return parsedUrl.path.split('/')[1];
  return '';
}
