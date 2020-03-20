// Copyright IBM Corp. 2017,2019. All Rights Reserved.
// Node module: loopback-connector-couchdb2
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

'use strict';

const _ = require('lodash');
const async = require('async');
const should = require('should');
const testUtil = require('./lib/test-util');
const url = require('url');
let db, Product;

if (!process.env.COUCHDB2_TEST_SKIP_INIT) {
  require('./init.js');
}

function cleanUpData(done) {
  Product.destroyAll(done);
}

const bread = {
  name: 'bread',
  price: 100,
};

describe('create', function() {
  before(function(done) {
    db = global.getDataSource();

    Product = db.define('Product', {
      name: {type: String},
      description: {type: String},
      price: {type: Number},
    }, {forceId: false});

    db.automigrate(done);
  });

  it('creates a model instance when `_rev` is provided', function(done) {
    const newBread = _.cloneDeep(bread);
    newBread._rev = '1-somerandomrev';
    Product.create(newBread, function(err, result) {
      err = testUtil.refinedError(err, result);
      if (err) return done(err);
      Product.findById(result.id, function(err, result) {
        err = testUtil.refinedError(err, result);
        if (err) return done(err);
        // CouchDB's post call ignores the `_rev` value for their own safety check
        // therefore, creating an instance with a random `_rev` value works.
        // however, it shall not be equal to the `_rev` value the user provides.
        should.exist(result._rev);
        should.notEqual(newBread._rev, result._rev);
        testUtil.checkModel(newBread, result);
        done();
      });
    });
  });

  it('creates when model instance does not exist', function(done) {
    Product.create(bread, function(err, result) {
      err = testUtil.refinedError(err, result);
      if (err) return done(err);
      Product.findById(result.id, function(err, result) {
        err = testUtil.refinedError(err, result);
        if (err) return done(err);
        should.exist(result._rev);
        testUtil.checkModel(bread, result);
        done();
      });
    });
  });

  it('replaces when the instance exists', function(done) {
    Product.create(bread, function(err, result) {
      err = testUtil.refinedError(err, result);
      if (err) return done(err);
      should.exist(result._rev);
      const updatedBread = _.cloneDeep(result);
      // Make the new record different a subset of the old one.
      delete updatedBread.price;
      Product.create(updatedBread, function(err, result) {
        err = testUtil.refinedError(err, result);
        if (err) return done(err);
        testUtil.checkModel(updatedBread, result);
        should.notDeepEqual(bread, result);
        done();
      });
    });
  });

  it('throws on update when model exists and _rev is different ',
    function(done) {
      let initialResult;
      async.waterfall([
        function(callback) {
          return Product.create(bread, callback);
        },
        function(result, callback) {
          return Product.findById(result.id, callback);
        },
        function(result, callback) {
          initialResult = _.cloneDeep(result);
          // Simulate the idea of another caller changing the record first!
          result.price = 250;
          return Product.create(result, callback);
        },
        function(result, callback) {
          // Someone beat us to it, but we don't know that yet.
          initialResult.price = 150;
          return Product.create(initialResult, callback);
        },
      ], function(err, result) {
        err.should.be.ok();
        should(_.includes(err.message, 'Document update conflict'));
        done();
      });
    });

  afterEach(cleanUpData);
});
