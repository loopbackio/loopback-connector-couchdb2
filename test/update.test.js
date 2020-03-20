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

describe('updateOrCreate', function() {
  before(function(done) {
    db = global.getDataSource();

    Product = db.define('Product', {
      name: {type: String},
      description: {type: String},
      price: {type: Number},
    }, {forceId: false});

    db.automigrate(done);
  });

  it('creates when model instance does not exist', function(done) {
    Product.updateOrCreate(bread, function(err, result) {
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

  it('creates when model instance does not exist but specifies id',
    function(done) {
      const breadWithId = _.merge({id: 1}, bread);
      Product.updateOrCreate(breadWithId, function(err, result) {
        err = testUtil.refinedError(err, result);
        if (err) return done(err);
        Product.findById(result.id, function(err, result) {
          err = testUtil.refinedError(err, result);
          if (err) return done(err);
          should.exist(result._rev);
          testUtil.checkModel(breadWithId, result);
          done();
        });
      });
    });

  it('updates when model exists and _rev matches', function(done) {
    // Use create, not updateOrCreate!
    Product.create(bread, function(err, result) {
      err = testUtil.refinedError(err, result);
      if (err) return done(err);
      should.exist(result._rev);
      const updatedBread = _.cloneDeep(result);
      // Change the record in some way before updating.
      updatedBread.price = 200;
      Product.updateOrCreate(updatedBread, function(err, result) {
        err = testUtil.refinedError(err, result);
        if (err) return done(err);
        should.exist(result._rev);
        testUtil.checkModel(updatedBread, result);
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
          return Product.updateOrCreate(result, callback);
        },
        function(result, callback) {
          // Someone beat us to it, but we don't know that yet.
          initialResult.price = 150;
          return Product.updateOrCreate(initialResult, callback);
        },
      ], function(err, result) {
        err = testUtil.refinedError(err, result);
        should(_.includes(err.message, 'Document update conflict'));
        done();
      });
    });

  afterEach(cleanUpData);
});

describe('updateAll', function() {
  before(function(done) {
    db = global.getDataSource();

    Product = db.define('Product', {
      name: {type: String},
      description: {type: String},
      price: {type: Number},
    }, {forceId: false});

    db.automigrate(done);
  });

  beforeEach(function(done) {
    Product.create([{
      name: 'bread',
      price: 100,
    }, {
      name: 'bread-x',
      price: 110,
    }], done);
  });

  afterEach(cleanUpData);

  it('updates a model instance without `_rev` property', function(done) {
    const newData = {
      name: 'bread2',
      price: 250,
    };

    Product.find(function(err, result) {
      err = testUtil.refinedError(err, result);
      if (err) return done(err);
      testUtil.hasResult(err, result).should.be.ok();
      const id = result[0].id;
      Product.update({id: id}, newData, function(err, result) {
        err = testUtil.refinedError(err, result);
        if (err) return done(err);
        testUtil.hasResult(err, result).should.be.ok();
        result.should.have.property('count');
        result.count.should.equal(1);
        Product.find(function(err, result) {
          err = testUtil.refinedError(err, result);
          if (err) return done(err);
          testUtil.hasResult(err, result).should.be.ok();
          result.length.should.equal(2);
          newData.name.should.be.oneOf(result[0].name, result[1].name);
          newData.price.should.be.oneOf(result[0].price, result[1].price);
          done();
        });
      });
    });
  });

  it('updates a model instance with `_rev` property', function(done) {
    const newData = {
      name: 'bread2',
      price: 250,
    };

    Product.find(function(err, result) {
      err = testUtil.refinedError(err, result);
      if (err) return done(err);
      testUtil.hasResult(err, result).should.be.ok();
      const id = result[0].id;
      newData._rev = result[0]._rev;
      Product.update({id: id}, newData, function(err, result) {
        err = testUtil.refinedError(err, result);
        if (err) return done(err);
        testUtil.hasResult(err, result).should.be.ok();
        result.should.have.property('count');
        result.count.should.equal(1);
        Product.find(function(err, result) {
          err = testUtil.refinedError(err, result);
          if (err) return done(err);
          testUtil.hasResult(err, result).should.be.ok();
          result.length.should.equal(2);
          newData.name.should.be.oneOf(result[0].name, result[1].name);
          newData.price.should.be.oneOf(result[0].price, result[1].price);
          done();
        });
      });
    });
  });
});

describe('bulkReplace', function() {
  const breads = [{
    name: 'bread1',
    price: 10,
  }, {
    name: 'bread2',
    price: 20,
  }, {
    name: 'bread3',
    price: 30,
  }, {
    name: 'bread4',
    price: 40,
  }, {
    name: 'bread5',
    price: 50,
  }, {
    name: 'bread6',
    price: 60,
  }, {
    name: 'bread7',
    price: 70,
  }];

  const dataToBeUpdated = [{
    name: 'bread1-update',
    price: 100,
  }, {
    name: 'bread4-update',
    price: 200,
  }, {
    name: 'bread6-update',
    price: 300,
  }];

  before(function(done) {
    db = global.getDataSource();

    Product = db.define('Product', {
      name: {type: String},
      description: {type: String},
      price: {type: Number},
    }, {forceId: false});
    db.automigrate(function(err) {
      Product.create(breads, done);
    });
  });

  afterEach(cleanUpData);

  it('bulk replaces with an array of data', function(done) {
    Product.find(function(err, result) {
      err = testUtil.refinedError(err, result);
      if (err) return done(err);
      testUtil.hasResult(err, result).should.be.ok();

      dataToBeUpdated[0].id = result[0].id;
      dataToBeUpdated[0]._rev = result[0]._rev;

      dataToBeUpdated[1].id = result[3].id;
      dataToBeUpdated[1]._rev = result[3]._rev;

      dataToBeUpdated[2].id = result[5].id;
      dataToBeUpdated[2]._rev = result[5]._rev;
      db.connector.bulkReplace('Product', dataToBeUpdated,
        function(err, result) {
          err = testUtil.refinedError(err, result);
          if (err) return done(err);
          testUtil.hasResult(err, result).should.be.ok();
          should.equal(result.length, dataToBeUpdated.length);
          Product.find(function(err, result) {
            err = testUtil.refinedError(err, result);
            if (err) return done(err);
            testUtil.hasResult(err, result).should.be.ok();
            result.length.should.equal(breads.length);
            done();
          });
        });
    });
  });

  it('throws error when `_rev` and `_id` is not provided with data',
    function(done) {
      db.connector.bulkReplace('Product', dataToBeUpdated,
        function(err, result) {
          err = testUtil.refinedError(err, result);
          should.exist(err);
          done();
        });
    });
});

describe('updateAttributes', function() {
  before(function(done) {
    db = global.getDataSource();

    Product = db.define('Product', {
      name: {type: String},
      description: {type: String},
      price: {type: Number},
    }, {forceId: false, updateOnLoad: true});

    db.automigrate(function(err) {
      Product.create(bread, done);
    });
  });

  after(cleanUpData);

  it('update an attribute for a model instance', function(done) {
    const updateFields = {
      name: 'bread2',
    };

    Product.find(function(err, result) {
      err = testUtil.refinedError(err, result);
      if (err) return done(err);
      testUtil.hasResult(err, result).should.be.ok();
      const id = result[0].id;
      const oldRev = result[0]._rev;
      const newData = _.cloneDeep(result[0]);
      newData.name = updateFields.name;
      const product = new Product(result[0]);
      product.updateAttributes(newData, function(err, result) {
        err = testUtil.refinedError(err, result);
        if (err) return done(err);
        testUtil.hasResult(err, result).should.be.ok();
        const newRev = result._rev;
        oldRev.should.not.equal(newRev);
        Product.find(function(err, result) {
          err = testUtil.refinedError(err, result);
          if (err) return done(err);
          testUtil.hasResult(err, result).should.be.ok();
          newRev.should.equal(result[0]._rev);
          done();
        });
      });
    });
  });
});
