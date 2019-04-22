// Copyright IBM Corp. 2017,2019. All Rights Reserved.
// Node module: loopback-connector-couchdb2
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

'use strict';

var _ = require('lodash');
var async = require('async');
var should = require('should');
var testUtil = require('./lib/test-util');
var url = require('url');
var db, Product;

if (!process.env.COUCHDB2_TEST_SKIP_INIT) {
  require('./init.js');
}

function cleanUpData(done) {
  Product.destroyAll(done);
}

var bread = {
  name: 'bread',
  price: 100,
};

describe('replaceOrCreate', function() {
  before(function(done) {
    db = global.getDataSource();

    Product = db.define('Product', {
      _rev: {type: String},
      name: {type: String},
      description: {type: String},
      price: {type: Number},
    }, {forceId: false});

    db.automigrate(done);
  });

  it('creates when the instance does not exist', function(done) {
    Product.replaceOrCreate(bread, function(err, result) {
      err = testUtil.refinedError(err, result);
      if (err) return done(err);
      testUtil.checkModel(bread, result);
      done();
    });
  });

  it('replaces when the instance exists', function(done) {
    // Use create, not replaceOrCreate!
    Product.create(bread, function(err, result) {
      err = testUtil.refinedError(err, result);
      if (err) return done(err);
      should.exist(result._rev);
      var updatedBread = _.cloneDeep(result);
      // Make the new record different a subset of the old one.
      delete updatedBread.price;

      Product.replaceOrCreate(updatedBread, function(err, result) {
        err = testUtil.refinedError(err, result);
        if (err) return done(err);
        testUtil.checkModel(updatedBread, result);
        should.notDeepEqual(bread, result);
        done();
      });
    });
  });

  it('throws on replace when model exists and _rev is different',
    function(done) {
      var initialResult;
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
          return Product.replaceOrCreate(result, callback);
        },
        function(result, options, callback) {
          initialResult.price = 150;
          return Product.replaceOrCreate(initialResult, callback);
        },
      ], function(err, result) {
        err = testUtil.refinedError(err, result);
        should(_.includes(err.message, 'Document update conflict'));
        done();
      });
    });

  afterEach(cleanUpData);
});

describe('replaceById', function() {
  before(function(done) {
    db = global.getDataSource();

    Product = db.define('Product', {
      _rev: {type: String},
      name: {type: String},
      description: {type: String},
      price: {type: Number},
    }, {forceId: false});

    db.automigrate(function(err) {
      Product.create(bread, done);
    });
  });

  afterEach(cleanUpData);

  it('replaces instance by id after finding', function(done) {
    Product.find(function(err, result) {
      err = testUtil.refinedError(err, result);
      if (err) return done(err);
      testUtil.hasResult(err, result).should.be.ok();
      var updatedData = _.clone(result);
      updatedData.name = 'bread3';
      var id = result[0].id;
      var oldRev = result[0]._rev;
      Product.replaceById(id, updatedData[0], function(err, result) {
        err = testUtil.refinedError(err, result);
        if (err) return done(err);
        testUtil.hasResult(err, result).should.be.ok();
        oldRev.should.not.equal(result._rev);
        testUtil.checkModel(updatedData, result);
        done();
      });
    });
  });

  it('replaces instance by id after creating', function(done) {
    var newData = {
      name: 'bread2',
      price: 100,
    };
    Product.create(newData, function(err, result) {
      err = testUtil.refinedError(err, result);
      if (err) return done(err);
      testUtil.hasResult(err, result).should.be.ok();
      var updatedData = _.clone(result);
      updatedData.name = 'bread3';
      var id = result.id;
      var oldRev = result._rev;
      Product.replaceById(id, updatedData, function(err, result) {
        err = testUtil.refinedError(err, result);
        if (err) return done(err);
        testUtil.hasResult(err, result).should.be.ok();
        oldRev.should.not.equal(result._rev);
        done();
      });
    });
  });

  it('replace should remove model view properties (i.e loopback__model__name)',
    function(done) {
      var newData = {
        name: 'bread2',
        price: 100,
      };
      Product.create(newData, function(err, result) {
        err = testUtil.refinedError(err, result);
        if (err) return done(err);
        testUtil.hasResult(err, result).should.be.ok();
        var updatedData = _.clone(result);
        updatedData.name = 'bread3';
        var id = result.id;
        Product.replaceById(id, updatedData, function(err, result) {
          err = testUtil.refinedError(err, result);
          if (err) return done(err);
          testUtil.hasResult(err, result).should.be.ok();
          should.not.exist(result['loopback__model__name']);
          should.not.exist(result['_id']);
          done();
        });
      });
    });
});
