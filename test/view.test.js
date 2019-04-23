// Copyright IBM Corp. 2017,2019. All Rights Reserved.
// Node module: loopback-connector-couchdb2
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

'use strict';

var _ = require('lodash');
var async = require('async');
var should = require('should');
var url = require('url');

if (!process.env.COUCHDB2_TEST_SKIP_INIT) {
  require('./init.js');
}

var db, sampleData;

describe('couchdb2 view', function() {
  describe('viewDocs', function(done) {
    before(function(done) {
      db = global.getDataSource();
      var connector = db.connector;

      db.once('connected', function(err) {
        async.series([insertSampleData, insertViewDdoc], done);
      });

      function insertSampleData(cb) {
        sampleData = generateSamples();
        connector[connector.name].use(connector.getDbName(connector))
          .bulk({docs: sampleData}, cb);
      };

      function insertViewDdoc(cb) {
        var viewFunction = 'function(doc) { if (doc.model) ' +
          '{ emit(doc.model, doc); }}';

        var ddoc = {
          _id: '_design/model',
          views: {
            getModel: {
              map: viewFunction,
            },
          },
        };

        connector[connector.name].use(connector.getDbName(connector)).insert(
          JSON.parse(JSON.stringify(ddoc)), cb
        );
      };
    });

    it('returns result by quering a view', function(done) {
      db.connector.viewDocs('model', 'getModel',
        function(err, results) {
          results.total_rows.should.equal(4);
          results.rows.forEach(hasModelName);
          done(err);

          function hasModelName(elem) {
            elem.value.hasOwnProperty('model').
              should.equal(true);
          };
        });
    });

    it('queries a view with key filter', function(done) {
      db.connector.viewDocs('model', 'getModel', {
        'key': 'customer',
      }, function(err, results) {
        var expectedNames = ['Zoe', 'Jack'];
        results.rows.forEach(belongsToModelCustomer);
        done(err);

        function belongsToModelCustomer(elem) {
          elem.key.should.equal('customer');
          _.indexOf(expectedNames, elem.value.name).should.not.equal(-1);
        }
      });
    });
  });
});

function generateSamples() {
  var samples = [
    {
      model: 'purchase',
      customerId: 1,
      basket: ['food', 'drink'],
    },
    {
      model: 'purchase',
      customerId: 2,
      basket: ['book', 'video'],
    },
    {
      model: 'customer',
      customerId: 1,
      name: 'Zoe',
    },
    {
      model: 'customer',
      customerId: 2,
      name: 'Jack',
    },
  ];

  return samples;
}
