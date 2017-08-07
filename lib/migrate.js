// Copyright IBM Corp. 2017. All Rights Reserved.
// Node module: loopback-connector-couchdb2
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

'use strict';

var async = require('async');
var assert = require('assert');
var debug = require('debug')('loopback:connector:couchdb');
var g = require('strong-globalize')();
var util = require('util');
var _ = require('lodash');

module.exports = mixinMigrate;

function mixinMigrate(CouchDB) {
  var debug = require('debug')('loopback:connector:couchdb2:migrate');

/**
 * Perform automigrate for the given models.
 * - destroys model data if the model exists
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
      self.migrateOrUpdateIndex(models, true, callback);
    }], cb);
  function destroyData(destroyCb) {
    async.eachSeries(existingModels, function(model, cb) {
      self.destroyAll(model, {}, {}, cb);
    }, function(err) {
      debug('CouchDB.prototype.automigrate %j', err);
      destroyCb(err);
    });
  };
};

/**
 * Perform autoupdate for the given models.
 * It does NOT destroy previous model instances if model exists, only
 * `automigrate` does that.
 *  - compare new indexes and existing indexes, 
 *  - keep unchanged indexes
 *  - add newly defined indexes
 *  - delete old indexes  
 * @param {String[]} [models] A model name or an array of model names. If not
 * present, apply to all models
 * @callback {Function} cb The callback function
 */

CouchDB.prototype.autoupdate = function(models, cb) {
  this.migrateOrUpdateIndex(models, false, cb);
}

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
  debug('CouchDB.prototype.autoupdate %j', models);

  var self = this;
  async.each(models, autoUpdateOneModel, cb);

  function autoUpdateOneModel(model, cb) {
    var mo = self.selectModel(model, true);
    assert(mo, 'model ' + model + ' does not exist in your registry!');
    var indexes = mo.mo.model.definition.indexes();
    // var modelView = mo.modelView;
    
    self.getModifyIndexes(mo, indexes, isMigrate, function(err, results) {
      if (err) return cb(err);
      assert(typeof results === 'object', 
        'results of modified indexes must be an object!');
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
      async.eachOf(indexes, create, cb);
      // {indexName: "foo"} or {indexName: [{"foo": "asc"}, {"bar": "asc"}]}
      function create(value, key, cb) {
        createIndex(key, value, cb);
      };
    };

    function createIndex(name, fields, cb) {
      // TODO: customize index prefix?
      var config = {
        ddocName: self.getIndexModelPrefix() + '__' + model + '__' +
          self.getIndexPropertyPrefix() + '__' + name,
        indexName: name,
        fields: fields,
      };
      self.createIndex(config.ddocName, config.indexName, config.fields, cb);
    }

    function removeIndexes(indexes, cb) {
      async.eachOf(indexes, removeIndex, cb);
      // {ddoc: "_design/ddocName", name: "indexName"}
      function removeIndex(value, key, cb) {
        self.deleteIndex(mo, value.ddoc, cb);
      }
    };
  };
};

/**
 * Create an index in couchdb, you can specify the ddocName and indexName
 * @param {String} ddocName without prefix `_design/`
 * @param {String} indexName index name
 * @param {Array} fields example format: [{field1: 'asc'}, {field2: 'asc'}]
 */
CouchDB.prototype.createIndex = function(ddocName, indexName, fields, cb) {
  debug('createIndex: ddocName %s, indexName %s, fields %s', ddocName,
    indexName, fields);

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

  self.couchdb.request(requestObject, cb);
};

/**
 * Return modify index results with: `indexesToDrop`, `indexesToAdd`
 * @param {Object} mo the model object returned by this.selectModel(modelName)
 * @param {Object} newLBIndexes returned from juggler's modelDefinition.indexes()
 * @param {Boolean} isMigrate flag to tell do we want to compare new/old indexes
 * @param {Function} [cb] The cb function
 * 
 * cb(null, result)
 * - result: {
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
 */
CouchDB.prototype.getModifyIndexes = function(mo, newLBIndexes,  isMigrate, cb) {
    var self = this;
    var results = {};
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

    newIndexes = _.merge(newIndexes, generateModelLevelIndexes(newModelIndexes));
    newIndexes = _.merge(newIndexes, generatePropertyLevelIndexes(newPropertyIndexes));

    self.getModelIndexes(modelName, function(err, oldIndexes) {
      if (err) return cb(err);
      if (isMigrate) {
        results.indexesToAdd = newIndexes;
        results.indexesToDrop = oldIndexes;
      } else {
        results = self.compare(newIndexes, oldIndexes);
      }
      cb(null, results);
    });

    function generatePropertyLevelIndexes(indexes) {
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
    }

    function generateModelLevelIndexes(indexes) {
      var results = {};
      for (var key in indexes) {
        var keys = indexes[key].keys;
        var fields = [];
        _.forEach(keys, function(value, key){
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
    }
};

/**
 * @param {Object} newIndexes
 * newIndexes in format:
 * ```
 * {
 *   indexName: [{afield: 'asc'}],
 *   compositeIndexName: [{field1: 'asc'}, {field2: 'asc'}]
 * }
 * ```
 * @param {Object} oldIndexes
 * oldIndexes in format:
 * ```
 * {
 *   indexName: {
 *     ddoc: '_design/LBModel__Foo__LBIndex__bar_index',
 *     fields: [{afield: 'asc'}],
 *   }
 * }
 * ```
 * @param {Function} [cb] The cb function
 * cb(null, result)
 * - result: {indexesToAdd: {}, indexesToDrop: {}}
 */
CouchDB.prototype.compare = function(newIndexes, oldIndexes, cb) {
  var result = {}; 
  var indexesToDrop = {};
  var indexesToAdd = {};
  for (var niKey in newIndexes) {
    if (!oldIndexes.hasOwnProperty(niKey)) {
      // Add item to `indexesToAdd` if it's new
      var iAdd = {};
      iAdd[niKey] = newIndexes[niKey];
      indexesToAdd = _.merge(indexesToAdd, iAdd);
    } else {
      if (arrEqual(newIndexes[niKey], oldIndexes[niKey].fields)) {
        // Don't change it if index already exists
        delete oldIndexes[niKey];
      } else {
        // Update index if fields change
        var iAdd = {}; 
        var iDrop = {};
        iAdd[niKey] = newIndexes[niKey];
        indexesToAdd = _.merge(indexesToAdd, iAdd);
      }

      // function arrEqual(arr1, arr2) {
      //   return _.isEqual(arr1.sort(), arr2.sort());
      // }
      // IMPROVE: use _.isEqual with customized compare function
      function arrEqual(arr1, arr2) {
        var notEqualMsg = util.inspect(arr1, 4) + ' is not equal to ' +
        util.inspect(arr2, 4);
        var isEqual = true;
        for (var item in arr1) {
          var key = Object.keys(arr1[item])[0];
          var value = arr1[item][key];
          var cond = {};
          cond[key] = value;
          var i = _.findIndex(arr2, cond);
          isEqual = isEqual && (i > -1);
        }
        return isEqual;
      }
    }
  }
  for (var oiKey in oldIndexes) {
    var iDrop = {};
    iDrop[oiKey] = oldIndexes[oiKey];
    indexesToDrop = _.merge(indexesToDrop, iDrop);
  }
  result.indexesToAdd = indexesToAdd;
  result.indexesToDrop = indexesToDrop;
  return result;
};

/**
 * Get all indexes of a model.
 * 
 * @param {Function} [cb] The cb function
 * cb(null, existingIndexes)
 * existingIndexes format see jsdoc of `CouchDB.prototype.parseIndexes`
 */
CouchDB.prototype.getModelIndexes = function(model, cb) {
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
        var modelIndexName = self.getIndexModelPrefix(mo) + '__' + model;
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
 * @param {Object} ddocs raw index object
 * @param {Function} [cb] The cb function
 */
CouchDB.prototype.parseIndexes = function(ddocs) {
  var results = {};
  for (var item in ddocs) {
    var value = ddocs[item];
    results[value.name] = {
      ddoc: value.ddoc,
      fields: value.def.fields,
    }
  }
  return results;
};

/**
 * Get all indexes in a database.
 * @param {String} dbName a database name
 * @param {Function} [cb] The cb function
 */
CouchDB.prototype.getIndexes = function(dbName, cb) {
  var self = this;
  var requestObject = {
    db: dbName,
    path: '_index',
    method: 'get',
  };

  self.couchdb.request(requestObject, cb);
};

/**
 * Delete an index by its ddocName
 * This function makes sure we can cleanUp an existing model when automigrate
 *
 * @param {String} mo model in the connector
 * @param {String} ddocName design doc name with prefix '_design/'
 */
CouchDB.prototype.deleteIndex = function(mo, ddocName, cb) {
  var self = this;
  var db = mo.db;
  db.get(ddocName, function(err, result) {
    db.destroy(result._id, result._rev, cb);
  });
};

};
