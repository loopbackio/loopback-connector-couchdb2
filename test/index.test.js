// Copyright IBM Corp. 2017,2019. All Rights Reserved.
// Node module: loopback-connector-couchdb2
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

'use strict';

var _ = require('lodash');
var should = require('should');

if (!process.env.COUCHDB2_TEST_SKIP_INIT) {
  require('./init.js');
}

var connector, db, modelName, Product;
const DEFAULT_MODEL_VIEW = 'loopback__model__name';

describe('couchdb2 indexes', function() {
  before(function(done) {
    db = global.getDataSource();
    connector = db.connector;
    modelName = 'Product';

    Product = db.define(modelName, {
      prodName: {type: String, index: true},
      prodPrice: {type: Number},
      prodCode: {type: String},
    });
    db.automigrate(done);
  });

  after(function(done) {
    Product.destroyAll(done);
  });

  it('support property level indexes', function(done) {
    connector.getIndexes(connector.getDbName(connector), function(err, indexes) {
      should.not.exist(err);
      indexes = indexes.indexes;
      var indexName = 'prodName_index';

      should.not.exist(err);
      should.exist(indexes);

      var index = _.find(indexes, function(index) {
        return index.name === indexName;
      });

      should.exist(index);
      should.exist(index.name);
      index.name.should.equal(indexName);
      index.def.fields[0]['prodName'].should.equal('asc');
      index.def.fields[1][DEFAULT_MODEL_VIEW].should.equal('asc');
      done();
    });
  });

  it('support model level indexes', function(done) {
    Product = db.define(modelName, {
      prodName: {type: String},
      prodPrice: {type: Number},
      prodCode: {type: String},
    }, {
      indexes: {
        'prodPrice_index': {
          keys: {
            prodPrice: -1,
          },
        },
      },
    });

    db.automigrate('Product', function(err) {
      should.not.exist(err);
      connector.getIndexes(connector.getDbName(connector), function(err, indexes) {
        should.not.exist(err);
        indexes = indexes.indexes;
        var indexName = 'prodPrice_index';

        should.not.exist(err);
        should.exist(indexes);

        var index = _.find(indexes, function(index) {
          return index.name === indexName;
        });

        should.exist(index);
        should.exist(index.name);
        index.name.should.equal(indexName);
        index.def.fields[0]['prodPrice'].should.equal('desc');
        index.def.fields[1][DEFAULT_MODEL_VIEW].should.equal('desc');
        done();
      });
    });
  });

  it('support both property and model level indexes', function(done) {
    Product = db.define(modelName, {
      prodName: {type: String, index: true},
      prodPrice: {type: Number},
      prodCode: {type: String},
    }, {
      indexes: {
        'prodPrice_index': {
          keys: {
            prodPrice: -1,
          },
        },
      },
    });

    db.automigrate('Product', function(err) {
      should.not.exist(err);
      connector.getIndexes(connector.getDbName(connector), function(err, indexes) {
        indexes = indexes.indexes;
        var priceIndex = 'prodPrice_index';
        var nameIndex = 'prodName_index';

        should.not.exist(err);
        should.exist(indexes);

        var priceIndexDoc = _.find(indexes, function(index) {
          return index.name === priceIndex;
        });

        var nameIndexDoc = _.find(indexes, function(index) {
          return index.name === nameIndex;
        });

        should.exist(priceIndexDoc);
        should.exist(nameIndexDoc);
        should.exist(priceIndexDoc.name);
        should.exist(nameIndexDoc.name);
        priceIndexDoc.name.should.equal(priceIndex);
        nameIndexDoc.name.should.equal(nameIndex);
        priceIndexDoc.def.fields[0]['prodPrice'].should.equal('desc');
        priceIndexDoc.def.fields[1][DEFAULT_MODEL_VIEW].should.equal('desc');
        nameIndexDoc.def.fields[0]['prodName'].should.equal('asc');
        nameIndexDoc.def.fields[1][DEFAULT_MODEL_VIEW].should.equal('asc');
        done();
      });
    });
  });

  it('support multiple property level indexes', function(done) {
    Product = db.define(modelName, {
      prodName: {type: String, index: true},
      prodPrice: {type: Number},
      prodCode: {type: String, index: true},
    });

    db.automigrate(function(err) {
      should.not.exist(err);

      connector.getIndexes(connector.getDbName(connector), function(err, indexes) {
        should.not.exist(err);
        should.exist(indexes);

        indexes = indexes.indexes;
        var nameIndex = 'prodName_index';
        var codeIndex = 'prodCode_index';

        var nameIndexDoc = _.find(indexes, function(index) {
          return index.name === nameIndex;
        });

        var codeIndexDoc = _.find(indexes, function(index) {
          return index.name === codeIndex;
        });

        should.exist(codeIndexDoc);
        should.exist(nameIndexDoc);
        should.exist(codeIndexDoc.name);
        should.exist(nameIndexDoc.name);
        codeIndexDoc.name.should.equal(codeIndex);
        nameIndexDoc.name.should.equal(nameIndex);
        codeIndexDoc.def.fields[0]['prodCode'].should.equal('asc');
        codeIndexDoc.def.fields[1][DEFAULT_MODEL_VIEW].should.equal('asc');
        nameIndexDoc.def.fields[0]['prodName'].should.equal('asc');
        codeIndexDoc.def.fields[1][DEFAULT_MODEL_VIEW].should.equal('asc');
        done();
      });
    });
  });

  it('support composite indexes going same direction', function(done) {
    Product = db.define(modelName, {
      prodName: {type: String},
      prodPrice: {type: Number},
      prodCode: {type: String},
    }, {
      indexes: {
        'price_code_index': {
          keys: {
            prodPrice: 1,
            prodCode: 1,
          },
        },
      },
    });

    db.automigrate('Product', function(err) {
      connector.getIndexes(connector.getDbName(connector), function(err, indexes) {
        indexes = indexes.indexes;
        var indexName = 'price_code_index';

        should.not.exist(err);
        should.exist(indexes);

        var index = _.find(indexes, function(index) {
          return index.name === indexName;
        });

        should.exist(index);
        should.exist(index.name);
        index.name.should.equal(indexName);
        index.def.fields[0]['prodPrice'].should.equal('asc');
        index.def.fields[1]['prodCode'].should.equal('asc');
        index.def.fields[2][DEFAULT_MODEL_VIEW].should.equal('asc');
        done();
      });
    });
  });

  it('coerce order when composite indexes go opposite direction', function(done) {
    Product = db.define(modelName, {
      prodName: {type: String, index: true},
      prodPrice: {type: Number, index: true},
      prodCode: {type: String},
    }, {
      indexes: {
        'code_price_index': {
          keys: {
            prodCode: 1,
            prodPrice: -1,
          },
        },
      },
    });

    db.automigrate('Product', function(err) {
      should.not.exist(err);
      connector.getIndexes(connector.getDbName(connector), function(err, indexes) {
        should.exist(indexes);
        indexes = indexes.indexes;
        var compositeIndex = 'code_price_index';

        var compositeIndexDoc = _.find(indexes, function(index) {
          return index.name === compositeIndex;
        });

        should.exist(compositeIndexDoc);
        compositeIndexDoc.name.should.equal(compositeIndex);
        compositeIndexDoc.def.fields[0]['prodCode'].should.equal('asc');
        compositeIndexDoc.def.fields[1]['prodPrice'].should.equal('asc');
        compositeIndexDoc.def.fields[2][DEFAULT_MODEL_VIEW].should.equal('asc');
        done();
      });
    });
  });

  context('query using indexes', function() {
    before(function(done) {
      Product.create(data, done);
    });

    it('couchdb picked default index', function(done) {
      Product.find({
        where: {
          prodPrice: {
            gt: 0,
          },
        },
        order: 'prodPrice desc',
      },
      function(err, products) {
        should.not.exist(err);
        should.exist(products);
        // check if the prices are in descending order
        for (var i = 1; i < products.length; i++) {
          var previous = products[i - 1].prodPrice;
          var current = products[i].prodPrice;
          should.ok(previous >= current);
        }
        done();
      });
    });

    it('user specified index', function(done) {
      /* eslint camelcase: ["error", {properties: "never"}] */
      Product.find({where: {prodPrice: {gt: 0}}}, {
        use_index: 'LBModel__Product__LBIndex__prodPrice_index',
      }, function(err, products) {
        should.not.exist(err);
        should.exist(products);
        // check if the prices are in ascending order
        for (var i = 1; i < products.length; i++) {
          var previous = products[i - 1].prodPrice;
          var current = products[i].prodPrice;
          should.ok(previous <= current);
        }
        // check if the codes are in ascending order
        var codes = _.uniq(_.map(products, function(product) {
          return product.prodCode;
        }));
        should.deepEqual(codes, ['abc', 'def', 'ghi']);
        done();
      });
    });
  });
});

var data = [{
  prodName: 'prod1',
  prodPrice: 5,
  prodCode: 'abc',
}, {
  prodName: 'prod2',
  prodPrice: 12,
  prodCode: 'def',
}, {
  prodName: 'prod3',
  prodPrice: 4,
  prodCode: 'abc',
}, {
  prodName: 'prod4',
  prodPrice: 10,
  prodCode: 'def',
}, {
  prodName: 'prod5',
  prodPrice: 20,
  prodCode: 'ghi',
}];
