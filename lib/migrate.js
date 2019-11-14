// Copyright IBM Corp. 2017,2019. All Rights Reserved.
// Node module: loopback-connector-couchdb2
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

'use strict';

const async = require('async');
const g = require('strong-globalize')();
const util = require('util');
const _ = require('lodash');
const inspect = util.inspect;

module.exports = mixinMigrate;

function mixinMigrate(CouchDB) {
  var debug = require('debug')('loopback:connector:couchdb2:migrate');

  /**
 * Perform automigrate for the given models.
 * - destroy the model data if the model exists
 * - delete existing indexes in database
 * - create new indexes according to model definition
 *
 * @param {String|String[]} [models] A model name or an array of model names.
 * If not present, apply to all models
 * @callback {Function} cb The callback function
 */
  CouchDB.prototype.automigrate = function(models, cb) {
    debug('CouchDB.prototype.automigrate models %j', models);
    var self = this;
    var existingModels = models;
    async.series([
      function(callback) {
        destroyData(callback);
      },
      function(callback) {
        debug('CouchDB.prototype.automigrate update indexes for %j', models);
        self.migrateOrUpdateIndex(models, true, callback);
      }], cb);
    function destroyData(destroyCb) {
      async.eachSeries(existingModels, function(model, cb) {
        self.destroyAll(model, {}, {}, cb);
      }, function(err) {
        debug('CouchDB.prototype.automigrate destroy all data has error: %j',
          err);
        destroyCb(err);
      });
    };
  };

  /**
 * Perform autoupdate for the given models.
 * It does NOT destroy previous model instances if model exists, only
 * `automigrate` does that.
 *  - compare new indexes and existing indexes
 *  - keep unchanged indexes
 *  - add newly defined indexes
 *  - delete old indexes
 * @param {String[]} [models] A model name or an array of model names. If not
 * present, apply to all models
 * @callback {Function} cb The callback function
 */

  CouchDB.prototype.autoupdate = function(models, cb) {
    this.migrateOrUpdateIndex(models, false, cb);
  };

  /**
 * Add and delete certain indexes, performs depends on which function calls it.
 *
 * @param {String[]} [models] A model name or an array of model names. Passed in
 * from `automigrate` or `autoupdate`
 * @param {boolean} isMigrate
 * - `true` when called by `automigrate`
 * - `false` when called by `autoupdate`
 *
 * @callback {Function} cb The callback function
 */

  CouchDB.prototype.migrateOrUpdateIndex = function(models, isMigrate, cb) {
    debug('CouchDB.prototype.migrateOrUpdateIndex %j', models);

    var self = this;
    async.each(models, autoUpdateOneModel, cb);

    function autoUpdateOneModel(model, cb) {
      debug('CouchDB.prototype.migrateOrUpdateIndex updating model: %j', model);
      var mo = self.selectModel(model, true);
      if (!mo) return cb(new Error('model ' + model + ' does not exist in your registry!'));
      var indexes = mo.mo.model.definition.indexes();

      self.buildModelViewIndex(mo, indexes);
      self.getModifyIndexes(mo, indexes, isMigrate, function(err, results) {
        debug('start drop and add indexes %j for model %j', results, model);
        if (err) return cb(err);
        if (typeof results !== 'object')
          return cb(new Error('results of modified indexes must be an object!'));

        async.series([
          function dropIndexes(cb) {
            removeIndexes(results.indexesToDrop, cb);
          },
          function addIndexes(cb) {
            createIndexes(results.indexesToAdd, cb);
          },
        ], cb);
      });

      function createIndexes(indexes, cb) {
        if (typeof indexes !== 'object') return cb(new Error('indexes to create must be an object!'));

        async.eachOf(indexes, create, cb);
        // {indexName: "foo"} or {indexName: [{"foo": "asc"}, {"bar": "asc"}]}
        function create(value, key, cb) {
          self._createIndex(mo, model, key, value, cb);
        };
      };

      function removeIndexes(indexes, cb) {
        if (typeof indexes !== 'object') return cb(new Error('indexes to drop must be an object!'));
        async.eachOf(indexes, removeIndex, cb);
        // {ddoc: "_design/ddocName", name: "indexName"}
        function removeIndex(value, key, cb) {
          self.deleteIndex(mo, value.ddoc, cb);
        }
      };
    };
  };

  /**
    * Used in function `migrateOrUpdateIndex`.
    * Create index with index fields.
    * @param {Object} mo  The model configuration.
    * @param {String} model  The model name.
    * @param {String} name  The index name.
    * @param {Object} indexObj The index object e.g. [{"foo": "asc"}, {"bar": "asc"}]
    * @param {Function} cb
  */
  CouchDB.prototype._createIndex = function(mo, model, name, fields, cb) {
    const self = this;
    fields = self.coerceIndexFields(fields);
    self.addModelViewToIndex(mo.modelView, fields);
    // naming convertion: '_design/LBModel__Foo__LBIndex__foo_index',
    // here the driver api takes in the name without prefix '_design/'
    var config = {
      ddocName: self.getIndexModelPrefix(mo) + '__' + model + '__' +
      self.getIndexPropertyPrefix(mo) + '__' + name,
      indexName: name,
      fields: fields,
    };
    self.createIndex(config.ddocName, config.indexName, config.fields, cb);
  };

  /**
   * Add an index for modelView property to indexes got from modelDef
   * @param {Object} modelObject generated by CouchDB.prototype.selectModel
   * @param {Object} indexes the modelDef indexes of a model
   *
  */
  CouchDB.prototype.buildModelViewIndex = function(modelObject, indexes) {
    indexes[modelObject.modelView + '_index'] = true;
  };

  /**
 * Coerce the index fields to be either ALL ASC or ALL DESC if conflict exists.
 * If the fields are specified with different orders:
 * - select the order that is on the first field
 * - force all fields using that order
 * - print warning for coerced fields' names
 *
 * @param {Array} fields The fields defined in an index, example:
 * ```js
 * [{foo: 'asc'}, {bar: 'desc'}]
 * ```
 * @returns {Array} The coerced fields
 */
  CouchDB.prototype.coerceIndexFields = function(fields) {
    if (fields.length <= 1) return fields;
    var defaultOrder = this.getDefaultOrder(fields);
    var coercedFields = [];

    var result = _.map(fields, coerceOrder);
    if (coercedFields.length > 0) {
      printWarning();
    }
    return result;

    function coerceOrder(field) {
      if (field[Object.keys(field)[0]] === defaultOrder)
        return field;
      field[Object.keys(field)[0]] = defaultOrder;
      coercedFields.push(Object.keys(field)[0]);
      return field;
    }

    function printWarning() {
      var couchRule = 'Couchdb does NOT allow composite indexes with conflicting sort directions, ' +
        'please see http://docs.couchdb.org/en/2.0.0/api/database/find.html#db-index for details.' + '\n';
      var connectorStrategy = 'The index will be created using ' + defaultOrder + ' order, specified by: ';
      g.warn(couchRule + connectorStrategy + '%s', coercedFields.join(','));
    }
  };

  /**
 * Add model view property to each created index, because we include it in
 * the selector when send query.
 * It is appended as the last element in the fields, and the direction is identical
 * to the coreced one.
 *
 * @param {String} modelView the model view name, get from `mo.modelView`
 */

  CouchDB.prototype.addModelViewToIndex = function(modelView, fields) {
    debug('addModelViewIndex: modelView %s, fields %s', modelView, fields);
    var defaultOrder;

    if (fields.length < 1) return fields.push({modelView: 'asc'});
    const modelViewExistInField = _.findIndex(fields, function(o) { return !!o[modelView]; }) > -1;
    if (modelViewExistInField) return fields;

    defaultOrder = this.getDefaultOrder(fields);
    var modelViewIndex = {};
    modelViewIndex[modelView] = defaultOrder;
    fields.push(modelViewIndex);
    return fields;
  };

  /**
 * The default order direction is the one specified for the first property in `fields`
 *
 * @param {Array} an array of fields to be put in an index
 */

  CouchDB.prototype.getDefaultOrder = function(fields) {
    var firstProperty = fields[0];
    return firstProperty[Object.keys(firstProperty)[0]];
  };

  /**
 * Create an index in couchdb, you can specify the ddocName and indexName
 * @param {String} ddocName design doc name with prefix '_design/'
 * @param {String} indexName index name
 * @param {Array} fields example format: [{field1: 'asc'}, {field2: 'asc'}]
 * @callback {Function} cb The callback function
 */
  CouchDB.prototype.createIndex = function(ddocName, indexName, fields, cb) {
    debug('createIndex: ddocName %s, indexName %s, fields %s', ddocName,
      indexName, fields);

    if (!Array.isArray(fields)) return cb(new Error('fields in the index must be an array!'));
    if (typeof ddocName !== 'string') return cb(new Error('ddocName of index must be a string!'));
    if (typeof indexName !== 'string') return cb(new Error('indexName in the index must be a string!'));

    var self = this;
    var indexBody = {
      index: {
        fields: fields,
      },
      ddoc: ddocName,
      name: indexName,
      type: 'json',
    };

    var requestObject = {
      db: self.settings.database,
      path: '_index',
      method: 'post',
      body: indexBody,
    };

    self.getDriverInst().request(requestObject, cb);
  };

  /**
 * Return modify index results with: `indexesToDrop`, `indexesToAdd`
 * @param {Object} mo the model object returned by this.selectModel(modelName)
 * @param {Object} newLBIndexes returned from juggler's modelDefinition.indexes()
 * @param {Boolean} isMigrate flag to tell do we want to compare new/old indexes
 * @callback {Function} cb The callback function
 * @param {Object} result indexes to modify in the following format:
 * ```js
 *   result: {
 *     indexesToAdd: {
 *       foo_index: [{foo: 'asc'}],
 *       bar_index: [{bar1: 'asc'}, {bar2: 'asc'}]
 *     },
 *     indexesToDrop: {
 *       foobar_index: {
 *         ddoc: '_design/LBModel__Foo__LBIndex__foobar_index',
 *         fields: [{foo: 'asc'}, {bar: 'asc'}]
 *       }
 *     }
 *   }
 * ```
 */
  CouchDB.prototype.getModifyIndexes = function(mo, newLBIndexes, isMigrate, cb) {
    debug('CouchDB.prototype.getModifyIndexes');
    if (typeof newLBIndexes !== 'object') return cb(new Error('indexes from modelDef must be an object!'));

    var self = this;
    var results = {};
    // `newLBIndexes` is generated from modelDef, convert it to the format we need and
    // store in `newIndexes`
    var newIndexes = {};
    var modelName = mo.mo.model.modelName;

    var newModelIndexes = _.pickBy(newLBIndexes, function(value, index) {
      if (value.keys)
        return newLBIndexes[index];
    });
    var newPropertyIndexes = _.pickBy(newLBIndexes, function(value, index) {
      if (!value.keys)
        return newLBIndexes[index];
    });

    newIndexes = _.merge(newIndexes, self._generateModelLevelIndexes(newModelIndexes));
    newIndexes = _.merge(newIndexes, self._generatePropertyLevelIndexes(newPropertyIndexes));

    // Call `getModelIndexes` to get existing indexes.
    self.getModelIndexes(modelName, function(err, oldIndexes) {
      if (err) return cb(err);
      if (isMigrate) {
        results.indexesToAdd = newIndexes;
        results.indexesToDrop = oldIndexes;
      } else {
        results = self.compare(newIndexes, oldIndexes);
      }
      debug('getModifyIndexes results: %s', inspect(results, {depth: 4}));
      cb(null, results);
    });
  };

  /**
   * Used in function `getModifyIndexes()`.
   * Generate indexes for model properties that are configured as
   * `{index: true}`
   * @param {Object} indexes indexes from model config, retrieved in
   * `getModifyIndexes()`
   */
  CouchDB.prototype._generatePropertyLevelIndexes = function(indexes) {
    var results = {};
    for (var key in indexes) {
      var field = {};
      // By default the order will be `asc`,
      // please create Model level index if you need `desc`
      field[key.split('_index')[0]] = 'asc';
      var fields = [field];
      results[key] = fields;
    };
    return results;
  };

  /**
   * Used in function `getModifyIndexes()`.
   * Generate indexes for indexes defined in the model config.
   * @param {Object} indexes indexes from model config, provided by
   * `getModifyIndexes()`
   */
  CouchDB.prototype._generateModelLevelIndexes = function(indexes, cb) {
    var results = {};
    for (var key in indexes) {
      var keys = indexes[key].keys;
      if (!keys || typeof keys !== 'object') return cb(new Error(
        'the keys in your model index are not well defined! please see' +
        'https://loopback.io/doc/en/lb3/Model-definition-JSON-file.html#indexes'
      ));

      var fields = [];
      _.forEach(keys, function(value, key) {
        var obj = {};
        var order;
        if (keys[key] === 1) order = 'asc';
        else order = 'desc';
        obj[key] = order;
        fields.push(obj);
      });
      results[key] = fields;
    }
    return results;
  };

  /**
 * Perform the indexes comparison for `autoupdate`.
 * @param {Object} newIndexes
 * newIndexes in format:
 * ```js
 * {
 *   indexName: [{afield: 'asc'}],
 *   compositeIndexName: [{field1: 'asc'}, {field2: 'asc'}]
 * }
 * ```
 * @param {Object} oldIndexes
 * oldIndexes in format:
 * ```js
 * {
 *   indexName: {
 *     ddoc: '_design/LBModel__Foo__LBIndex__bar_index',
 *     fields: [{afield: 'asc'}],
 *   }
 * }
 * ```
 * @callback {Function} cb The callback function
 * @param {Object} result indexes to add and drop after comparison
 * ```js
 * result: {indexesToAdd: {$someIndexes}, indexesToDrop: {$someIndexes}}
 * ```
 */
  CouchDB.prototype.compare = function(newIndexes, oldIndexes, cb) {
    debug('CouchDB.prototype.compare');
    var result = {};
    var indexesToDrop = {};
    var indexesToAdd = {};
    var iAdd;
    for (var niKey in newIndexes) {
      if (!oldIndexes.hasOwnProperty(niKey)) {
      // Add item to `indexesToAdd` if it's new
        iAdd = {};
        iAdd[niKey] = newIndexes[niKey];
        indexesToAdd = _.merge(indexesToAdd, iAdd);
      } else {
        if (arrEqual(newIndexes[niKey], oldIndexes[niKey].fields)) {
        // Don't change it if index already exists
          delete oldIndexes[niKey];
        } else {
        // Update index if fields change
          iAdd = {};
          var iDrop = {};
          iAdd[niKey] = newIndexes[niKey];
          indexesToAdd = _.merge(indexesToAdd, iAdd);
        }

        function arrEqual(arr1, arr2) {
          if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
          var isEqual = true;
          for (var item in arr1) {
            var i = _.findIndex(arr2, arr1[item]);
            isEqual = isEqual && (i > -1);
          }
          return isEqual;
        }
      }
    }
    indexesToDrop = oldIndexes;
    result.indexesToAdd = indexesToAdd;
    result.indexesToDrop = indexesToDrop;
    return result;
  };

  /**
 * Get all indexes of a model.
 *
 * @param {String} model The model name
 * @callback {Function} cb The callback function
 * @param {Object} existingIndexes indexes in database that belongs to the model
 * - existingIndexes format see jsdoc of `CouchDB.prototype.parseIndexes`
 */
  CouchDB.prototype.getModelIndexes = function(model, cb) {
    debug('CouchDB.prototype.getModelIndexes: %j', model);
    var self = this;
    var mo = self.selectModel(model);
    var dbName = mo.dbName;
    self.getIndexes(dbName, function(err, result) {
      if (err) return cb(err);
      var ddocsOfModel = _.filter(result.indexes, isSameModel);
      function isSameModel(item) {
        var isSame = false;
        if (item.ddoc !== null) {
        // slice the '_design/'
          var ddocName = item.ddoc.slice(8);
          // need to be careful on the subString comparison based on
          // naming convertion, avoid one index belongs to two models
          var modelIndexName = self.getIndexModelPrefix(mo) + '__' + model + '__' +
          self.getIndexPropertyPrefix(mo);
          if (ddocName.indexOf(modelIndexName) === 0)
            isSame = true;
        }
        return isSame;
      };

      var existingIndexes = self.parseIndexes(ddocsOfModel);
      cb(null, existingIndexes);
    });
  };

  /**
 * Parse the raw index object returned from database
 * to the format we need in connector
 * Example:
 *
 * raw index object:
 * ```js
 * {
 *   ddoc: "_design/LBModel__User__LBIndex__name",
 *   name: "name_index",
 *   def: {
 *     fields: [
 *       {firstName: "asc"},
 *       {lastName: "asc"}
 *     ]
 *   }
 * }
 * ```
 * converts to the format:
 * {
 *   name_index: {
 *     ddoc: "_design/LBModel__User__LBIndex__name",
 *     fields: [
 *       {firstName: "asc"},
 *       {lastName: "asc"}
 *     ]
 *   }
 * }
 *
 * @param {Object} indexes Raw index object returned from database
 * @returns {Object} results The parsed indexes
 */
  CouchDB.prototype.parseIndexes = function(indexes) {
    var results = {};
    for (var item in indexes) {
      var value = indexes[item];
      results[value.name] = {
        ddoc: value.ddoc,
        fields: value.def.fields,
      };
    }
    return results;
  };

  /**
 * Get all indexes in a database.
 * @param {String} dbName a database name
 * @callback {Function} cb The callback function
 */
  CouchDB.prototype.getIndexes = function(dbName, cb) {
    var self = this;
    var requestObject = {
      db: dbName,
      path: '_index',
      method: 'get',
    };

    self.getDriverInst().request(requestObject, cb);
  };

  /**
 * Delete an index by its ddocName
 * This function makes sure we can cleanUp an existing model when automigrate
 *
 * @param {String} mo model in the connector
 * @param {String} ddocName design doc name with prefix '_design/'
 * @callback {Function} cb The callback function
 */
  CouchDB.prototype.deleteIndex = function(mo, ddocName, cb) {
    debug('CouchDB.prototype.deleteIndex ddocName: %j', ddocName);
    var self = this;
    var db = mo.db;
    db.get(ddocName, function(err, result) {
      if (err) return cb(err);
      db.destroy(result._id, result._rev, cb);
    });
  };
};
